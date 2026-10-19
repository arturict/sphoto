import { env } from './env';

async function admin<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${env.appUrl}/api/admin${path}`, { ...init, headers: { authorization: `Bearer ${env.adminKey}`, 'content-type': 'application/json', ...init.headers } });
  if (!res.ok) throw new Error(`admin ${path} -> ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

export const runMaintenance = () => admin<{ tasks: { task: string; ok: boolean; detail: string }[] }>('/jobs/run', { method: 'POST' });

export const listUsers = () => admin<{ id: string; email: string; tier: string; instance: string; status: string; cancellationDueAt: string | null; deletionDueAt: string | null }[]>('/users');

export async function waitUntil(description: string, check: () => Promise<boolean>, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await check()) return;
    if (Date.now() > deadline) throw new Error(`Timed out waiting for: ${description}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
