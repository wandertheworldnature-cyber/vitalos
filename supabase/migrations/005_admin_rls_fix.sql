-- ============================================================
-- Fix Admin RLS — Run in Supabase SQL Editor
-- Allows admins to see ALL users, not just themselves
-- ============================================================

-- Drop old restrictive policy
drop policy if exists "Users see own profile" on profiles;
drop policy if exists "Admins view all profiles" on profiles;

-- Allow users to see their own profile
create policy "Users see own profile" on profiles
  for select using (auth.uid() = id);

-- Allow admins to see ALL profiles
create policy "Admins view all profiles" on profiles
  for select using (
    auth.uid() in (select id from admin_users)
  );

-- Allow users to update their own profile
drop policy if exists "Users update own profile" on profiles;
create policy "Users update own profile" on profiles
  for update using (auth.uid() = id);

-- Allow admins to update any profile (e.g., change plan)
drop policy if exists "Admins update profiles" on profiles;
create policy "Admins update profiles" on profiles
  for update using (
    auth.uid() in (select id from admin_users)
  );

-- Verify: check your admin is set up
select id, email, role from admin_users;
select count(*) as total_users from profiles;
