-- Migration: Create two_factor_credentials table
-- Author: Auth System
-- Date: 2025-10-19

-- Create two_factor_credentials table
CREATE TABLE IF NOT EXISTS two_factor_credentials (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  secret_encrypted TEXT,
  recovery_codes_hashed TEXT[],
  enrolled_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1
);

-- Add comments
COMMENT ON TABLE two_factor_credentials IS 'Two-factor authentication credentials (TOTP)';
COMMENT ON COLUMN two_factor_credentials.enabled IS 'Whether 2FA is enabled for this user';
COMMENT ON COLUMN two_factor_credentials.secret_encrypted IS 'Encrypted TOTP secret (AES-256-GCM)';
COMMENT ON COLUMN two_factor_credentials.recovery_codes_hashed IS 'Hashed recovery codes (bcrypt)';
COMMENT ON COLUMN two_factor_credentials.version IS 'Version for optimistic locking';
