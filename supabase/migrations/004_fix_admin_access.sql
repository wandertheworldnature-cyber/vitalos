-- ============================================================
-- Fix Admin Access
-- Run this in Supabase SQL Editor
-- ============================================================

-- Step 1: Create admin_users table if it doesn't exist yet
create table if not exists admin_users (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  role text default 'admin' check (role in ('admin', 'super_admin')),
  created_at timestamptz default now()
);

alter table admin_users enable row level security;

-- Drop existing policies to avoid conflicts
drop policy if exists "Admins see admin table" on admin_users;

-- Allow admins to read admin table (needed for login check)
create policy "Admins see admin table" on admin_users
  for select using (true);  -- allow any authenticated user to check if they're admin

-- Step 2: Create health_products if not exists
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
drop policy if exists "Anyone can view products" on health_products;
drop policy if exists "Admins manage products" on health_products;
create policy "Anyone can view products" on health_products for select using (true);
create policy "Admins manage products" on health_products for all
  using (auth.uid() in (select id from admin_users))
  with check (auth.uid() in (select id from admin_users));

-- Step 3: Create announcements if not exists
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
drop policy if exists "Anyone can view active announcements" on announcements;
drop policy if exists "Admins manage announcements" on announcements;
create policy "Anyone can view active announcements" on announcements for select using (true);
create policy "Admins manage announcements" on announcements for all
  using (auth.uid() in (select id from admin_users))
  with check (auth.uid() in (select id from admin_users));

-- Step 4: Fix doctors table policy (admins can manage)
drop policy if exists "Admins manage doctors" on doctors;
create policy "Admins manage doctors" on doctors for all
  using (auth.uid() in (select id from admin_users))
  with check (auth.uid() in (select id from admin_users));

-- Step 5: Fix appointments policy
drop policy if exists "Admins view all appointments" on appointments;
create policy "Admins view all appointments" on appointments for select
  using (auth.uid() in (select id from admin_users));

-- ============================================================
-- MAKE YOURSELF ADMIN (run this separately with your email)
-- ============================================================
-- Replace 'appireddy.vidusolutions@gmail.com' with your email:

insert into admin_users (id, email, role)
select id, email, 'super_admin'
from profiles
where email = 'appireddy.vidusolutions@gmail.com'
on conflict (id) do update set role = 'super_admin';

-- Verify it worked:
select id, email, role from admin_users;
