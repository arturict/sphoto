import { env } from './env';

interface MailpitMessage {
  ID: string;
  Subject: string;
  To: { Address: string }[];
  Created: string;
}

async function listFor(address: string): Promise<MailpitMessage[]> {
  const res = await fetch(`${env.mailpitUrl}/api/v1/search?query=${encodeURIComponent(`to:${address}`)}`);
  const body = (await res.json()) as { messages?: MailpitMessage[] };
  return body.messages ?? [];
}

/** Waits for a mail to `address` whose subject contains `subject` and returns its text body. */
export async function waitForMail(address: string, subject: string, options: { after?: Date; timeoutMs?: number } = {}): Promise<string> {
  const deadline = Date.now() + (options.timeoutMs ?? 30_000);
  for (;;) {
    const match = (await listFor(address)).find((m) => m.Subject.includes(subject) && (!options.after || new Date(m.Created) > options.after));
    if (match) {
      const res = await fetch(`${env.mailpitUrl}/api/v1/message/${match.ID}`);
      return ((await res.json()) as { Text: string }).Text;
    }
    if (Date.now() > deadline) throw new Error(`No mail "${subject}" to ${address} within the timeout`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

export async function subjectsFor(address: string): Promise<string[]> {
  return (await listFor(address)).map((m) => m.Subject);
}

export function linkFrom(text: string, pattern: RegExp): string {
  const match = text.match(pattern);
  if (!match?.[0]) throw new Error(`Pattern ${String(pattern)} not found in mail:\n${text}`);
  return match[0];
}
