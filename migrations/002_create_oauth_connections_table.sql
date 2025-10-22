-- Migration: Create oauth_connections table
-- Author: Auth System
-- Date: 2025-10-19

-- Create oauth_connections table
CREATE TABLE IF NOT EXISTS oauth_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  provider_id VARCHAR(255) NOT NULL,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_oauth_connection UNIQUE(provider, provider_id)
);

-- Create indexes for oauth_connections table
CREATE INDEX IF NOT EXISTS idx_oauth_user ON oauth_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_provider ON oauth_connections(provider, provider_id);
CREATE INDEX IF NOT EXISTS idx_oauth_last_used ON oauth_connections(last_used_at DESC);

-- Add comments
COMMENT ON TABLE oauth_connections IS 'OAuth provider connections for users';
COMMENT ON COLUMN oauth_connections.provider IS 'OAuth provider (google, github, microsoft)';
COMMENT ON COLUMN oauth_connections.provider_id IS 'User ID from OAuth provider';
COMMENT ON COLUMN oauth_connections.last_used_at IS 'Last time this connection was used for login';
