-- ============================================
-- Migration Script for QL Trading AI v3.0 PRO
-- Run this on your Render database
-- ============================================

-- Add missing columns to trades table if they don't exist
DO $$ 
BEGIN
    -- Add pair column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='trades' AND column_name='pair') THEN
        ALTER TABLE trades ADD COLUMN pair TEXT NOT NULL DEFAULT 'XAUUSD';
        ALTER TABLE trades ALTER COLUMN pair DROP DEFAULT;
    END IF;

    -- Add type column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='trades' AND column_name='type') THEN
        ALTER TABLE trades ADD COLUMN type TEXT NOT NULL DEFAULT 'Buy';
        ALTER TABLE trades ALTER COLUMN type DROP DEFAULT;
        ALTER TABLE trades ADD CONSTRAINT trades_type_check 
            CHECK (type IN ('Buy', 'Sell', 'Daily', 'Hourly'));
    END IF;

    -- Add amount column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='trades' AND column_name='amount') THEN
        ALTER TABLE trades ADD COLUMN amount NUMERIC NOT NULL DEFAULT 100 CHECK (amount > 0);
        ALTER TABLE trades ALTER COLUMN amount DROP DEFAULT;
    END IF;

    -- Add profit column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='trades' AND column_name='profit') THEN
        ALTER TABLE trades ADD COLUMN profit NUMERIC NOT NULL DEFAULT 0;
        ALTER TABLE trades ALTER COLUMN profit DROP DEFAULT;
    END IF;

    -- Add opened_at column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='trades' AND column_name='opened_at') THEN
        ALTER TABLE trades ADD COLUMN opened_at TIMESTAMPTZ DEFAULT NOW() NOT NULL;
    END IF;

    -- Add closed_at column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='trades' AND column_name='closed_at') THEN
        ALTER TABLE trades ADD COLUMN closed_at TIMESTAMPTZ;
    END IF;
END $$;

-- Add missing columns to requests table if they don't exist
DO $$ 
BEGIN
    -- Add method column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='requests' AND column_name='method') THEN
        ALTER TABLE requests ADD COLUMN method TEXT NOT NULL DEFAULT 'USDT-TRC20';
        ALTER TABLE requests ALTER COLUMN method DROP DEFAULT;
        ALTER TABLE requests ADD CONSTRAINT requests_method_check 
            CHECK (method IN ('USDT-TRC20', 'BTC', 'ETH', 'Bank', 'PayPal'));
    END IF;

    -- Add address column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='requests' AND column_name='address') THEN
        ALTER TABLE requests ADD COLUMN address TEXT;
    END IF;

    -- Add amount column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='requests' AND column_name='amount') THEN
        ALTER TABLE requests ADD COLUMN amount NUMERIC NOT NULL DEFAULT 10 CHECK (amount > 0);
        ALTER TABLE requests ALTER COLUMN amount DROP DEFAULT;
    END IF;

    -- Add status column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='requests' AND column_name='status') THEN
        ALTER TABLE requests ADD COLUMN status TEXT DEFAULT 'pending';
        ALTER TABLE requests ADD CONSTRAINT requests_status_check 
            CHECK (status IN ('pending', 'approved', 'rejected', 'processing'));
    END IF;

    -- Add created_at column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='requests' AND column_name='created_at') THEN
        ALTER TABLE requests ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL;
    END IF;

    -- Add processed_at column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='requests' AND column_name='processed_at') THEN
        ALTER TABLE requests ADD COLUMN processed_at TIMESTAMPTZ;
    END IF;

    -- Add notes column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='requests' AND column_name='notes') THEN
        ALTER TABLE requests ADD COLUMN notes TEXT;
    END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_trades_pair ON trades(pair);
CREATE INDEX IF NOT EXISTS idx_trades_opened_at ON trades(opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_closed_at ON trades(closed_at DESC);

CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at DESC);

-- Success message
DO $$ 
BEGIN
    RAISE NOTICE '✅ Migration completed successfully!';
END $$;
