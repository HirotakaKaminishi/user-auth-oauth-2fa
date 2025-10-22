/**
 * Jest Setup - Before Imports
 *
 * This file runs BEFORE any module imports to set environment variables.
 * Using .js extension to ensure it runs before ts-jest compilation.
 */

// IMPORTANT: Set NODE_ENV FIRST before anything else
process.env.NODE_ENV = 'test';
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
process.env.APP_URL = 'http://localhost:3000';
process.env.LOG_LEVEL = 'error';
process.env.MICROSOFT_CLIENT_ID = 'test-microsoft-client-id';
process.env.MICROSOFT_CLIENT_SECRET = 'test-microsoft-client-secret';
process.env.MICROSOFT_CALLBACK_URL = 'http://localhost:3000/auth/microsoft/callback';
