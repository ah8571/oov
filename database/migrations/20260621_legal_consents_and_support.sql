DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'users'
      AND column_name = 'terms_accepted_at'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'users'
      AND column_name = 'term_and_privacy_accepted_at'
  ) THEN
    ALTER TABLE users RENAME COLUMN terms_accepted_at TO term_and_privacy_accepted_at;
  END IF;
END $$;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS term_and_privacy_accepted_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS marketing_consent_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE users DROP COLUMN IF EXISTS terms_version;
ALTER TABLE users DROP COLUMN IF EXISTS privacy_version;
ALTER TABLE users DROP COLUMN IF EXISTS privacy_tier;
ALTER TABLE users DROP COLUMN IF EXISTS consent_source;
ALTER TABLE users DROP COLUMN IF EXISTS consent_user_agent;
ALTER TABLE users DROP COLUMN IF EXISTS privacy_accepted_at;
ALTER TABLE users DROP COLUMN IF EXISTS terms_consent_text;
ALTER TABLE users DROP COLUMN IF EXISTS privacy_consent_text;
ALTER TABLE users DROP COLUMN IF EXISTS marketing_policy_version;
ALTER TABLE users DROP COLUMN IF EXISTS marketing_consent_text;

CREATE TABLE IF NOT EXISTS support_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  account_email VARCHAR(255),
  name VARCHAR(255),
  email VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  source VARCHAR(100) NOT NULL DEFAULT 'support_page',
  category VARCHAR(100) NOT NULL DEFAULT 'general',
  status VARCHAR(30) NOT NULL DEFAULT 'open',
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS account_deletion_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  email VARCHAR(255) NOT NULL,
  reason TEXT,
  source VARCHAR(100) NOT NULL DEFAULT 'mobile_settings',
  status VARCHAR(30) NOT NULL DEFAULT 'completed',
  user_agent TEXT,
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_support_requests_email ON support_requests (email);
CREATE INDEX IF NOT EXISTS idx_support_requests_created_at ON support_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_email ON account_deletion_requests (email);