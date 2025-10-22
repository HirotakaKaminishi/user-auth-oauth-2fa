import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import path from 'path';
import { createClient } from 'redis';
import Redis from 'ioredis';
import { Pool } from 'pg';
import { OAuthStrategyRegistry } from './oauth/strategy-registry';
// import { GoogleOAuthStrategy } from './oauth/google-oauth-strategy'; // Disabled: GCP account required
import { GitHubOAuthStrategy } from './oauth/github-oauth-strategy';
import { MicrosoftOAuthStrategy } from './oauth/microsoft-oauth-strategy';
import { EncryptionService } from './services/encryption-service';
import { PostgresUserRepository } from './repositories/postgres-user-repository';
import { PostgresWebAuthnCredentialRepository } from './repositories/postgres-webauthn-credential-repository';
import { WebAuthnService } from './services/webauthn-service';
import { OAuthController } from './controllers/oauth-controller';
import { WebAuthnController } from './controllers/webauthn-controller';
import { createAuthRoutes } from './routes/auth-routes';
import { createWebAuthnRoutes } from './routes/webauthn-routes';
import {
  createSecurityHeadersMiddleware,
  createSecureCookieMiddleware,
  createCookieParserMiddleware,
} from './middleware/security';

/**
 * Development server for testing OAuth authentication
 *
 * Usage:
 * 1. Configure .env file with OAuth credentials
 * 2. Ensure PostgreSQL and Redis are running
 * 3. Run: npm run dev
 * 4. Open: http://localhost:3000/api/v1/auth/oauth/google/login
 */

