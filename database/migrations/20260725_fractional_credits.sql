-- Allow fractional credits for proportional billing
ALTER TABLE users ALTER COLUMN credit_balance TYPE NUMERIC(12, 2);
ALTER TABLE credit_transactions ALTER COLUMN credits TYPE NUMERIC(12, 2);
ALTER TABLE credit_transactions ALTER COLUMN balance_after TYPE NUMERIC(12, 2);
