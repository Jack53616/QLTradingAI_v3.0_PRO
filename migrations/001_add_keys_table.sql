-- Add keys table for activation key management
-- Migration: 001_add_keys_table.sql

CREATE TABLE IF NOT EXISTS keys (
  id SERIAL PRIMARY KEY,
  key_code TEXT NOT NULL UNIQUE,
  days INTEGER NOT NULL CHECK (days > 0),
  used BOOLEAN NOT NULL DEFAULT FALSE,
  used_by TEXT,
  used_at TIMESTAMPTZ,
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_keys_code ON keys(key_code);
CREATE INDEX IF NOT EXISTS idx_keys_used ON keys(used);
CREATE INDEX IF NOT EXISTS idx_keys_created_at ON keys(created_at);

-- Add comment
COMMENT ON TABLE keys IS 'Activation keys for user subscriptions';
COMMENT ON COLUMN keys.key_code IS 'Unique activation key in format XXXX-XXXX-XXXX-XXXX';
COMMENT ON COLUMN keys.days IS 'Number of subscription days this key provides';
COMMENT ON COLUMN keys.used IS 'Whether this key has been used';
COMMENT ON COLUMN keys.used_by IS 'Email of user who used this key';
COMMENT ON COLUMN keys.used_at IS 'Timestamp when key was used';
COMMENT ON COLUMN keys.created_by IS 'Telegram ID of admin who created this key';
