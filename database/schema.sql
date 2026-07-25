-- Emmaline Database Schema for Supabase
-- PostgreSQL

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  marketing_opt_in BOOLEAN DEFAULT FALSE,
  term_and_privacy_accepted_at TIMESTAMP WITH TIME ZONE,
  marketing_consent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS marketing_opt_in BOOLEAN DEFAULT FALSE;

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

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS free_trial_seconds_granted INTEGER NOT NULL DEFAULT 300;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS prepaid_seconds_balance INTEGER NOT NULL DEFAULT 0;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS billing_state VARCHAR(30) NOT NULL DEFAULT 'trial';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS auto_recharge_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS auto_recharge_threshold_seconds INTEGER NOT NULL DEFAULT 60;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS auto_recharge_amount_seconds INTEGER NOT NULL DEFAULT 300;

-- Stripe billing (consolidated from user_billing_entitlements)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_pro_active BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_tier TEXT,
  ADD COLUMN IF NOT EXISTS stripe_status TEXT DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS stripe_updated_at TIMESTAMPTZ;

-- Promo/affiliate tracking (consolidated from promo_redemptions)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_promo_code TEXT,
  ADD COLUMN IF NOT EXISTS last_promo_credits INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_promo_redeemed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signup_promo_code TEXT,
  ADD COLUMN IF NOT EXISTS signup_promo_redeemed_at TIMESTAMPTZ;

-- Commission ledger
CREATE TABLE IF NOT EXISTS commission_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code TEXT NOT NULL,
  user_id UUID NOT NULL,
  stripe_invoice_id TEXT,
  stripe_subscription_id TEXT,
  invoice_amount_cents INTEGER NOT NULL,
  commission_rate NUMERIC(5,4) NOT NULL,
  commission_cents INTEGER NOT NULL,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Monthly commission report view
CREATE OR REPLACE VIEW monthly_commission_report
WITH (security_invoker = true) AS
SELECT
  cl.promo_code,
  pc.influencer_label,
  date_trunc('month', cl.created_at)::DATE AS month,
  COUNT(*) AS renewal_count,
  SUM(cl.invoice_amount_cents) AS total_invoice_cents,
  AVG(cl.commission_rate) AS avg_commission_rate,
  SUM(cl.commission_cents) AS total_owed_cents,
  COUNT(*) FILTER (WHERE cl.status = 'paid') AS paid_count,
  SUM(cl.commission_cents) FILTER (WHERE cl.status = 'pending') AS pending_cents,
  SUM(cl.commission_cents) FILTER (WHERE cl.status = 'paid') AS paid_cents
FROM commission_ledger cl
LEFT JOIN promo_codes pc ON pc.code = cl.promo_code
GROUP BY cl.promo_code, pc.influencer_label, date_trunc('month', cl.created_at)
ORDER BY month DESC, total_owed_cents DESC;

-- RLS: only @plantingmoon.com admins can read commission data
ALTER TABLE commission_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read commission ledger" ON commission_ledger;
CREATE POLICY "Admins can read commission ledger"
  ON commission_ledger
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.email LIKE '%@plantingmoon.com'
    )
  );

