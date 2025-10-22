/**
 * WebAuthn API Routes
 * Task 8: API Endpoints - WebAuthn
 *
 * WebAuthn認証のルーティング設定
 */

import { Router } from 'express';
import { WebAuthnController } from '../controllers/webauthn-controller';

/**
 * Create WebAuthn routes
 *
 * Routes:
 * - POST /register/start - Start WebAuthn registration
 * - POST /register/complete - Complete WebAuthn registration
 * - POST /authenticate/start - Start WebAuthn authentication
 * - POST /authenticate/complete - Complete WebAuthn authentication
 * - GET /credentials - Get user's credentials
 * - DELETE /credentials/:id - Delete a credential
 * - PATCH /credentials/:id - Update credential name
 */
export function createWebAuthnRoutes(webAuthnController: WebAuthnController): Router {
  const router = Router();

  // Registration routes
  router.post(
    '/register/start',
    (req, res) => webAuthnController.registerStart(req, res)
  );
  router.post(
    '/register/complete',
    (req, res) => webAuthnController.registerComplete(req, res)
  );

  // Authentication routes
  router.post(
    '/authenticate/start',
    (req, res) => webAuthnController.authenticateStart(req, res)
  );
  router.post(
    '/authenticate/complete',
    (req, res) => webAuthnController.authenticateComplete(req, res)
  );

  // Credential management routes
  router.get(
    '/credentials',
    (req, res) => webAuthnController.getCredentials(req, res)
  );
  router.delete(
    '/credentials/:id',
    (req, res) => webAuthnController.deleteCredential(req, res)
  );
  router.patch(
    '/credentials/:id',
    (req, res) => webAuthnController.updateCredentialName(req, res)
  );

  return router;
}
