-- ============================================================
-- VitalOS Admin Schema
-- Run in Supabase SQL Editor after 001 and 002
-- ============================================================

-- Admin users table
create table if not exists admin_users (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  role text default 'admin' check (role in ('admin', 'super_admin')),
  created_at timestamptz default now()
);
alter table admin_users enable row level security;
create policy "Admins see admin table" on admin_users
  for select using (auth.uid() in (select id from admin_users));

-- Health products & devices
create table if not exists health_products (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  category text not null check (category in ('wearable','supplement','device','test_kit','other')),
  brand text,
  description text,
  price numeric,
  affiliate_url text,
  image_url text,
  is_active boolean default true,
  created_at timestamptz default now()
);
alter table health_products enable row level security;
create policy "Anyone can view products" on health_products for select using (true);
create policy "Admins manage products" on health_products
  using (auth.uid() in (select id from admin_users))
  with check (auth.uid() in (select id from admin_users));

-- Doctor availability slots (admin-managed)
create table if not exists doctor_slots (
  id uuid default uuid_generate_v4() primary key,
  doctor_id uuid references doctors(id) on delete cascade,
  slot_date date not null,
  slot_time time not null,
  is_booked boolean default false,
  created_at timestamptz default now(),
  unique(doctor_id, slot_date, slot_time)
);
alter table doctor_slots enable row level security;
create policy "Anyone can view slots" on doctor_slots for select using (true);
create policy "Admins manage slots" on doctor_slots
  using (auth.uid() in (select id from admin_users))
  with check (auth.uid() in (select id from admin_users));

-- App announcements / banners
create table if not exists announcements (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  message text not null,
  type text default 'info' check (type in ('info','warning','success','promo')),
  target_plan text default 'all',
  is_active boolean default true,
  expires_at timestamptz,
  created_at timestamptz default now()
);
alter table announcements enable row level security;
create policy "Anyone can view active announcements" on announcements
  for select using (is_active = true);
create policy "Admins manage announcements" on announcements
  using (auth.uid() in (select id from admin_users))
  with check (auth.uid() in (select id from admin_users));

-- Make yourself admin (replace with your actual user ID from Supabase Auth)
-- Run this after creating your account:
-- insert into admin_users (id, email, role)
-- select id, email, 'super_admin' from profiles where email = 'your@email.com';
