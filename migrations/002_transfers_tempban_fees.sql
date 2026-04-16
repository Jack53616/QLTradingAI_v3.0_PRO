-- Migration 002: Add transfers table and temp ban support
-- Fee columns (fee_amount, fee_rate, net_amount) already exist on requests table

-- 1. Transfers table (user-to-user transfers with admin approval)
CREATE TABLE IF NOT EXISTS transfers (
  id SERIAL PRIMARY KEY,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_transfers_sender ON transfers(sender_id);
CREATE INDEX IF NOT EXISTS idx_transfers_receiver ON transfers(receiver_id);
CREATE INDEX IF NOT EXISTS idx_transfers_status ON transfers(status);

-- 2. Temp ban support (auto-expiry)
ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_expires TIMESTAMPTZ;