CREATE OR REPLACE FUNCTION public.upsert_user_profile_from_auth(
  auth_user_id UUID,
  auth_email TEXT,
  auth_metadata JSONB DEFAULT '{}'::jsonb,
  auth_created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  metadata JSONB := COALESCE(auth_metadata, '{}'::jsonb);
  normalized_email TEXT := LOWER(TRIM(COALESCE(auth_email, metadata->>'email', '')));
  full_name TEXT := COALESCE(metadata->>'full_name', metadata->>'name', '');
  base_username TEXT;
  username_suffix TEXT := SUBSTRING(REPLACE(auth_user_id::TEXT, '-', '') FROM 1 FOR 8);
  accepted_at TIMESTAMP WITH TIME ZONE := NULLIF(
    COALESCE(metadata->>'term_and_privacy_accepted_at', metadata->>'terms_accepted_at'),
    ''
  )::TIMESTAMP WITH TIME ZONE;
  marketing_consent_at TIMESTAMP WITH TIME ZONE := NULLIF(metadata->>'marketing_consent_at', '')::TIMESTAMP WITH TIME ZONE;
  marketing_opt_in BOOLEAN := CASE LOWER(COALESCE(metadata->>'marketing_opt_in', ''))
    WHEN 'true' THEN TRUE
    WHEN 'false' THEN FALSE
    ELSE FALSE
  END;
  generated_username TEXT;
  legacy_user RECORD;
  effective_marketing_opt_in BOOLEAN;
  effective_terms_accepted_at TIMESTAMP WITH TIME ZONE;
  effective_marketing_consent_at TIMESTAMP WITH TIME ZONE;
  effective_created_at TIMESTAMP WITH TIME ZONE;
  effective_password_hash TEXT;
BEGIN
  IF normalized_email = '' THEN
    RETURN;
  END IF;

  base_username := REGEXP_REPLACE(
    LOWER(TRIM(COALESCE(NULLIF(full_name, ''), SPLIT_PART(normalized_email, '@', 1), 'user'))),
    '[^a-z0-9_]+',
    '',
    'g'
  );

  IF base_username = '' THEN
    base_username := 'user';
  END IF;

  generated_username := LEFT(base_username, 91) || '_' || username_suffix;

  SELECT *
  INTO legacy_user
  FROM public.users
  WHERE email = normalized_email
    AND id <> auth_user_id
  LIMIT 1;

  IF FOUND THEN
    effective_marketing_opt_in := COALESCE(legacy_user.marketing_opt_in, FALSE) OR marketing_opt_in;
    effective_terms_accepted_at := COALESCE(legacy_user.term_and_privacy_accepted_at, accepted_at);
    effective_marketing_consent_at := CASE
      WHEN effective_marketing_opt_in THEN COALESCE(
        legacy_user.marketing_consent_at,
        marketing_consent_at,
        accepted_at,
        auth_created_at,
        CURRENT_TIMESTAMP
      )
      ELSE NULL
    END;
    effective_created_at := COALESCE(legacy_user.created_at, auth_created_at, CURRENT_TIMESTAMP);
    effective_password_hash := COALESCE(legacy_user.password_hash, 'supabase_auth_managed');

    INSERT INTO public.users (
      id,
      email,
      username,
      password_hash,
      marketing_opt_in,
      term_and_privacy_accepted_at,
      marketing_consent_at,
      created_at,
      updated_at
    )
    VALUES (
      auth_user_id,
      auth_user_id::TEXT || '@placeholder.emmaline.local',
      generated_username,
      effective_password_hash,
      effective_marketing_opt_in,
      effective_terms_accepted_at,
      effective_marketing_consent_at,
      effective_created_at,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (id) DO NOTHING;

    UPDATE public.user_phone_numbers SET user_id = auth_user_id WHERE user_id = legacy_user.id;
    UPDATE public.calls SET user_id = auth_user_id WHERE user_id = legacy_user.id;
    UPDATE public.transcripts SET user_id = auth_user_id WHERE user_id = legacy_user.id;
    UPDATE public.call_messages SET user_id = auth_user_id WHERE user_id = legacy_user.id;
    UPDATE public.call_costs SET user_id = auth_user_id WHERE user_id = legacy_user.id;
    UPDATE public.summaries SET user_id = auth_user_id WHERE user_id = legacy_user.id;
    UPDATE public.topics SET user_id = auth_user_id WHERE user_id = legacy_user.id;
    UPDATE public.notes SET user_id = auth_user_id WHERE user_id = legacy_user.id;
    UPDATE public.note_revisions SET user_id = auth_user_id WHERE user_id = legacy_user.id;
    UPDATE public.api_keys SET user_id = auth_user_id WHERE user_id = legacy_user.id;
    UPDATE public.audit_logs SET user_id = auth_user_id WHERE user_id = legacy_user.id;
    UPDATE public.support_requests SET user_id = auth_user_id WHERE user_id = legacy_user.id;
    UPDATE public.account_deletion_requests SET user_id = auth_user_id WHERE user_id = legacy_user.id;

    DELETE FROM public.users WHERE id = legacy_user.id;
  ELSE
    effective_marketing_opt_in := marketing_opt_in;
    effective_terms_accepted_at := accepted_at;
    effective_marketing_consent_at := CASE
      WHEN marketing_opt_in THEN COALESCE(marketing_consent_at, auth_created_at, CURRENT_TIMESTAMP)
      ELSE NULL
    END;
    effective_created_at := COALESCE(auth_created_at, CURRENT_TIMESTAMP);
    effective_password_hash := 'supabase_auth_managed';
  END IF;

  INSERT INTO public.users (
    id,
    email,
    username,
    password_hash,
    marketing_opt_in,
    term_and_privacy_accepted_at,
    marketing_consent_at,
    created_at,
    updated_at
  )
  VALUES (
    auth_user_id,
    normalized_email,
    generated_username,
    effective_password_hash,
    effective_marketing_opt_in,
    effective_terms_accepted_at,
    effective_marketing_consent_at,
    effective_created_at,
    CURRENT_TIMESTAMP
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      marketing_opt_in = EXCLUDED.marketing_opt_in,
      username = COALESCE(public.users.username, EXCLUDED.username),
      term_and_privacy_accepted_at = COALESCE(public.users.term_and_privacy_accepted_at, EXCLUDED.term_and_privacy_accepted_at),
      marketing_consent_at = CASE
        WHEN EXCLUDED.marketing_opt_in THEN COALESCE(public.users.marketing_consent_at, EXCLUDED.marketing_consent_at)
        ELSE public.users.marketing_consent_at
      END,
      updated_at = CURRENT_TIMESTAMP;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_auth_user_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.upsert_user_profile_from_auth(NEW.id, NEW.email, NEW.raw_user_meta_data, NEW.created_at);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_created();

SELECT public.upsert_user_profile_from_auth(id, email, raw_user_meta_data, created_at)
FROM auth.users
WHERE id NOT IN (
  SELECT id
  FROM public.users
);

ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS call_mode VARCHAR(30) NOT NULL DEFAULT 'live_call';

-- Dedicated phone numbers (one active assignment per user)
CREATE TABLE IF NOT EXISTS user_phone_numbers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  twilio_phone_sid VARCHAR(255) NOT NULL UNIQUE,
  phone_number VARCHAR(20) NOT NULL UNIQUE,
  friendly_name VARCHAR(255),
  status VARCHAR(30) DEFAULT 'active',
  provisioned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  released_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Calls table
CREATE TABLE calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone_number VARCHAR(20) NOT NULL,
  call_mode VARCHAR(30) NOT NULL DEFAULT 'live_call',
  call_duration_seconds INTEGER,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE,
  call_status VARCHAR(50) DEFAULT 'completed',
  twilio_call_sid VARCHAR(255) UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Transcripts table (full call transcripts)
CREATE TABLE transcripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id UUID NOT NULL UNIQUE REFERENCES calls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Call messages table (speaker-separated transcript turns)
CREATE TABLE call_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL,
  speaker VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT call_messages_speaker_check CHECK (speaker IN ('user', 'assistant', 'system')),
  CONSTRAINT call_messages_sequence_unique UNIQUE (call_id, sequence_number)
);

-- Call cost ledger (estimated provider usage and cost per call)
CREATE TABLE call_costs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pricing_tier VARCHAR(50) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  service VARCHAR(100) NOT NULL,
  quantity NUMERIC(12, 4) NOT NULL DEFAULT 0,
  unit VARCHAR(30) NOT NULL,
  vendor_cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
  billable_cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
  measurement_source VARCHAR(30) NOT NULL DEFAULT 'estimated',
  cost_source VARCHAR(30) NOT NULL DEFAULT 'rate_card',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Summaries table (AI-generated key points)
CREATE TABLE summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id UUID NOT NULL UNIQUE REFERENCES calls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  summary_text TEXT NOT NULL,
  key_points TEXT[], -- Array of bullet points
  sentiment VARCHAR(50),
  action_items TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Topics table (for organizing conversations)
CREATE TABLE topics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  color VARCHAR(7),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, name)
);

