import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../utils/helpers.js';
import { env } from '../env.js';

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: 'Not found' });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(422).json({
      error: 'Validation failed',
      details: err.flatten(),
    });
  }
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  // Postgres unique violation
  if (typeof err === 'object' && err && (err as { code?: string }).code === '23505') {
    return res.status(409).json({ error: 'Resource already exists' });
  }
  if (!env.isProd) {
    console.error(err);
  }
  const message = err instanceof Error ? err.message : 'Internal server error';
  res.status(500).json({ error: env.isProd ? 'Internal server error' : message });
}
