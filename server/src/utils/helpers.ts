import type { Request, Response, NextFunction } from 'express';
import { customAlphabet } from 'nanoid';

/** Wrap an async route handler so thrown errors hit the error middleware. */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

/** A typed application error with an HTTP status code. */
export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 220);
}

const nano = customAlphabet('0123456789ABCDEFGHJKMNPQRSTUVWXYZ', 8);

/** Short, human-readable unique suffix / serial. */
export function shortId(): string {
  return nano();
}

export function uniqueSlug(base: string): string {
  return `${slugify(base)}-${nano().toLowerCase().slice(0, 5)}`;
}