-- Notes table (user-created notes, can be linked to calls)
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
  topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_archived BOOLEAN DEFAULT FALSE
);

CREATE TABLE reader_saved_audio (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  source_text TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  content_type VARCHAR(100) NOT NULL DEFAULT 'audio/mpeg',
  audio_base64 TEXT NOT NULL,
  character_count INTEGER NOT NULL,
  chunk_count INTEGER NOT NULL,
  language_code VARCHAR(20) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE note_revisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
  edit_type VARCHAR(50) NOT NULL,
  edit_summary TEXT,
  previous_title VARCHAR(255),
  previous_content TEXT,
  new_title VARCHAR(255),
  new_content TEXT,
  source VARCHAR(50) NOT NULL DEFAULT 'app',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Call-Topic association (many-to-many)
CREATE TABLE call_topics (
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (call_id, topic_id)
);

-- API Keys table (for future integrations and access tokens)
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_hash VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(100),
  last_used TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Audit log (for privacy and security)
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id UUID,
  details JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_user_calls ON calls (user_id);
CREATE INDEX idx_user_phone_numbers_user ON user_phone_numbers (user_id);
CREATE INDEX idx_user_phone_numbers_status ON user_phone_numbers (status);
CREATE INDEX idx_call_date ON calls (started_at DESC);
CREATE INDEX idx_user_transcripts ON transcripts (user_id);
CREATE INDEX idx_call_transcript ON transcripts (call_id);
CREATE INDEX idx_call_messages_call_id ON call_messages (call_id);
CREATE INDEX idx_call_messages_user_id ON call_messages (user_id);
CREATE INDEX idx_call_costs_call_id ON call_costs (call_id);
CREATE INDEX idx_call_costs_user_id ON call_costs (user_id);
CREATE INDEX idx_user_summaries ON summaries (user_id);
CREATE INDEX idx_call_summary ON summaries (call_id);
CREATE INDEX idx_user_topics ON topics (user_id);
CREATE INDEX idx_user_notes ON notes (user_id);
CREATE INDEX idx_call_notes ON notes (call_id);
CREATE INDEX idx_topic_notes ON notes (topic_id);
CREATE INDEX idx_note_revisions_note_id ON note_revisions (note_id);
CREATE INDEX idx_note_revisions_user_id ON note_revisions (user_id);
CREATE INDEX idx_note_revisions_call_id ON note_revisions (call_id);
CREATE INDEX idx_topic_calls ON call_topics (topic_id);
CREATE INDEX idx_user_keys ON api_keys (user_id);
CREATE INDEX idx_user_audit ON audit_logs (user_id);
CREATE INDEX idx_action_audit ON audit_logs (action);
CREATE INDEX idx_audit_date ON audit_logs (created_at DESC);
CREATE INDEX idx_transcripts_full_text ON transcripts USING GIN(to_tsvector('english', full_text));
CREATE INDEX idx_summaries_full_text ON summaries USING GIN(to_tsvector('english', summary_text));

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_phone_numbers_updated_at BEFORE UPDATE ON user_phone_numbers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calls_updated_at BEFORE UPDATE ON calls
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transcripts_updated_at BEFORE UPDATE ON transcripts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_summaries_updated_at BEFORE UPDATE ON summaries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_topics_updated_at BEFORE UPDATE ON topics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) - Optional but recommended for security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reader_saved_audio ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Users can only see their own data
CREATE POLICY "Users can view their own data" ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can view their own phone numbers" ON user_phone_numbers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own calls" ON calls FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own transcripts" ON transcripts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own summaries" ON summaries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own topics" ON topics FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own notes" ON notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own note revisions" ON note_revisions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own reader audio" ON reader_saved_audio FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own audit logs" ON audit_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Waitlist subscribers
CREATE TABLE IF NOT EXISTS waitlist_subscribers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  source VARCHAR(100) DEFAULT 'landing-page',
  marketing_opt_in BOOLEAN DEFAULT FALSE,
  consent_source VARCHAR(100),
  consent_timestamp TIMESTAMP WITH TIME ZONE,
  policy_version VARCHAR(50),
  consent_user_agent TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE waitlist_subscribers ADD COLUMN IF NOT EXISTS marketing_opt_in BOOLEAN DEFAULT FALSE;
