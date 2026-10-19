export class AppError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409 | 429 | 500 | 502 | 503,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
