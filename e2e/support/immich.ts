// Talks to the real Immich servers the way the Immich mobile app would, as a normal user.
export interface ImmichSession {
  baseUrl: string;
  token: string;
}

export async function immichLogin(baseUrl: string, email: string, password: string): Promise<ImmichSession | null> {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { accessToken: string };
  return { baseUrl, token: body.accessToken };
}

const headers = (session: ImmichSession) => ({ authorization: `Bearer ${session.token}` });

export async function uploadImage(session: ImmichSession, filename: string, bytes: Buffer): Promise<{ ok: boolean; status: number; id?: string; text: string }> {
  const form = new FormData();
  const now = new Date().toISOString();
  form.set('assetData', new Blob([new Uint8Array(bytes)]), filename);
  form.set('fileCreatedAt', now);
  form.set('fileModifiedAt', now);
  const res = await fetch(`${session.baseUrl}/api/assets`, { method: 'POST', headers: headers(session), body: form });
  const text = await res.text();
  let id: string | undefined;
  if (res.ok) id = (JSON.parse(text) as { id: string }).id;
  return { ok: res.ok, status: res.status, text, ...(id ? { id } : {}) };
}

export async function listAssetNames(session: ImmichSession): Promise<string[]> {
  const res = await fetch(`${session.baseUrl}/api/search/metadata`, {
    method: 'POST',
    headers: { ...headers(session), 'content-type': 'application/json' },
    body: JSON.stringify({ size: 100 }),
  });
  const body = (await res.json()) as { assets: { items: { originalFileName: string }[] } };
  return body.assets.items.map((i) => i.originalFileName).sort();
}

export async function downloadOriginal(session: ImmichSession, assetId: string): Promise<Buffer> {
  const res = await fetch(`${session.baseUrl}/api/assets/${assetId}/original`, { headers: headers(session) });
  return Buffer.from(await res.arrayBuffer());
}
