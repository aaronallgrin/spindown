-- Find a game: availability polls.
-- Run once in Supabase, SQL Editor, New query. Safe to run again.

create table if not exists polls (
  id         text primary key,
  title      text not null,
  format     text not null,
  brackets   int[] not null default '{}',   -- 0 = precon, 1-5 = bracket
  needed     int not null default 4,        -- players needed for the pod
  length_h   int not null default 3,        -- game length in hours
  start_h    int not null,                  -- first hour offered, 0-23
  end_h      int not null,                  -- last hour offered ends here, 1-24
  days       text[] not null,               -- 'YYYY-MM-DD', host's local calendar
  tz         text not null default 'America/New_York',
  location   text not null default '',
  notes      text not null default '',
  host_key   text not null,                 -- random id of the host's phone
  host_name  text not null,
  scheduled  jsonb,                         -- {date, hour, players[]} once locked in
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists poll_responses (
  poll_id    text not null references polls(id) on delete cascade,
  player_key text not null,                 -- random id of the player's phone
  name       text not null,
  slots      text[] not null default '{}',  -- 'YYYY-MM-DD|hour' blocks they can play
  updated_at timestamptz not null default now(),
  primary key (poll_id, player_key)
);

-- Same trust model as the games table: anyone with the group's anon key can read and write.
alter table polls enable row level security;
alter table poll_responses enable row level security;

drop policy if exists "group reads polls" on polls;
drop policy if exists "group writes polls" on polls;
create policy "group reads polls" on polls for select to anon using (true);
create policy "group writes polls" on polls for all to anon using (true) with check (true);

drop policy if exists "group reads responses" on poll_responses;
drop policy if exists "group writes responses" on poll_responses;
create policy "group reads responses" on poll_responses for select to anon using (true);
create policy "group writes responses" on poll_responses for all to anon using (true) with check (true);
