import { portalMeSchema, publicConfigSchema } from '@sphoto/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, errorText, request } from './api';

function respondWith(status: number, body: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }))),
  );
}

const config = {
  plans: [{ id: 'free', name: 'Free', priceChfPerMonth: 0, storageGb: 5, hasMl: false }],
  instances: { free: { url: 'https://free.example' }, paid: { url: 'https://paid.example' } },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('request', () => {
  it('returns the body parsed by the schema', async () => {
    respondWith(200, config);
    await expect(request('/api/config', publicConfigSchema)).resolves.toEqual(config);
  });

  it('sends JSON bodies, cookies and the admin key', async () => {
    respondWith(200, config);
    await request('/api/x', publicConfigSchema, { method: 'POST', body: { a: 1 }, adminKey: 'secret' });

    const fetchMock = vi.mocked(fetch);
    const [path, init] = fetchMock.mock.calls[0] ?? [];
    expect(path).toBe('/api/x');
    expect(init?.method).toBe('POST');
    expect(init?.credentials).toBe('same-origin');
    expect(init?.body).toBe('{"a":1}');
    const headers = new Headers(init?.headers);
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('authorization')).toBe('Bearer secret');
  });

  it('throws the German message of an error response with its status', async () => {
    respondWith(409, { error: 'Diese E-Mail-Adresse ist bereits registriert.' });
    const error = await request('/api/signup/free', publicConfigSchema).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, message: 'Diese E-Mail-Adresse ist bereits registriert.' });
  });

  it('falls back to a status message when the error body is not the API shape', async () => {
    respondWith(502, '<html>Bad gateway</html>');
    await expect(request('/api/config', publicConfigSchema)).rejects.toMatchObject({ status: 502, message: 'Anfrage fehlgeschlagen (HTTP 502)' });
  });

  it('rejects a success body that does not match the schema', async () => {
    respondWith(200, { email: 'a@b.ch' });
    const error = await request('/api/portal/me', portalMeSchema).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toHaveProperty('message', 'Unerwartete Antwort vom Server. Bitte versuche es später erneut.');
  });

  it('maps network failures to a connection error', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    const error = await request('/api/config', publicConfigSchema).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toHaveProperty('status', 0);
    expect(error).toHaveProperty('message', expect.stringMatching(/^Keine Verbindung/));
  });
});

describe('errorText', () => {
  it('shows API messages and hides unknown errors', () => {
    expect(errorText(new ApiError(400, 'Ungültige Anfrage'))).toBe('Ungültige Anfrage');
    expect(errorText(new Error('boom'))).toBe('Es ist ein unerwarteter Fehler aufgetreten.');
  });
});
