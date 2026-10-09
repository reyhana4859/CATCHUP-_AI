CREATE TABLE IF NOT EXISTS saved_briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_key TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Conversation briefing',
  recap TEXT NOT NULL DEFAULT '',
  briefing JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS saved_briefings_owner_created_idx ON saved_briefings (owner_key, created_at DESC);