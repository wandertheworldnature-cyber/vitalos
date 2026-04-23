-- ================================================================
-- VitalOS Fix — Run this ENTIRE script in Supabase SQL Editor
-- ================================================================

-- Step 1: Create doctor_slots table with all required columns
create table if not exists doctor_slots (
  id uuid default uuid_generate_v4() primary key,
  doctor_id uuid references doctors(id) on delete cascade not null,
  slot_date date not null,
  slot_time time not null,
  is_available boolean default true,
  is_booked boolean default false,
  locked_reason text,
  created_at timestamptz default now(),
  unique(doctor_id, slot_date, slot_time)
);

-- If table already exists, add missing columns
alter table doctor_slots add column if not exists is_available boolean default true;
alter table doctor_slots add column if not exists is_booked boolean default false;
alter table doctor_slots add column if not exists locked_reason text;

-- RLS
alter table doctor_slots enable row level security;

drop policy if exists "Users view slots" on doctor_slots;
create policy "Users view slots" on doctor_slots for select using (true);

drop policy if exists "Admins manage slots" on doctor_slots;
create policy "Admins manage slots" on doctor_slots for all
  using (auth.uid() in (select id from admin_users))
  with check (auth.uid() in (select id from admin_users));

-- Step 2: Add private doctor contact fields
alter table doctors add column if not exists doctor_email text;
alter table doctors add column if not exists doctor_phone text;
alter table doctors add column if not exists notify_by_email boolean default true;
alter table doctors add column if not exists notify_by_whatsapp boolean default false;

-- Step 3: Create health_products if missing
create table if not exists health_products (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  category text not null default 'other',
  brand text,
  description text,
  price numeric,
  affiliate_url text,
  image_url text,
  is_active boolean default true,
  created_at timestamptz default now()
);
alter table health_products enable row level security;
drop policy if exists "Anyone can view products" on health_products;
create policy "Anyone can view products" on health_products for select using (true);

-- Step 4: Create announcements if missing
create table if not exists announcements (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  message text not null,
  type text default 'info',
  target_plan text default 'all',
  is_active boolean default true,
  expires_at timestamptz,
  created_at timestamptz default now()
);
alter table announcements enable row level security;
drop policy if exists "Anyone can view active announcements" on announcements;
create policy "Anyone can view active announcements" on announcements for select using (true);

-- Step 5: Fix admin_users RLS so admin can manage everything
drop policy if exists "Admins see admin table" on admin_users;
create policy "Admins see admin table" on admin_users for select using (true);

-- Step 6: Fix profiles RLS for admin to see all users
drop policy if exists "Admins view all profiles" on profiles;
create policy "Admins view all profiles" on profiles for select
  using (auth.uid() in (select id from admin_users) or auth.uid() = id);

drop policy if exists "Admins update profiles" on profiles;
create policy "Admins update profiles" on profiles for update
  using (auth.uid() in (select id from admin_users) or auth.uid() = id);

-- Verify everything worked
select 'doctor_slots columns:' as info, column_name
from information_schema.columns
where table_name = 'doctor_slots'
order by ordinal_position;
