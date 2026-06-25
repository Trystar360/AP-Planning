-- AP Activity Scheduler — Supabase schema
-- Run this once in the Supabase SQL editor: https://supabase.com/dashboard/project/_/sql

-- Staff members
create table if not exists staff_members (
  id   uuid primary key default gen_random_uuid(),
  name text not null unique
);

-- Schedule entries
create table if not exists schedule_entries (
  id          uuid primary key default gen_random_uuid(),
  week_start  date not null,
  activity    text not null,
  day         text not null,
  start_time  text not null default '09:00',
  end_time    text not null default '10:00',
  group_name  text not null default '',
  staff       text not null,
  notes       text not null default '',
  created_at  timestamptz default now()
);

create index if not exists idx_schedule_week on schedule_entries (week_start);
create index if not exists idx_schedule_day_time on schedule_entries (day, start_time);

-- Allow the anon key (used by the frontend) full read/write access.
-- This is appropriate for a private internal team tool with no public access.
alter table staff_members   enable row level security;
alter table schedule_entries enable row level security;

create policy "anon full access" on staff_members
  for all to anon using (true) with check (true);

create policy "anon full access" on schedule_entries
  for all to anon using (true) with check (true);

-- Optional: seed a few starter staff members (edit names as needed).
insert into staff_members (name) values
  ('Team Member 1'),
  ('Team Member 2'),
  ('Team Member 3')
on conflict (name) do nothing;
