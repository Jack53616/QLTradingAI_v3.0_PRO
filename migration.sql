-- Migration helper for aligning existing databases with the new QL Wallet backend

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'tg_id') THEN
    ALTER TABLE users ADD COLUMN tg_id BIGINT UNIQUE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'password_hash') THEN
    ALTER TABLE users ADD COLUMN password_hash TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'lang') THEN
    ALTER TABLE users ADD COLUMN lang TEXT NOT NULL DEFAULT 'en';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'role') THEN
    ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'status') THEN
    ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'verified') THEN
    ALTER TABLE users ADD COLUMN verified BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'sub_days') THEN
    ALTER TABLE users ADD COLUMN sub_days INTEGER NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'subscription_expires') THEN
    ALTER TABLE users ADD COLUMN subscription_expires TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'last_login') THEN
    ALTER TABLE users ADD COLUMN last_login TIMESTAMPTZ;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'symbol') THEN
    ALTER TABLE trades ADD COLUMN symbol TEXT NOT NULL DEFAULT 'BTCUSDT';
    ALTER TABLE trades ALTER COLUMN symbol DROP DEFAULT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'side') THEN
    ALTER TABLE trades ADD COLUMN side TEXT NOT NULL DEFAULT 'buy';
    ALTER TABLE trades ALTER COLUMN side DROP DEFAULT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'entry_price') THEN
    ALTER TABLE trades ADD COLUMN entry_price NUMERIC(18,8) NOT NULL DEFAULT 0;
    ALTER TABLE trades ALTER COLUMN entry_price DROP DEFAULT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'tp') THEN
    ALTER TABLE trades ADD COLUMN tp NUMERIC(18,8);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'sl') THEN
    ALTER TABLE trades ADD COLUMN sl NUMERIC(18,8);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'status') THEN
    ALTER TABLE trades ADD COLUMN status TEXT NOT NULL DEFAULT 'open';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'result') THEN
    ALTER TABLE trades ADD COLUMN result NUMERIC(18,8);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'profit') THEN
    ALTER TABLE trades ADD COLUMN profit NUMERIC(18,2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'closed_price') THEN
    ALTER TABLE trades ADD COLUMN closed_price NUMERIC(18,8);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'metadata') THEN
    ALTER TABLE trades ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS admin_logs (
  id SERIAL PRIMARY KEY,
  admin_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  target_user_id BIGINT,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
