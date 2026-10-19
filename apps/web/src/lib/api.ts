import { errorSchema } from '@sphoto/shared';
import type { z } from 'zod';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export interface ApiInit {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  // Admin requests authenticate with the key typed into the admin gate.
  adminKey?: string;
}

const NETWORK_ERROR = 'Keine Verbindung zum Server. Bitte prüfe deine Internetverbindung und versuche es erneut.';
const UNEXPECTED_RESPONSE = 'Unerwartete Antwort vom Server. Bitte versuche es später erneut.';

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

export async function request<S extends z.ZodType>(path: string, schema: S, init: ApiInit = {}): Promise<z.output<S>> {
  const headers = new Headers({ accept: 'application/json' });
  if (init.body !== undefined) headers.set('content-type', 'application/json');
  if (init.adminKey !== undefined) headers.set('authorization', `Bearer ${init.adminKey}`);

  let response: Response;
  try {
    response = await fetch(path, {
      method: init.method ?? 'GET',
      headers,
      credentials: 'same-origin',
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    });
  } catch {
    throw new ApiError(0, NETWORK_ERROR);
  }

  const payload = await readJson(response);
  if (!response.ok) {
    const parsedError = errorSchema.safeParse(payload);
    throw new ApiError(response.status, parsedError.success ? parsedError.data.error : `Anfrage fehlgeschlagen (HTTP ${response.status})`);
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new ApiError(response.status, UNEXPECTED_RESPONSE);
  return parsed.data;
}

export function errorText(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Es ist ein unerwarteter Fehler aufgetreten.';
}
