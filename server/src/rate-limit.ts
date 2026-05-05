import rateLimit, { type Options, type RateLimitRequestHandler } from 'express-rate-limit';
import type { NextFunction, Request, Response } from 'express';

const DEFAULT_API_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_API_MAX = 1_000;
const DEFAULT_AUTH_WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_AUTH_MAX = 10;
const RATE_LIMIT_ERROR = 'too many requests, please try again later';

export type RateLimitConfig = {
  apiWindowMs: number;
  apiMax: number;
  authWindowMs: number;
  authMax: number;
};

export type RateLimitOverrides = Partial<RateLimitConfig>;

function positiveIntFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;

  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export function resolveRateLimitConfig(overrides: RateLimitOverrides = {}): RateLimitConfig {
  return {
    apiWindowMs:
      overrides.apiWindowMs ??
      positiveIntFromEnv('API_RATE_LIMIT_WINDOW_MS', DEFAULT_API_WINDOW_MS),
    apiMax: overrides.apiMax ?? positiveIntFromEnv('API_RATE_LIMIT_MAX', DEFAULT_API_MAX),
    authWindowMs:
      overrides.authWindowMs ??
      positiveIntFromEnv('AUTH_RATE_LIMIT_WINDOW_MS', DEFAULT_AUTH_WINDOW_MS),
    authMax: overrides.authMax ?? positiveIntFromEnv('AUTH_RATE_LIMIT_MAX', DEFAULT_AUTH_MAX),
  };
}

function rateLimitHandler(
  _req: Request,
  res: Response,
  _next: NextFunction,
  options: Options
) {
  res.status(options.statusCode).json({ error: RATE_LIMIT_ERROR });
}

function buildLimiter(options: Partial<Options> & Pick<Options, 'windowMs' | 'max'>) {
  return rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
    message: { error: RATE_LIMIT_ERROR },
    ...options,
  });
}

export function createApiRateLimiter(config: RateLimitConfig): RateLimitRequestHandler {
  return buildLimiter({
    windowMs: config.apiWindowMs,
    max: config.apiMax,
  });
}

export function createAuthRateLimiter(config: RateLimitConfig): RateLimitRequestHandler {
  return buildLimiter({
    windowMs: config.authWindowMs,
    max: config.authMax,
    skipSuccessfulRequests: true,
  });
}
