-- ================================================================
-- Doctor contacts (private) + slot management
-- Run in Supabase SQL Editor
-- ================================================================

-- Add private contact fields to doctors table
alter table doctors
  add column if not exists doctor_email text,
  add column if not exists doctor_phone text,
  add column if not exists notify_by_email boolean default true,
  add column if not exists notify_by_whatsapp boolean default false;

-- Doctor slots managed by admin
create table if not exists doctor_slots (
  id uuid default uuid_generate_v4() primary key,
  doctor_id uuid references doctors(id) on delete cascade not null,
  slot_date date not null,
  slot_time time not null,
  is_available boolean default true,  -- admin can lock/unlock
  is_booked boolean default false,    -- set when appointment created
  locked_reason text,                 -- e.g. "Doctor on leave"
  created_at timestamptz default now(),
  unique(doctor_id, slot_date, slot_time)
);

alter table doctor_slots enable row level security;

-- Users can view available slots
drop policy if exists "Users view slots" on doctor_slots;
create policy "Users view slots" on doctor_slots
  for select using (true);

-- Admins can manage slots
drop policy if exists "Admins manage slots" on doctor_slots;
create policy "Admins manage slots" on doctor_slots
  for all using (auth.uid() in (select id from admin_users))
  with check (auth.uid() in (select id from admin_users));

-- Function: generate weekly slots for a doctor
create or replace function generate_doctor_slots(
  p_doctor_id uuid,
  p_start_date date,
  p_end_date date,
  p_times text[]  -- array of times like '{"09:00","09:30","10:00"}'
) returns void language plpgsql as $$
declare
  curr_date date := p_start_date;
  t text;
begin
  while curr_date <= p_end_date loop
    -- Skip Sundays (0 = Sunday)
    if extract(dow from curr_date) != 0 then
      foreach t in array p_times loop
        insert into doctor_slots (doctor_id, slot_date, slot_time, is_available)
        values (p_doctor_id, curr_date, t::time, true)
        on conflict (doctor_id, slot_date, slot_time) do nothing;
      end loop;
    end if;
    curr_date := curr_date + interval '1 day';
  end loop;
end;
$$;

-- Generate slots for next 30 days for existing doctors
-- Run this after adding a new doctor from admin panel
