import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ApiError, isApiError } from './errors.js';

/** Envuelve handlers async para que Express 5 propague los errores. */
export function wrap<T extends RequestHandler>(handler: T): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function ok<T>(res: Response, data: T, status = 200, meta?: Record<string, unknown>) {
  return res.status(status).json(meta ? { data, meta } : { data });
}

export function created<T>(res: Response, data: T) {
  return ok(res, data, 201);
}

export function noContent(res: Response) {
  return res.status(204).end();
}

export function errorHandler(err: unknown, _req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) return next(err);

  if (isApiError(err)) {
    return res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
  }

  console.error('[api] error no controlado:', err);
  const internal = ApiError.internal();
  return res.status(500).json({ error: { code: internal.code, message: internal.message } });
}

export function notFoundHandler(_req: Request, res: Response) {
  return res.status(404).json({
    error: { code: 'not_found', message: 'Endpoint inexistente. Mira GET /v1/endpoints.' },
  });
}
