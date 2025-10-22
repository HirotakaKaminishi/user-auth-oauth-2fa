-- Migration: Create users table
-- Author: Auth System
-- Date: 2025-10-19

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  name VARCHAR(255) NOT NULL,
  picture TEXT,
  account_status VARCHAR(20) NOT NULL DEFAULT 'active',
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_status CHECK (account_status IN ('active', 'locked', 'suspended'))
);

-- Create indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(account_status);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- Add comment to table
COMMENT ON TABLE users IS 'User accounts with OAuth authentication';
COMMENT ON COLUMN users.id IS 'Unique user identifier (UUID)';
COMMENT ON COLUMN users.email IS 'User email address (unique)';
COMMENT ON COLUMN users.email_verified IS 'Whether email has been verified by OAuth provider';
COMMENT ON COLUMN users.account_status IS 'Account status: active, locked, or suspended';
COMMENT ON COLUMN users.failed_login_attempts IS 'Counter for failed 2FA attempts';
COMMENT ON COLUMN users.locked_until IS 'Account unlock timestamp after failed attempts';
