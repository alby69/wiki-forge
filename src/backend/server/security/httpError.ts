export class HttpError extends Error {
  public readonly status: number;
  public readonly code?: string;

  constructor(message: string, status = 500, code?: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

export function isHttpError(err: unknown): err is HttpError {
  return err instanceof HttpError;
}

export function httpStatusOf(err: unknown): number {
  return isHttpError(err) ? err.status : 500;
}

export function httpErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
