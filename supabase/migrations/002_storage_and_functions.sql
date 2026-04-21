-- ================================================================
-- VitalOS Storage Setup
-- Run in Supabase SQL editor after 001_initial_schema.sql
-- ================================================================

-- Create storage bucket for health reports
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'health-reports',
  'health-reports',
  true,
  10485760, -- 10MB limit
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- RLS policies for health-reports bucket
create policy "Users upload own reports"
  on storage.objects for insert
  with check (bucket_id = 'health-reports' AND auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users view own reports"
  on storage.objects for select
  using (bucket_id = 'health-reports' AND auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users delete own reports"
  on storage.objects for delete
  using (bucket_id = 'health-reports' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ================================================================
-- Helper function: get latest metrics per test (used by dashboard)
-- ================================================================
create or replace function get_latest_metrics(p_user_id uuid)
returns table (
  id uuid,
  user_id uuid,
  test_name text,
  value numeric,
  unit text,
  reference_min numeric,
  reference_max numeric,
  source text,
  recorded_at timestamptz,
  created_at timestamptz
)
language sql
security definer
as $$
  select distinct on (test_name)
    id, user_id, test_name, value, unit, reference_min, reference_max, source, recorded_at, created_at
  from health_records
  where user_id = p_user_id
  order by test_name, recorded_at desc;
$$;
