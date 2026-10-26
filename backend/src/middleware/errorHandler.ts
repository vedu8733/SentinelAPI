import { Request, Response, NextFunction } from 'express';

interface CustomHttpError extends Error {
  status?: number;
  statusCode?: number;
  type?: string;
}

export function errorHandler(
  err: CustomHttpError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.status || err.statusCode || 500;

  // Handle malformed JSON body errors from body-parser
  if (err instanceof SyntaxError && 'body' in err && statusCode === 400) {
    res.status(400).json({
      error: {
        code: 'BAD_REQUEST',
        message: 'Invalid or malformed JSON payload'
      }
    });
    return;
  }

  // Handle payload too large
  if (err.type === 'entity.too.large' || statusCode === 413) {
    res.status(413).json({
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request payload exceeds the configured limit'
      }
    });
    return;
  }

  // Generic safe error response - never exposes stack traces or internal errors
  res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
    error: {
      code: statusCode === 400 ? 'BAD_REQUEST' : 'INTERNAL_SERVER_ERROR',
      message: statusCode === 500 ? 'An unexpected internal error occurred' : (err.message || 'Error processing request')
    }
  });
}
