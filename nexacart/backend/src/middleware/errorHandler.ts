import { Request, Response, NextFunction } from 'express';

interface CustomHttpError extends Error {
  status?: number;
  statusCode?: number;
  code?: string;
}

export function errorHandler(
  err: CustomHttpError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.status || err.statusCode || 500;

  if (err instanceof SyntaxError && 'body' in err && statusCode === 400) {
    res.status(400).json({
      error: {
        code: 'BAD_REQUEST',
        message: 'Invalid or malformed JSON payload'
      }
    });
    return;
  }

  res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
    error: {
      code: err.code || (statusCode === 400 ? 'BAD_REQUEST' : 'INTERNAL_SERVER_ERROR'),
      message: statusCode === 500 ? 'An unexpected internal error occurred' : (err.message || 'Error processing request')
    }
  });
}
