import nodemailer, { type Transporter } from 'nodemailer';
import type { Config } from '../config';

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  send(mail: Mail): Promise<void>;
}

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Mails are written as plain text; the HTML part only adds paragraphs and clickable links.
export function toHtml(text: string): string {
  const paragraphs = text.split(/\n{2,}/).map((p) =>
    escapeHtml(p)
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')
      .replace(/\n/g, '<br>'),
  );
  return `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#1f2937">${paragraphs.map((p) => `<p>${p}</p>`).join('')}</div>`;
}

class ResendMailer implements Mailer {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(mail: Mail): Promise<void> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: this.from, to: [mail.to], subject: mail.subject, text: mail.text, html: toHtml(mail.text) }),
    });
    if (!response.ok) throw new Error(`Resend answered ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }
}

class SmtpMailer implements Mailer {
  private readonly transport: Transporter;

  constructor(
    smtpUrl: string,
    private readonly from: string,
  ) {
    this.transport = nodemailer.createTransport(smtpUrl);
  }

  async send(mail: Mail): Promise<void> {
    await this.transport.sendMail({ from: this.from, to: mail.to, subject: mail.subject, text: mail.text, html: toHtml(mail.text) });
  }
}

export function createMailer(config: Config): Mailer {
  const { env } = config;
  if (env.MAIL_PROVIDER === 'resend' && env.RESEND_API_KEY) return new ResendMailer(env.RESEND_API_KEY, env.MAIL_FROM);
  if (env.MAIL_PROVIDER === 'smtp' && env.SMTP_URL) return new SmtpMailer(env.SMTP_URL, env.MAIL_FROM);
  throw new Error('Mail provider is not configured');
}

/** Collects mails in memory. Used by tests. */
export class MemoryMailer implements Mailer {
  readonly sent: Mail[] = [];
  failNext: Error | null = null;

  send(mail: Mail): Promise<void> {
    if (this.failNext) {
      const err = this.failNext;
      this.failNext = null;
      return Promise.reject(err);
    }
    this.sent.push(mail);
    return Promise.resolve();
  }

  to(address: string): Mail[] {
    return this.sent.filter((m) => m.to === address);
  }
}
