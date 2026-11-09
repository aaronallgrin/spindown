-- Push notifications: one row per phone that turned them on.
-- Run once in Supabase, SQL Editor, New query. Safe to run again.

create table if not exists push_subs (
  endpoint   text primary key,              -- the phone's push address
  player_key text not null,                 -- random id of the phone (same one polls use)
  name       text not null,                 -- who the phone belongs to
  sub        jsonb not null,                -- what the sender needs to reach it
  updated_at timestamptz not null default now()
);

-- Same trust model as games and polls. Reading a row can't send anything:
-- only the notify function holds the private key.
alter table push_subs enable row level security;
drop policy if exists "group reads push" on push_subs;
drop policy if exists "group writes push" on push_subs;
create policy "group reads push" on push_subs for select to anon using (true);
create policy "group writes push" on push_subs for all to anon using (true) with check (true);
