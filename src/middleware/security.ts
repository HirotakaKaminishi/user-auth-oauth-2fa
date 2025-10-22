import { Request, Response, NextFunction, RequestHandler } from 'express';
import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import helmet, { HelmetOptions } from 'helmet';
import crypto from 'crypto';
import cookieParser from 'cookie-parser';

/**
 * Rate Limit Middleware
 *
 * Protects against brute-force attacks by limiting request rate per IP.
 * Default: 10 requests per minute per IP address.
 *
 * @param options - Custom rate limit options
 * @returns Express middleware
 */
export interface RateLimitOptions {
  windowMs?: number; // Time window in milliseconds
  max?: number; // Max requests per window
  message?: string; // Custom error message
  skipSuccessfulRequests?: boolean;
}

export function createRateLimitMiddleware(
  options: RateLimitOptions = {}
): RateLimitRequestHandler {
  const {
    windowMs = 60 * 1000, // 1 minute
    max = 10, // 10 requests per minute
    message = 'Too many requests from this IP, please try again later.',
    skipSuccessfulRequests = false,
  } = options;

  return rateLimit({
    windowMs,
    max,
    message,
    skipSuccessfulRequests,
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
  });
}

/**
 * CSRF Protection Middleware
 *
 * Implements state parameter validation for OAuth flows to prevent CSRF attacks.
 * Uses cryptographically secure random state stored in HttpOnly cookie.
 */
export interface CSRFMiddleware {
  generateState: RequestHandler;
  validateState: RequestHandler;
}

const CSRF_COOKIE_NAME = 'csrf_state';
const CSRF_STATE_LENGTH = 32; // 32 bytes = 256 bits

export function createCSRFProtectionMiddleware(): CSRFMiddleware {
  /**
   * Generate CSRF state and store in cookie
   */
  const generateState: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
    try {
      // Generate cryptographically secure random state
      const state = crypto.randomBytes(CSRF_STATE_LENGTH).toString('hex');

      // Store in HttpOnly cookie
      res.cookie(CSRF_COOKIE_NAME, state, {
        httpOnly: true,
        secure: process.env['NODE_ENV'] === 'production',
        sameSite: 'lax',
        maxAge: 10 * 60 * 1000, // 10 minutes
      });

      // Attach to request for use in response
      (req as any).csrfState = state;

      next();
    } catch (error) {
      res.status(500).json({
        error: 'Failed to generate CSRF state',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * Validate CSRF state from query parameter against cookie
   */
  const validateState: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
    try {
      const stateFromQuery = req.query['state'] as string | undefined;
      const stateFromCookie = req.cookies[CSRF_COOKIE_NAME] as string | undefined;

      // Check if both exist
      if (!stateFromQuery || !stateFromCookie) {
        res.status(403).json({
          error: 'Missing CSRF state',
          message: 'CSRF state parameter or cookie is missing',
        });
        return;
      }

      // Constant-time comparison to prevent timing attacks
      const stateQueryBuffer = Buffer.from(stateFromQuery, 'utf8');
      const stateCookieBuffer = Buffer.from(stateFromCookie, 'utf8');

      if (stateQueryBuffer.length !== stateCookieBuffer.length) {
        res.status(403).json({
          error: 'Invalid CSRF state',
          message: 'CSRF state mismatch',
        });
        return;
      }

      const isValid = crypto.timingSafeEqual(stateQueryBuffer, stateCookieBuffer);

      if (!isValid) {
        res.status(403).json({
          error: 'Invalid CSRF state',
          message: 'CSRF state mismatch',
        });
        return;
      }

      // Clear the state cookie after validation (one-time use)
      res.clearCookie(CSRF_COOKIE_NAME);

      next();
    } catch (error) {
      res.status(500).json({
        error: 'Failed to validate CSRF state',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  return {
    generateState,
    validateState,
  };
}

/**
 * Secure Cookie Middleware
 *
 * Overrides res.cookie() to set secure defaults:
 * - HttpOnly: Prevents JavaScript access (XSS protection)
 * - Secure: HTTPS only (in production)
 * - SameSite=Lax: CSRF protection
 */
export function createSecureCookieMiddleware(): RequestHandler {
  return (_req: Request, res: Response, next: NextFunction) => {
    const originalCookie = res.cookie.bind(res);

    // Override res.cookie with secure defaults
    res.cookie = function (name: string, value: any, options: any = {}) {
      const secureOptions = {
        httpOnly: true, // Prevent XSS
        secure: process.env['NODE_ENV'] === 'production', // HTTPS only in production
        sameSite: 'lax' as const, // CSRF protection
        ...options, // Allow override
      };

      return originalCookie(name, value, secureOptions);
    };

    next();
  };
}

/**
 * Security Headers Middleware
 *
 * Sets comprehensive security headers using Helmet:
 * - HSTS (Strict-Transport-Security): Force HTTPS
 * - CSP (Content-Security-Policy): Prevent XSS and injection
 * - X-Content-Type-Options: Prevent MIME sniffing
 * - X-Frame-Options: Prevent clickjacking
 * - X-XSS-Protection: Browser XSS filter
 */
export function createSecurityHeadersMiddleware(options: Partial<HelmetOptions> = {}): RequestHandler {
  const defaultOptions = {
    // HSTS: Force HTTPS for 1 year
    hsts: {
      maxAge: 31536000, // 1 year in seconds
      includeSubDomains: true,
      preload: true,
    },

    // Content Security Policy
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for development
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },

    // X-Frame-Options: Prevent clickjacking
    frameguard: {
      action: 'deny',
    },

    // Referrer-Policy
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },

    ...options, // Allow override
  } as HelmetOptions;

  return helmet(defaultOptions);
}

/**
 * Cookie Parser Middleware
 *
 * Parses Cookie header and populates req.cookies.
 * Required for CSRF protection.
 */
export function createCookieParserMiddleware(): RequestHandler {
  return cookieParser();
}