ALTER TABLE waitlist_subscribers ADD COLUMN IF NOT EXISTS consent_source VARCHAR(100);
ALTER TABLE waitlist_subscribers ADD COLUMN IF NOT EXISTS consent_timestamp TIMESTAMP WITH TIME ZONE;
ALTER TABLE waitlist_subscribers ADD COLUMN IF NOT EXISTS policy_version VARCHAR(50);
ALTER TABLE waitlist_subscribers ADD COLUMN IF NOT EXISTS consent_user_agent TEXT;

CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist_subscribers (email);
CREATE INDEX IF NOT EXISTS idx_waitlist_active ON waitlist_subscribers (is_active);

ALTER TABLE waitlist_subscribers ENABLE ROW LEVEL SECURITY;

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

CREATE INDEX IF NOT EXISTS idx_support_requests_email ON support_requests (email);
CREATE INDEX IF NOT EXISTS idx_support_requests_created_at ON support_requests (created_at DESC);

CREATE TABLE IF NOT EXISTS account_deletion_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  email VARCHAR(255) NOT NULL,
  reason TEXT,
  source VARCHAR(100) NOT NULL DEFAULT 'mobile_settings',
  status VARCHAR(30) NOT NULL DEFAULT 'completed',
  user_agent TEXT,
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_email ON account_deletion_requests (email);
