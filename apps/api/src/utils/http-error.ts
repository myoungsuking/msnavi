export class HttpError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(status: number, message: string, opts?: { code?: string; details?: unknown }) {
    super(message);
    this.status = status;
    this.code = opts?.code;
    this.details = opts?.details;
  }
}

export const badRequest = (msg: string, details?: unknown) =>
  new HttpError(400, msg, { code: 'BAD_REQUEST', details });

export const notFound = (msg = 'Not Found') =>
  new HttpError(404, msg, { code: 'NOT_FOUND' });

export const internal = (msg = 'Internal Server Error') =>
  new HttpError(500, msg, { code: 'INTERNAL' });
