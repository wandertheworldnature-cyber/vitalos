-- Run in Supabase SQL Editor to enable Family Dashboard

CREATE TABLE IF NOT EXISTS family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  relation TEXT NOT NULL,
  age INTEGER,
  is_elderly BOOLEAN DEFAULT false,
  linked_email TEXT,
  linked_user_id UUID REFERENCES profiles(id),
  health_score INTEGER,
  emergency_profile JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own family members"
  ON family_members FOR ALL
  USING (auth.uid() = owner_id);

CREATE INDEX IF NOT EXISTS idx_family_members_owner ON family_members(owner_id);
