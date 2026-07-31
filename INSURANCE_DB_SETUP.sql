-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS insurance_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL,
  policy_number TEXT NOT NULL,
  policy_type TEXT,
  sum_insured NUMERIC,
  premium NUMERIC,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  document_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS insurance_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  policy_id UUID REFERENCES insurance_policies(id) ON DELETE CASCADE,
  claim_number TEXT,
  amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'submitted',
  hospital TEXT,
  date_of_service DATE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE insurance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own policies" ON insurance_policies FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage their own claims" ON insurance_claims FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_insurance_policies_user ON insurance_policies(user_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_user ON insurance_claims(user_id);
