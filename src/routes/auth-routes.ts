import { Router } from 'express';
import { OAuthController } from '../controllers/oauth-controller';

/**
 * Create authentication routes
 *
 * Routes:
 * - GET /oauth/:provider/login - Initiate OAuth login
 * - GET /oauth/:provider/callback - Handle OAuth callback
 * - GET /me - Get current user info
 * - POST /logout - Logout
 */
export function createAuthRoutes(oauthController: OAuthController): Router {
  const router = Router();

  // OAuth routes
  router.get('/oauth/:provider/login', (req, res) => oauthController.login(req, res));
  router.get('/oauth/:provider/callback', (req, res) => oauthController.callback(req, res));

  // User routes
  router.get('/me', (req, res) => oauthController.me(req, res));
  router.post('/logout', (req, res) => oauthController.logout(req, res));

  return router;
}
