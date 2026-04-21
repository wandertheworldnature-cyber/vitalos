-- ================================================================
-- VitalOS Supabase Schema
-- Run in Supabase SQL editor: Dashboard > SQL Editor
-- ================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── Profiles ───────────────────────────────────────────────────
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  full_name text,
  avatar_url text,
  plan text default 'basic' check (plan in ('basic','pro','premium')),
  date_of_birth date,
  gender text,
  phone text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table profiles enable row level security;
create policy "Users see own profile" on profiles for select using (auth.uid() = id);
create policy "Users update own profile" on profiles for update using (auth.uid() = id);
create policy "Users insert own profile" on profiles for insert with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ─── Family Members ─────────────────────────────────────────────
create table if not exists family_members (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  relation text not null,
  age integer,
  gender text,
  avatar_color text default '#9FE1CB',
  created_at timestamptz default now()
);

alter table family_members enable row level security;
create policy "Users manage own family" on family_members
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── Health Records ─────────────────────────────────────────────
create table if not exists health_records (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  family_member_id uuid references family_members(id) on delete set null,
  record_type text not null check (record_type in ('blood_test','wearable','manual','prescription','scan')),
  test_name text not null,
  value numeric not null,
  unit text not null,
  reference_min numeric,
  reference_max numeric,
  source text default 'manual',
  recorded_at timestamptz not null,
  created_at timestamptz default now(),
  metadata jsonb
);

alter table health_records enable row level security;
create policy "Users manage own records" on health_records
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index health_records_user_test on health_records(user_id, test_name, recorded_at desc);
create index health_records_date on health_records(user_id, recorded_at desc);

-- ─── Health Reports (uploaded PDFs) ─────────────────────────────
create table if not exists health_reports (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  family_member_id uuid references family_members(id) on delete set null,
  file_name text not null,
  file_url text not null,
  file_type text default 'application/pdf',
  ocr_status text default 'pending' check (ocr_status in ('pending','processing','done','failed')),
  ocr_text text,
  extracted_data jsonb,
  lab_name text,
  report_date date,
  created_at timestamptz default now()
);

alter table health_reports enable row level security;
create policy "Users manage own reports" on health_reports
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── AI Insights ────────────────────────────────────────────────
create table if not exists ai_insights (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  family_member_id uuid references family_members(id) on delete set null,
  severity text not null check (severity in ('critical','warning','info','good')),
  title text not null,
  description text not null,
  recommendation text not null,
  risk_reduction text,
  related_metrics text[],
  timeframe text,
  generated_at timestamptz default now()
);

alter table ai_insights enable row level security;
create policy "Users see own insights" on ai_insights
  using (auth.uid() = user_id);

-- ─── Longevity Scores ───────────────────────────────────────────
create table if not exists longevity_scores (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  score integer not null,
  change integer default 0,
  breakdown jsonb,
  computed_at timestamptz default now()
);

alter table longevity_scores enable row level security;
create policy "Users see own scores" on longevity_scores
  using (auth.uid() = user_id);

-- ─── Doctors ────────────────────────────────────────────────────
create table if not exists doctors (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  specialty text not null,
  qualifications text,
  experience_years integer,
  rating numeric(2,1) default 4.5,
  review_count integer default 0,
  avatar_url text,
  languages text[] default array['English','Hindi'],
  consultation_fee integer not null,
  bio text,
  hospital text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Public read access for doctors
alter table doctors enable row level security;
create policy "Anyone can view doctors" on doctors for select using (true);

-- ─── Appointments ───────────────────────────────────────────────
create table if not exists appointments (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  doctor_id uuid references doctors(id) not null,
  slot_date date not null,
  slot_time time not null,
  status text default 'scheduled' check (status in ('scheduled','completed','cancelled')),
  notes text,
  meeting_link text,
  created_at timestamptz default now()
);

alter table appointments enable row level security;
create policy "Users manage own appointments" on appointments
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── Payments ───────────────────────────────────────────────────
create table if not exists payments (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  razorpay_order_id text unique,
  razorpay_payment_id text,
  amount integer not null,
  currency text default 'INR',
  plan text not null,
  billing_cycle text default 'monthly',
  status text default 'created' check (status in ('created','paid','failed')),
  created_at timestamptz default now()
);

alter table payments enable row level security;
create policy "Users see own payments" on payments
  using (auth.uid() = user_id);

-- ─── Seed: Sample Doctors ────────────────────────────────────────
insert into doctors (name, specialty, qualifications, experience_years, rating, review_count, consultation_fee, bio, hospital, languages) values
  ('Dr. Priya Sharma', 'Preventive Medicine', 'MBBS, MD (Preventive & Social Medicine)', 12, 4.8, 234, 699, 'Specialist in longevity and chronic disease prevention. Former consultant at AIIMS Delhi.', 'Max Healthcare', array['English','Hindi','Telugu']),
  ('Dr. Arjun Mehta', 'Cardiologist', 'MBBS, DM (Cardiology)', 18, 4.9, 412, 999, 'Interventional cardiologist with focus on preventive cardiology and risk reduction.', 'Apollo Hospitals', array['English','Hindi','Gujarati']),
  ('Dr. Kavitha Reddy', 'Endocrinologist', 'MBBS, MD (Endocrinology)', 10, 4.7, 189, 799, 'Expert in diabetes prevention, thyroid disorders, and metabolic syndrome.', 'Yashoda Hospitals', array['English','Telugu','Kannada']),
  ('Dr. Rohit Gupta', 'Internal Medicine', 'MBBS, MD (General Medicine)', 8, 4.6, 156, 499, 'Holistic preventive health specialist focused on lifestyle medicine.', 'Fortis Healthcare', array['English','Hindi','Punjabi']);
