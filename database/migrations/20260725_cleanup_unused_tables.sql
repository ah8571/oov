-- Cleanup: drop unused tables, consolidate summaries into transcripts

-- Add summary columns to transcripts
ALTER TABLE transcripts
  ADD COLUMN IF NOT EXISTS summary_text TEXT,
  ADD COLUMN IF NOT EXISTS key_points TEXT[],
  ADD COLUMN IF NOT EXISTS sentiment VARCHAR(50),
  ADD COLUMN IF NOT EXISTS action_items TEXT[];

-- Migrate data from summaries into transcripts
UPDATE transcripts t
SET
  summary_text = s.summary_text,
  key_points = s.key_points,
  sentiment = s.sentiment,
  action_items = s.action_items
FROM summaries s
WHERE t.call_id = s.call_id;

-- Drop unused tables
DROP TABLE IF EXISTS summaries;
DROP TABLE IF EXISTS call_messages;
DROP TABLE IF EXISTS call_costs;
DROP TABLE IF EXISTS call_topics;
DROP TABLE IF EXISTS topics;
DROP TABLE IF EXISTS user_phone_numbers;
DROP TABLE IF EXISTS waitlist_subscribers;
DROP TABLE IF EXISTS api_keys;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS note_revisions;
