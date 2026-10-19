import console from 'node:console';
import { randomBytes } from 'node:crypto';
import { writeFileSync, existsSync } from 'node:fs';
if (existsSync('.env')) throw new Error('Refusing to replace an existing .env. Use a clean test folder.');
writeFileSync('.env', `ADMIN_EMAIL=operator@example.test\nADMIN_PASSWORD=${randomBytes(24).toString('hex')}\nSESSION_SECRET=${randomBytes(32).toString('hex')}\nDB_PASSWORD=${randomBytes(24).toString('hex')}\nPUBLIC_URL=http://localhost:19000\nAPP_PORT=19000\nIMMICH_PORT=19283\nBILLING_MODE=manual\n`, { mode: 0o600 });
console.log('Created isolated synthetic test configuration.');
