-- AP Activity Scheduler — Supabase schema
-- Run this once in the Supabase SQL editor: https://supabase.com/dashboard/project/_/sql

-- Facilitators (previously called staff_members — table name kept for backward compat)
create table if not exists staff_members (
  id   uuid primary key default gen_random_uuid(),
  name text not null unique
);

-- Schedule entries
create table if not exists schedule_entries (
  id           uuid primary key default gen_random_uuid(),
  week_start   date not null,
  activity     text not null,
  day          text not null,
  start_time   text not null default '09:00',
  end_time     text not null default '10:00',
  group_name   text not null default '',
  facilitators text[] not null default '{}',
  notes        text not null default '',
  created_at   timestamptz default now()
);

-- If upgrading from the old schema with `staff text`, run:
--   alter table schedule_entries add column if not exists facilitators text[] not null default '{}';
--   update schedule_entries set facilitators = array[staff] where staff <> '' and facilitators = '{}';
--   alter table schedule_entries drop column if exists staff;

create index if not exists idx_schedule_week on schedule_entries (week_start);
create index if not exists idx_schedule_day_time on schedule_entries (day, start_time);

-- Reusable weekly templates (a saved snapshot of entries applied to any week)
create table if not exists schedule_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  entries     jsonb not null default '[]'::jsonb,
  created_at  timestamptz default now()
);

-- Allow the anon key (used by the frontend) full read/write access.
-- This is appropriate for a private internal team tool with no public access.
alter table staff_members      enable row level security;
alter table schedule_entries   enable row level security;
alter table schedule_templates enable row level security;

create policy "anon full access" on staff_members
  for all to anon using (true) with check (true);

create policy "anon full access" on schedule_entries
  for all to anon using (true) with check (true);

create policy "anon full access" on schedule_templates
  for all to anon using (true) with check (true);

-- Optional: seed a few starter facilitators (edit names as needed).
insert into staff_members (name) values
  ('Facilitator 1'),
  ('Facilitator 2'),
  ('Facilitator 3')
on conflict (name) do nothing;
