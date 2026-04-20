import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../utils/http-error';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: {
        message: err.message,
        code: err.code ?? 'ERROR',
        details: err.details,
      },
    });
  }
  console.error('[unhandled error]', err);
  const message = err instanceof Error ? err.message : 'Internal Server Error';
  return res.status(500).json({
    error: { message, code: 'INTERNAL' },
  });
}
