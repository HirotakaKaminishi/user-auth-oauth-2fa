-- Migration: Create audit_logs table
-- Author: Auth System
-- Date: 2025-10-19

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(100) NOT NULL,
  ip_address INET NOT NULL,
  user_agent TEXT,
  metadata JSONB,
  result VARCHAR(20) NOT NULL,
  CONSTRAINT valid_result CHECK (result IN ('success', 'failure', 'error'))
);

-- Create indexes for audit_logs table
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_event ON audit_logs(event_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_result ON audit_logs(result, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_ip ON audit_logs(ip_address, timestamp DESC);

-- Add comments
COMMENT ON TABLE audit_logs IS 'Audit trail for all authentication events';
COMMENT ON COLUMN audit_logs.event_type IS 'Event type (oauth_login_success, 2fa_failure, etc.)';
COMMENT ON COLUMN audit_logs.metadata IS 'Additional event data in JSON format';
COMMENT ON COLUMN audit_logs.result IS 'Event result: success, failure, or error';
