-- Safe to re-run — drops existing policy first if present

DROP POLICY IF EXISTS "Users manage their own push tokens" ON push_tokens;

CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  token TEXT NOT NULL,
  platform TEXT DEFAULT 'web',
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, token)
);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own push tokens" ON push_tokens FOR ALL USING (auth.uid() = user_id);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_prefs JSONB DEFAULT '{"habit_reminders":true,"appointment_reminders":true,"challenge_nudges":true,"health_alerts":true,"weekly_summary":true}'::jsonb;
