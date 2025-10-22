// Jest setup file for global test configuration

// Set test environment variables (most are already set by setup-before-imports.js)
// Only set values that might not be set yet
if (!process.env['ENCRYPTION_KEY'] || process.env['ENCRYPTION_KEY'].length < 32) {
  process.env['ENCRYPTION_KEY'] = 'test-encryption-key-must-be-at-least-32-chars-long!!';
}
process.env['GOOGLE_CLIENT_ID'] = 'test-google-client-id';
process.env['GOOGLE_CLIENT_SECRET'] = 'test-google-secret';
process.env['GOOGLE_CALLBACK_URL'] = 'http://localhost:3000/oauth/google/callback';
process.env['GITHUB_CLIENT_ID'] = 'test-github-client-id';
process.env['GITHUB_CLIENT_SECRET'] = 'test-github-secret';
process.env['GITHUB_CALLBACK_URL'] = 'http://localhost:3000/oauth/github/callback';
process.env['MICROSOFT_CLIENT_ID'] = 'test-microsoft-client-id';
process.env['MICROSOFT_CLIENT_SECRET'] = 'test-microsoft-secret';
process.env['MICROSOFT_CALLBACK_URL'] = 'http://localhost:3000/oauth/microsoft/callback';

// Global test timeout
jest.setTimeout(10000);

// Mock console methods to reduce test output noise
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
