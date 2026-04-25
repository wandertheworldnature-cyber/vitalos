-- ================================================================
-- Fix for email testing + doctor login check
-- ================================================================

-- Ensure doctor_email column exists (already in 006 but run safely)
alter table doctors add column if not exists doctor_email text;
alter table doctors add column if not exists doctor_phone text;
alter table doctors add column if not exists notify_by_email boolean default true;
alter table doctors add column if not exists notify_by_whatsapp boolean default false;

-- Create index for fast doctor login lookup
create index if not exists idx_doctors_email on doctors(doctor_email);

-- VIEW: Let doctors see their own appointments
-- Doctors authenticate as regular users but their email matches doctor_email
-- We need a policy that allows reading appointments where doctor_id matches

-- Helper: get doctor id from current user's email
create or replace function get_doctor_id_for_current_user()
returns uuid language sql security definer as $$
  select id from doctors where doctor_email = (
    select email from auth.users where id = auth.uid()
  ) limit 1;
$$;

-- Policy: Doctors can read their own appointments  
drop policy if exists "Doctors view own appointments" on appointments;
create policy "Doctors view own appointments" on appointments
  for select using (
    doctor_id = get_doctor_id_for_current_user()
    OR auth.uid() = user_id
    OR auth.uid() in (select id from admin_users)
  );

-- Policy: Doctors can update their own appointments (mark complete etc)
drop policy if exists "Doctors update own appointments" on appointments;
create policy "Doctors update own appointments" on appointments
  for update using (
    doctor_id = get_doctor_id_for_current_user()
    OR auth.uid() = user_id
    OR auth.uid() in (select id from admin_users)
  );

-- Patients can insert appointments
drop policy if exists "Users book appointments" on appointments;
create policy "Users book appointments" on appointments
  for insert with check (auth.uid() = user_id);

-- Doctors can read health records of their patients
-- (patients who have appointments with them)
drop policy if exists "Doctors read patient records" on health_records;
create policy "Doctors read patient records" on health_records
  for select using (
    auth.uid() = user_id
    OR auth.uid() in (select id from admin_users)
    OR user_id in (
      select user_id from appointments
      where doctor_id = get_doctor_id_for_current_user()
    )
  );

-- Verify setup
select 'Doctors with email set:' as info, count(*) from doctors where doctor_email is not null;
select 'doctor_slots columns:' as info, column_name
  from information_schema.columns where table_name = 'doctor_slots';
