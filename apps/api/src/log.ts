export interface Logger {
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
}

const write = (level: string, message: string, fields: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ level, time: new Date().toISOString(), message, ...fields }));

export const consoleLogger: Logger = {
  info: (m, f) => write('info', m, f),
  warn: (m, f) => write('warn', m, f),
  error: (m, f) => write('error', m, f),
};

export const silentLogger: Logger = { info: () => undefined, warn: () => undefined, error: () => undefined };

export const errorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err));
