-- Migration: Create webauthn_credentials table
-- Author: Auth System
-- Date: 2025-10-20
-- Purpose: FIDO2/WebAuthn認証器管理テーブル

-- Create webauthn_credentials table
CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  transports TEXT[],
  device_name VARCHAR(255) NOT NULL DEFAULT 'Unknown Device',
  aaguid VARCHAR(36),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT counter_positive CHECK (counter >= 0)
);

-- Create indexes for webauthn_credentials table
CREATE INDEX IF NOT EXISTS idx_webauthn_user ON webauthn_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_webauthn_credential_id ON webauthn_credentials(credential_id);
CREATE INDEX IF NOT EXISTS idx_webauthn_last_used ON webauthn_credentials(last_used_at DESC);

-- Add comments
COMMENT ON TABLE webauthn_credentials IS 'FIDO2/WebAuthn authenticator credentials';
COMMENT ON COLUMN webauthn_credentials.credential_id IS 'Base64URL encoded credential ID from authenticator';
COMMENT ON COLUMN webauthn_credentials.public_key IS 'Base64URL encoded public key for signature verification';
COMMENT ON COLUMN webauthn_credentials.counter IS 'Signature counter for replay attack prevention (monotonic)';
COMMENT ON COLUMN webauthn_credentials.transports IS 'Supported transports: usb, nfc, ble, internal';
COMMENT ON COLUMN webauthn_credentials.device_name IS 'User-defined device name (e.g., "iPhone 15 - Face ID")';
COMMENT ON COLUMN webauthn_credentials.aaguid IS 'Authenticator Attestation GUID';