// Main async function to initialize and start server
async function startServer() {
  const app = express();
  const PORT = process.env['APP_PORT'] || 3000;

  // Initialize database connection
  const pool = new Pool({
    host: process.env['DB_HOST'] || 'localhost',
    port: parseInt(process.env['DB_PORT'] || '5432'),
    database: process.env['DB_NAME'] || 'auth_db',
    user: process.env['DB_USER'] || 'auth_user',
    password: process.env['DB_PASSWORD'] || 'dev_password',
  });

  // Initialize Redis client for sessions (using 'redis' package for connect-redis compatibility)
  const sessionRedisClient = createClient({
    socket: {
      host: process.env['REDIS_HOST'] || 'localhost',
      port: parseInt(process.env['REDIS_PORT'] || '6379'),
    },
    password: process.env['REDIS_PASSWORD'] || undefined,
  });

  sessionRedisClient.on('error', (err) => console.error('❌ Session Redis Client Error:', err));
  sessionRedisClient.on('connect', () => console.log('🔄 Connecting to Session Redis...'));
  sessionRedisClient.on('ready', () => console.log('✅ Session Redis connected and ready'));

  await sessionRedisClient.connect();

  // Initialize Redis client for WebAuthn (using 'ioredis' package)
  const webauthnRedisClient = new Redis({
    host: process.env['REDIS_HOST'] || 'localhost',
    port: parseInt(process.env['REDIS_PORT'] || '6379'),
    password: process.env['REDIS_PASSWORD'] || undefined,
  });

  webauthnRedisClient.on('error', (err) => console.error('❌ WebAuthn Redis Client Error:', err));
  webauthnRedisClient.on('connect', () => console.log('🔄 Connecting to WebAuthn Redis...'));
  webauthnRedisClient.on('ready', () => console.log('✅ WebAuthn Redis connected and ready'));

  // Initialize services
  const encryptionService = new EncryptionService(
    process.env['ENCRYPTION_KEY'] || 'default-encryption-key-change-this'
  );

  const userRepository = new PostgresUserRepository(pool);

  // Initialize WebAuthn repository and service
  const webAuthnCredentialRepository = new PostgresWebAuthnCredentialRepository(pool);
  const webAuthnService = new WebAuthnService(webAuthnCredentialRepository, webauthnRedisClient);

  // Initialize OAuth strategies
  const strategyRegistry = new OAuthStrategyRegistry();

  // Google OAuth - DISABLED (GCP account required for testing)
  // if (process.env['GOOGLE_CLIENT_ID'] && process.env['GOOGLE_CLIENT_SECRET']) {
  //   const googleStrategy = new GoogleOAuthStrategy({
  //     clientId: process.env['GOOGLE_CLIENT_ID'],
  //     clientSecret: process.env['GOOGLE_CLIENT_SECRET'],
  //     redirectUri: process.env['GOOGLE_CALLBACK_URL'] || 'http://localhost:3000/api/v1/auth/oauth/google/callback',
  //   });
  //   strategyRegistry.register(googleStrategy);
  //   console.log('✅ Google OAuth registered');
  // } else {
  //   console.warn('⚠️  Google OAuth not configured (missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET)');
  // }

  // Register GitHub OAuth
  if (process.env['GITHUB_CLIENT_ID'] && process.env['GITHUB_CLIENT_SECRET']) {
    const githubStrategy = new GitHubOAuthStrategy({
      clientId: process.env['GITHUB_CLIENT_ID'],
      clientSecret: process.env['GITHUB_CLIENT_SECRET'],
      redirectUri: process.env['GITHUB_CALLBACK_URL'] || 'http://localhost:3000/api/v1/auth/oauth/github/callback',
    });
    strategyRegistry.register(githubStrategy);
    console.log('✅ GitHub OAuth registered');
  } else {
    console.warn('⚠️  GitHub OAuth not configured (missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET)');
  }

  // Register Microsoft OAuth
  if (process.env['MICROSOFT_CLIENT_ID'] && process.env['MICROSOFT_CLIENT_SECRET']) {
    const microsoftStrategy = new MicrosoftOAuthStrategy({
      clientId: process.env['MICROSOFT_CLIENT_ID'],
      clientSecret: process.env['MICROSOFT_CLIENT_SECRET'],
      redirectUri: process.env['MICROSOFT_CALLBACK_URL'] || 'http://localhost:3000/api/v1/auth/oauth/microsoft/callback',
      tenant: process.env['MICROSOFT_TENANT'] || 'common',
    });
    strategyRegistry.register(microsoftStrategy);
    console.log('✅ Microsoft OAuth registered');
  } else {
    console.warn('⚠️  Microsoft OAuth not configured (missing MICROSOFT_CLIENT_ID or MICROSOFT_CLIENT_SECRET)');
  }

  // Initialize controllers
  const oauthController = new OAuthController(strategyRegistry, encryptionService, userRepository);
  const webAuthnController = new WebAuthnController(
    webAuthnService,
    userRepository,
    process.env['WEBAUTHN_RP_NAME'] || 'Auth System',
    process.env['WEBAUTHN_RP_ID'] || 'localhost',
    process.env['WEBAUTHN_ORIGIN'] || `http://localhost:${PORT}`
  );

  // Debug middleware - log all requests
  app.use((req, _res, next) => {
    console.log(`📥 ${req.method} ${req.url}`);
    next();
  });

  // Serve static files from public directory (BEFORE security middleware to avoid CSP issues)
  const publicPath = path.join(process.cwd(), 'public');
  console.log('📁 Serving static files from:', publicPath);
  app.use(express.static(publicPath));

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(createCookieParserMiddleware());
  app.use(createSecurityHeadersMiddleware());
  app.use(createSecureCookieMiddleware());

  // Session middleware with Redis store
  // Using require to work around connect-redis type definition issues
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ConnectRedisModule = require('connect-redis');
  const RedisStore = ConnectRedisModule.RedisStore;

  app.use(
    session({
      store: new RedisStore({
        client: sessionRedisClient,
        prefix: 'sess:',
      }),
      secret: process.env['SESSION_SECRET'] || 'default-session-secret-change-this',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env['NODE_ENV'] === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      },
    })
  );

  // Routes
  app.use('/api/v1/auth', createAuthRoutes(oauthController));
  app.use('/api/v1/webauthn', createWebAuthnRoutes(webAuthnController));

  // Health check
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      providers: strategyRegistry.listProviders(),
    });
  });

  // Root endpoint with instructions
  app.get('/', (_req, res) => {
    const providers = strategyRegistry.listProviders();

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>OAuth Authentication System</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              max-width: 800px;
              margin: 50px auto;
              padding: 20px;
              line-height: 1.6;
            }
            h1 { color: #333; }
            .provider {
              display: inline-block;
              margin: 10px;
              padding: 10px 20px;
              background: #4285f4;
              color: white;
              text-decoration: none;
              border-radius: 4px;
            }
            .provider:hover {
              background: #357ae8;
            }
            .github { background: #24292e; }
            .github:hover { background: #1a1e22; }
            pre {
              background: #f5f5f5;
              padding: 15px;
              border-radius: 4px;
              overflow-x: auto;
            }
          </style>
        </head>
        <body>
          <h1>🔐 OAuth Authentication System</h1>
          <p>This is a development server for testing OAuth 2.0 authentication with PKCE.</p>

          <h2>Available Providers</h2>
          ${providers.length > 0 ? `
            ${providers.map(provider => `
              <a href="/api/v1/auth/oauth/${provider}/login" class="provider ${provider}">
                Login with ${provider.charAt(0).toUpperCase() + provider.slice(1)}
              </a>
            `).join('')}
          ` : '<p>⚠️ No OAuth providers configured. Please check your .env file.</p>'}

          <h2>WebAuthn (FIDO2) - Passwordless Authentication</h2>
          <div style="margin: 20px 0;">
            <a href="/webauthn/register.html" class="provider" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
              🔐 Register WebAuthn
            </a>
            <a href="/webauthn/authenticate.html" class="provider" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
              ✅ Authenticate
            </a>
            <a href="/webauthn/manage.html" class="provider" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
              🔑 Manage Credentials
            </a>
          </div>

          <h2>API Endpoints</h2>
          <h3>OAuth Authentication</h3>
          <ul>
            <li><code>GET /api/v1/auth/oauth/:provider/login</code> - Initiate OAuth login</li>
            <li><code>GET /api/v1/auth/oauth/:provider/callback</code> - OAuth callback</li>
            <li><code>GET /api/v1/auth/me</code> - Get current user</li>
            <li><code>POST /api/v1/auth/logout</code> - Logout</li>
          </ul>

          <h3>WebAuthn (FIDO2) Authentication</h3>
          <ul>
            <li><code>POST /api/v1/webauthn/register/start</code> - Start WebAuthn registration</li>
            <li><code>POST /api/v1/webauthn/register/complete</code> - Complete WebAuthn registration</li>
            <li><code>POST /api/v1/webauthn/authenticate/start</code> - Start WebAuthn authentication</li>
            <li><code>POST /api/v1/webauthn/authenticate/complete</code> - Complete WebAuthn authentication</li>
            <li><code>GET /api/v1/webauthn/credentials?userId=:id</code> - Get user's credentials</li>
            <li><code>DELETE /api/v1/webauthn/credentials/:id?userId=:id</code> - Delete credential</li>
            <li><code>PUT /api/v1/webauthn/credentials/:id</code> - Update credential name</li>
          </ul>

          <h3>System</h3>
          <ul>
            <li><code>GET /health</code> - Health check</li>
          </ul>

          <h2>Setup Instructions</h2>
          <p>See <code>GOOGLE-OAUTH-SETUP.md</code> for detailed setup instructions.</p>

          <h2>Test with cURL</h2>
          <pre># Health check
  curl http://localhost:${PORT}/health

  # Get current user (requires session)
  curl http://localhost:${PORT}/api/v1/auth/me \\
    -H "Cookie: connect.sid=YOUR_SESSION_ID"

  # Logout
  curl -X POST http://localhost:${PORT}/api/v1/auth/logout \\
    -H "Cookie: connect.sid=YOUR_SESSION_ID"</pre>
        </body>
      </html>
    `);
  });

  // Start server
  app.listen(PORT, () => {
    console.log(`
  ╔═══════════════════════════════════════════════════════════════╗
  ║                                                               ║
  ║  🚀 OAuth Authentication Server                              ║
  ║                                                               ║
  ║  Server:  http://localhost:${PORT}                               ║
  ║  Status:  http://localhost:${PORT}/health                        ║
  ║                                                               ║
  ║  Providers: ${strategyRegistry.listProviders().join(', ') || 'none configured'}                                        ║
  ║                                                               ║
  ╚═══════════════════════════════════════════════════════════════╝
    `);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, closing server...');
    await sessionRedisClient.quit();
    await webauthnRedisClient.quit();
    await pool.end();
    process.exit(0);
  });
}

// Start the server
startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
