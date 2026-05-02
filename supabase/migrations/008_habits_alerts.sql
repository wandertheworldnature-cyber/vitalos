-- ================================================================
-- Habits + Alerts schema
-- ================================================================

-- Habit logs table
create table if not exists habit_logs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  habit_id text not null,
  date date not null,
  points integer default 5,
  completed_at timestamptz default now(),
  unique(user_id, habit_id, date)
);
alter table habit_logs enable row level security;
drop policy if exists "Users manage own habits" on habit_logs;
create policy "Users manage own habits" on habit_logs
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create index if not exists idx_habit_logs_user_date on habit_logs(user_id, date desc);

-- Health alerts table (persistent)
create table if not exists health_alerts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  type text not null,
  severity text not null check (severity in ('critical','warning','info','good')),
  title text not null,
  message text not null,
  metric text,
  risk_percent integer,
  action_steps text[],
  is_read boolean default false,
  generated_at timestamptz default now()
);
alter table health_alerts enable row level security;
drop policy if exists "Users see own alerts" on health_alerts;
create policy "Users see own alerts" on health_alerts
  for select using (auth.uid() = user_id);
create policy "Users update own alerts" on health_alerts
  for update using (auth.uid() = user_id);
create index if not exists idx_health_alerts_user on health_alerts(user_id, generated_at desc);

-- Family shared access table
create table if not exists family_access (
  id uuid default uuid_generate_v4() primary key,
  owner_id uuid references profiles(id) on delete cascade not null,
  member_id uuid references family_members(id) on delete cascade not null,
  caregiver_user_id uuid references profiles(id) on delete cascade,
  access_level text default 'view' check (access_level in ('view','full')),
  created_at timestamptz default now()
);
alter table family_access enable row level security;
create policy "Users manage family access" on family_access
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Verify
select 'habit_logs created' as status, count(*) from habit_logs;
select 'health_alerts created' as status, count(*) from health_alerts;
