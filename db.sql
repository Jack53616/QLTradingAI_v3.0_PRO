CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY,
  name TEXT,
  email TEXT,
  level TEXT DEFAULT 'Bronze',
  sub_expires TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS keys (
  id SERIAL PRIMARY KEY,
  key_code TEXT UNIQUE,
  used_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS trades (
  id SERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),
  pair TEXT,
  type TEXT,
  amount NUMERIC,
  profit NUMERIC,
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS requests (
  id SERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),
  method TEXT,
  address TEXT,
  amount NUMERIC,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
