ALTER TABLE users
  ADD COLUMN IF NOT EXISTS consent_source VARCHAR(100);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS consent_user_agent TEXT;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS terms_version VARCHAR(50);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS privacy_version VARCHAR(50);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS terms_consent_text TEXT;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS privacy_consent_text TEXT;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS marketing_consent_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS marketing_policy_version VARCHAR(50);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS marketing_consent_text TEXT;

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