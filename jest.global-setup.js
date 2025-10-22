/**
 * Jest Global Setup
 *
 * This runs BEFORE ANY module loading or compilation.
 * Perfect for setting environment variables that need to be available
 * before TypeScript modules are compiled and executed.
 */

module.exports = async () => {
  // Set NODE_ENV first
  process.env.NODE_ENV = 'test';

  // Set all required environment variables for tests
  process.env.DB_HOST = 'localhost';
  process.env.DB_PORT = '5432';
  process.env.DB_NAME = 'auth_db_test';
  process.env.DB_USER = 'test_user';
  process.env.DB_PASSWORD = 'test_password';
  process.env.REDIS_HOST = 'localhost';
  process.env.REDIS_PORT = '6379';
  process.env.SESSION_SECRET = 'test-session-secret-min-32-chars-long!!';
  process.env.ENCRYPTION_KEY = 'test-encryption-key-must-be-at-least-32-chars-long!!';
  process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
  process.env.GOOGLE_CALLBACK_URL = 'http://localhost:3000/auth/google/callback';
  process.env.GITHUB_CLIENT_ID = 'test-github-client-id';
  process.env.GITHUB_CLIENT_SECRET = 'test-github-client-secret';
  process.env.GITHUB_CALLBACK_URL = 'http://localhost:3000/auth/github/callback';
  process.env.MICROSOFT_CLIENT_ID = 'test-microsoft-client-id';
  process.env.MICROSOFT_CLIENT_SECRET = 'test-microsoft-client-secret';
  process.env.MICROSOFT_CALLBACK_URL = 'http://localhost:3000/auth/microsoft/callback';
  process.env.APP_URL = 'http://localhost:3000';
  process.env.LOG_LEVEL = 'error';

  console.error('[GLOBAL-SETUP] Environment variables set for testing');
};
