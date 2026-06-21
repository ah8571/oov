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
  consent_source VARCHAR(100),
  consent_user_agent TEXT,
  terms_accepted_at TIMESTAMP WITH TIME ZONE,
  privacy_accepted_at TIMESTAMP WITH TIME ZONE,
  terms_version VARCHAR(50),
  privacy_version VARCHAR(50),
  terms_consent_text TEXT,
  privacy_consent_text TEXT,
  marketing_consent_at TIMESTAMP WITH TIME ZONE,
  marketing_policy_version VARCHAR(50),
  marketing_consent_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  privacy_tier VARCHAR(50) DEFAULT 'tier1'
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS marketing_opt_in BOOLEAN DEFAULT FALSE;

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
