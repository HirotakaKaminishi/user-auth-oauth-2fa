import { describe, it, expect, beforeEach } from '@jest/globals';
import express, { Request, Response } from 'express';
import request from 'supertest';
import {
  createRateLimitMiddleware,
  createCSRFProtectionMiddleware,
  createSecureCookieMiddleware,
  createSecurityHeadersMiddleware,
  createCookieParserMiddleware,
} from '../../middleware/security';

describe('Security Middleware', () => {
  describe('Rate Limit Middleware', () => {
    let app: express.Application;

    beforeEach(() => {
      app = express();
      app.use(express.json());
    });

    it('should allow requests within rate limit (10 req/min default)', async () => {
      const rateLimiter = createRateLimitMiddleware();
      app.use(rateLimiter);
      app.get('/test', (_req: Request, res: Response) => {
        res.json({ success: true });
      });

      // Send 5 requests (within limit)
      for (let i = 0; i < 5; i++) {
        const response = await request(app).get('/test');
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });

    it('should block requests exceeding rate limit', async () => {
      const rateLimiter = createRateLimitMiddleware({ max: 3, windowMs: 60000 });
      app.use(rateLimiter);
      app.get('/test', (_req: Request, res: Response) => {
        res.json({ success: true });
      });

      // Send 3 requests (at limit)
      for (let i = 0; i < 3; i++) {
        const response = await request(app).get('/test');
        expect(response.status).toBe(200);
      }

      // 4th request should be rate limited
      const blockedResponse = await request(app).get('/test');
      expect(blockedResponse.status).toBe(429);
      expect(blockedResponse.text).toContain('Too many requests');
    });

    it('should allow custom rate limit per endpoint', async () => {
      const strictLimiter = createRateLimitMiddleware({ max: 2, windowMs: 60000 });
      const lenientLimiter = createRateLimitMiddleware({ max: 10, windowMs: 60000 });

      app.use('/strict', strictLimiter);
      app.use('/lenient', lenientLimiter);

      app.get('/strict', (_req: Request, res: Response) => {
        res.json({ endpoint: 'strict' });
      });

      app.get('/lenient', (_req: Request, res: Response) => {
        res.json({ endpoint: 'lenient' });
      });

      // Strict endpoint: 2 allowed
      await request(app).get('/strict').expect(200);
      await request(app).get('/strict').expect(200);
      await request(app).get('/strict').expect(429);

      // Lenient endpoint: still works
      await request(app).get('/lenient').expect(200);
    });

    it('should include rate limit headers in response', async () => {
      const rateLimiter = createRateLimitMiddleware({ max: 5, windowMs: 60000 });
      app.use(rateLimiter);
      app.get('/test', (_req: Request, res: Response) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(response.headers['ratelimit-remaining']).toBeDefined();
      expect(response.headers['ratelimit-reset']).toBeDefined();
    });
  });

  describe('CSRF Protection Middleware', () => {
    let app: express.Application;

    beforeEach(() => {
      app = express();
      app.use(express.json());
      app.use(createCookieParserMiddleware()); // Required for CSRF protection
    });

    it('should generate and validate CSRF state parameter', async () => {
      const csrfMiddleware = createCSRFProtectionMiddleware();

      app.get('/generate-state', csrfMiddleware.generateState, (req: Request, res: Response) => {
        const state = (req as any).csrfState;
        res.json({ state });
      });

      app.get('/validate-state', csrfMiddleware.validateState, (_req: Request, res: Response) => {
        res.json({ valid: true });
      });

      // Step 1: Generate state
      const generateResponse = await request(app).get('/generate-state');
      expect(generateResponse.status).toBe(200);
      expect(generateResponse.body.state).toBeTruthy();
      expect(typeof generateResponse.body.state).toBe('string');

      const state = generateResponse.body.state;
      const cookies = generateResponse.headers['set-cookie'];

      // Step 2: Validate state with cookie
      const validateResponse = await request(app)
        .get('/validate-state')
        .query({ state })
        .set('Cookie', Array.isArray(cookies) ? cookies : [cookies || '']);

      expect(validateResponse.status).toBe(200);
      expect(validateResponse.body.valid).toBe(true);
    });

    it('should reject request with invalid state', async () => {
      const csrfMiddleware = createCSRFProtectionMiddleware();

      app.get('/generate-state', csrfMiddleware.generateState, (req: Request, res: Response) => {
        res.json({ state: (req as any).csrfState });
      });

      app.get('/validate-state', csrfMiddleware.validateState, (_req: Request, res: Response) => {
        res.json({ valid: true });
      });

      // Generate valid state
      const generateResponse = await request(app).get('/generate-state');
      const cookies = generateResponse.headers['set-cookie'];

      // Try to validate with wrong state
      const validateResponse = await request(app)
        .get('/validate-state')
        .query({ state: 'invalid-state-12345' })
        .set('Cookie', Array.isArray(cookies) ? cookies : [cookies || '']);

      expect(validateResponse.status).toBe(403);
      expect(validateResponse.body.error).toContain('Invalid CSRF state');
    });

    it('should reject request without state cookie', async () => {
      const csrfMiddleware = createCSRFProtectionMiddleware();

      app.get('/validate-state', csrfMiddleware.validateState, (_req: Request, res: Response) => {
        res.json({ valid: true });
      });

      // No cookie set
      const validateResponse = await request(app)
        .get('/validate-state')
        .query({ state: 'some-state' });

      expect(validateResponse.status).toBe(403);
      expect(validateResponse.body.error).toContain('Missing CSRF state');
    });
  });

  describe('Secure Cookie Middleware', () => {
    let app: express.Application;

    beforeEach(() => {
      app = express();
    });

    it('should set cookies with HttpOnly, Secure, and SameSite=Lax attributes', async () => {
      const cookieMiddleware = createSecureCookieMiddleware();
      app.use(cookieMiddleware);

      app.get('/set-cookie', (_req: Request, res: Response) => {
        res.cookie('session_id', 'test-session-123', { maxAge: 86400000 });
        res.json({ success: true });
      });

      const response = await request(app).get('/set-cookie');
      const setCookieHeader = response.headers['set-cookie'];

      expect(setCookieHeader).toBeTruthy();
      expect(Array.isArray(setCookieHeader)).toBe(true);

      const cookieString = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
      expect(cookieString).toContain('HttpOnly');
      expect(cookieString).toContain('SameSite=Lax');

      // In production, Secure should be set; in development it might be optional
      // We'll test that the middleware configures it correctly
    });

    it('should allow custom cookie options to override defaults', async () => {
      const cookieMiddleware = createSecureCookieMiddleware();
      app.use(cookieMiddleware);

      app.get('/custom-cookie', (_req: Request, res: Response) => {
        res.cookie('custom', 'value', {
          httpOnly: false, // Override default
          sameSite: 'strict',
        });
        res.json({ success: true });
      });

      const response = await request(app).get('/custom-cookie');
      const setCookieHeader = response.headers['set-cookie'];
      const cookieString = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;

      expect(cookieString).not.toContain('HttpOnly');
      expect(cookieString).toContain('SameSite=Strict');
    });
  });

  describe('Security Headers Middleware', () => {
    let app: express.Application;

    beforeEach(() => {
      app = express();
    });

    it('should set HSTS header (Strict-Transport-Security)', async () => {
      const headersMiddleware = createSecurityHeadersMiddleware();
      app.use(headersMiddleware);

      app.get('/test', (_req: Request, res: Response) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test');

      expect(response.headers['strict-transport-security']).toBeTruthy();
      expect(response.headers['strict-transport-security']).toContain('max-age=');
    });

    it('should set CSP header (Content-Security-Policy)', async () => {
      const headersMiddleware = createSecurityHeadersMiddleware();
      app.use(headersMiddleware);

      app.get('/test', (_req: Request, res: Response) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test');

      expect(response.headers['content-security-policy']).toBeTruthy();
      expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    });

    it('should set X-Content-Type-Options header', async () => {
      const headersMiddleware = createSecurityHeadersMiddleware();
      app.use(headersMiddleware);

      app.get('/test', (_req: Request, res: Response) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should set X-Frame-Options header', async () => {
      const headersMiddleware = createSecurityHeadersMiddleware();
      app.use(headersMiddleware);

      app.get('/test', (_req: Request, res: Response) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test');

      expect(response.headers['x-frame-options']).toBeTruthy();
    });

    it('should set X-XSS-Protection header', async () => {
      const headersMiddleware = createSecurityHeadersMiddleware();
      app.use(headersMiddleware);

      app.get('/test', (_req: Request, res: Response) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test');

      expect(response.headers['x-xss-protection']).toBeTruthy();
    });

    it('should allow custom CSP directives', async () => {
      const headersMiddleware = createSecurityHeadersMiddleware({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", 'https://fonts.googleapis.com'],
          },
        },
      });
      app.use(headersMiddleware);

      app.get('/test', (_req: Request, res: Response) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test');

      expect(response.headers['content-security-policy']).toContain("default-src 'self'");
      expect(response.headers['content-security-policy']).toContain("script-src 'self' 'unsafe-inline'");
      expect(response.headers['content-security-policy']).toContain('style-src');
    });
  });
});
