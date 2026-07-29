-- Run in Supabase SQL Editor to enable referral system

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referred_by TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_stats JSONB DEFAULT '{"pointsEarned":0}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON profiles(referred_by);
