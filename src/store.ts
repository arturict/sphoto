import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { planSchema, type Plan } from './config.js';

const userSchema = z.object({ id: z.string(), email: z.string(), name: z.string(), plan: planSchema, customer: z.string().nullable(), subscription: z.string().nullable() });
export type User = z.infer<typeof userSchema>;
const sessionSchema = z.object({ userId: z.string(), token: z.string(), expires: z.number() });
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

export class Store {
  readonly db: DatabaseSync;
  private readonly key: Buffer;
  constructor(path: string, secret: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.key = createHash('sha256').update(secret).digest();
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, plan TEXT NOT NULL DEFAULT 'free', customer TEXT UNIQUE, subscription TEXT UNIQUE);
      CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, userId TEXT NOT NULL, token TEXT NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS checkouts (userId TEXT PRIMARY KEY, sessionId TEXT, requestKey TEXT NOT NULL, plan TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, processed INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS jobs (id INTEGER PRIMARY KEY, started TEXT NOT NULL, finished TEXT, error TEXT);`);
  }
  close() { this.db.close(); }
  addUser(user: { id: string; email: string; name: string }) {
    this.db.prepare('INSERT INTO users (id,email,name) VALUES (?,?,?)').run(user.id, user.email, user.name);
  }
  user(id: string): User | undefined {
    const row = this.db.prepare('SELECT * FROM users WHERE id=?').get(id);
    return row ? userSchema.parse(row) : undefined;
  }
  users(): User[] { return z.array(userSchema).parse(this.db.prepare('SELECT * FROM users ORDER BY email').all()); }
  setPlan(id: string, plan: Plan, customer: string | null, subscription: string | null) {
    this.db.prepare('UPDATE users SET plan=?, customer=?, subscription=? WHERE id=?').run(plan, customer, subscription, id);
  }
  session(userId: string, token: string) {
    const cookie = randomBytes(32).toString('hex');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
    const sealed = [iv, cipher.getAuthTag(), encrypted].map(b => b.toString('base64')).join('.');
    this.db.prepare('INSERT INTO sessions VALUES (?,?,?,?)').run(hash(cookie), userId, sealed, Date.now() + 7 * 86400000);
    return cookie;
  }
  getSession(cookie: string) {
    const row = this.db.prepare('SELECT userId,token,expires FROM sessions WHERE hash=? AND expires>?').get(hash(cookie), Date.now());
    if (!row) return undefined;
    const session = sessionSchema.parse(row);
    const [iv, tag, sealed] = session.token.split('.');
    if (!iv || !tag || !sealed) throw new Error('Invalid stored session');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return { ...session, token: Buffer.concat([decipher.update(Buffer.from(sealed, 'base64')), decipher.final()]).toString('utf8') };
  }
  deleteSession(cookie: string) { this.db.prepare('DELETE FROM sessions WHERE hash=?').run(hash(cookie)); }
  cleanup() { this.db.prepare('DELETE FROM sessions WHERE expires<=?').run(Date.now()); }
  checkout(id: string) {
    return z.object({ userId: z.string(), sessionId: z.string().nullable(), requestKey: z.string(), plan: z.enum(['basic', 'pro']) }).optional().parse(this.db.prepare('SELECT * FROM checkouts WHERE userId=?').get(id));
  }
  beginCheckout(id: string, plan: 'basic' | 'pro') { this.db.prepare('INSERT OR IGNORE INTO checkouts VALUES (?,NULL,?,?)').run(id, randomBytes(24).toString('hex'), plan); }
  saveCheckout(id: string, sessionId: string) { this.db.prepare('UPDATE checkouts SET sessionId=? WHERE userId=?').run(sessionId, id); }
  deleteCheckout(id: string) { this.db.prepare('DELETE FROM checkouts WHERE userId=?').run(id); }
  seenEvent(id: string) { return Boolean(this.db.prepare('SELECT id FROM events WHERE id=?').get(id)); }
  finishEvent(id: string) { this.db.prepare('INSERT OR IGNORE INTO events VALUES (?,?)').run(id, Date.now()); }
  startJob() { return Number(this.db.prepare('INSERT INTO jobs (started) VALUES (?)').run(new Date().toISOString()).lastInsertRowid); }
  finishJob(id: number, error: string | null) { this.db.prepare('UPDATE jobs SET finished=?,error=? WHERE id=?').run(new Date().toISOString(), error, id); }
  jobs() { return this.db.prepare('SELECT * FROM jobs ORDER BY id DESC LIMIT 20').all(); }
}
