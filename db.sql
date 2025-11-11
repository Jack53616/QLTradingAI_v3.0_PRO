-- ============================================
-- QL Trading AI v3.0 PRO - Database Schema
-- ============================================

-- Enable UUID extension (if needed)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Users Table
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY,
  name TEXT,
  username TEXT,
  email TEXT,
  level TEXT DEFAULT 'Bronze' CHECK (level IN ('Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond')),
  balance NUMERIC DEFAULT 0 CHECK (balance >= 0),
  sub_expires TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_sub_expires ON users(sub_expires);
CREATE INDEX IF NOT EXISTS idx_users_level ON users(level);

-- ============================================
-- Subscription Keys Table
-- ============================================
CREATE TABLE IF NOT EXISTS keys (
  id SERIAL PRIMARY KEY,
  key_code TEXT UNIQUE NOT NULL,
  duration_days INTEGER DEFAULT 30 CHECK (duration_days > 0),
  level TEXT DEFAULT 'Bronze' CHECK (level IN ('Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond')),
  used_by BIGINT REFERENCES users(id) ON DELETE RESTRICT,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT check_used_consistency CHECK (
    (used_by IS NULL AND used_at IS NULL) OR 
    (used_by IS NOT NULL AND used_at IS NOT NULL)
  )
);

-- Indexes for keys table
CREATE INDEX IF NOT EXISTS idx_keys_used_by ON keys(used_by);
CREATE INDEX IF NOT EXISTS idx_keys_level ON keys(level);
CREATE INDEX IF NOT EXISTS idx_keys_created_at ON keys(created_at);

-- ============================================
-- Trades Table
-- ============================================
CREATE TABLE IF NOT EXISTS trades (
  id SERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  pair TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Buy', 'Sell', 'Daily', 'Hourly')),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  profit NUMERIC NOT NULL,
  opened_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  closed_at TIMESTAMPTZ,
  CONSTRAINT check_closed_after_opened CHECK (closed_at IS NULL OR closed_at >= opened_at)
);

-- Indexes for trades table
CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_opened_at ON trades(opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_closed_at ON trades(closed_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_pair ON trades(pair);

-- ============================================
-- Withdrawal Requests Table
-- ============================================
CREATE TABLE IF NOT EXISTS requests (
  id SERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('USDT-TRC20', 'BTC', 'ETH', 'Bank', 'PayPal')),
  address TEXT,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'processing')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  processed_at TIMESTAMPTZ,
  notes TEXT
);

-- Indexes for requests table
CREATE INDEX IF NOT EXISTS idx_requests_user_id ON requests(user_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at DESC);

-- ============================================
-- Audit Log Table (Optional but Recommended)
-- ============================================
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  user_id BIGINT,
  action TEXT NOT NULL,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for audit log
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);

-- ============================================
-- Functions and Triggers
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for users table
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Views
-- ============================================

-- Active users view
CREATE OR REPLACE VIEW active_users AS
SELECT 
  id,
  name,
  username,
  email,
  level,
  balance,
  sub_expires,
  created_at
FROM users
WHERE sub_expires > NOW();

-- Pending withdrawals view
CREATE OR REPLACE VIEW pending_withdrawals AS
SELECT 
  r.id,
  r.user_id,
  u.name,
  u.username,
  r.method,
  r.address,
  r.amount,
  r.created_at,
  u.balance as user_balance
FROM requests r
JOIN users u ON u.id = r.user_id
WHERE r.status = 'pending'
ORDER BY r.created_at ASC;

-- User statistics view
CREATE OR REPLACE VIEW user_stats AS
SELECT 
  u.id,
  u.name,
  u.username,
  u.level,
  u.balance,
  u.sub_expires,
  COUNT(DISTINCT t.id) as total_trades,
  COALESCE(SUM(t.profit), 0) as total_profit,
  COUNT(DISTINCT r.id) as total_withdrawals,
  COALESCE(SUM(CASE WHEN r.status = 'approved' THEN r.amount ELSE 0 END), 0) as total_withdrawn
FROM users u
LEFT JOIN trades t ON t.user_id = u.id
LEFT JOIN requests r ON r.user_id = u.id
GROUP BY u.id, u.name, u.username, u.level, u.balance, u.sub_expires;

-- ============================================
-- Sample Data (Optional - Remove in Production)
-- ============================================

-- Uncomment to insert sample admin user
-- INSERT INTO users (id, name, username, level, balance, sub_expires)
-- VALUES (123456789, 'Admin User', 'admin', 'Diamond', 1000, NOW() + INTERVAL '365 days')
-- ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Grants (Adjust based on your user)
-- ============================================

-- Grant permissions to your database user
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_user;

-- ============================================
-- Maintenance Queries
-- ============================================

-- Clean up expired keys (run periodically)
-- DELETE FROM keys WHERE used_by IS NULL AND created_at < NOW() - INTERVAL '90 days';

-- Clean up old audit logs (run periodically)
-- DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL '180 days';

-- Vacuum and analyze tables (run periodically)
-- VACUUM ANALYZE users;
-- VACUUM ANALYZE keys;
-- VACUUM ANALYZE trades;
-- VACUUM ANALYZE requests;

COMMIT;
