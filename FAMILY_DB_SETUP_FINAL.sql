-- family_members already has: id, user_id, name, relation, age, gender, avatar_color, created_at
-- Add only the missing columns for elderly care + emergency profile features:

ALTER TABLE family_members ADD COLUMN IF NOT EXISTS is_elderly BOOLEAN DEFAULT false;
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS linked_email TEXT;
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS linked_user_id UUID REFERENCES profiles(id);
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS health_score INTEGER;
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS emergency_profile JSONB;
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_family_members_user ON family_members(user_id);
