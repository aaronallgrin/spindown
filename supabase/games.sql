-- Saved games for cloud sync.
-- Run once in the Supabase SQL Editor. Safe to run again, including on the existing
-- project: it only creates what's missing and tightens who can delete.

create table if not exists public.games (
  id         text primary key,
  data       jsonb not null,                -- the whole GameRecord, minus the local synced flag
  deleted    boolean not null default false, -- deletes are soft so every phone hears about them
  updated_at timestamptz not null default now()
);

create index if not exists games_updated_at_idx on public.games (updated_at, id);

-- Same trust model as polls: anyone with the group's key can read and save games.
alter table public.games enable row level security;

drop policy if exists "group reads games" on public.games;
drop policy if exists "group adds games" on public.games;
drop policy if exists "group updates games" on public.games;
create policy "group reads games" on public.games for select to anon using (true);
create policy "group adds games" on public.games for insert to anon with check (true);
create policy "group updates games" on public.games for update to anon using (true) with check (true);

-- The app never hard-deletes a game (it marks deleted = true), so nobody using the
-- public key can either. A bad actor can still mark games deleted, but the row and its
-- data stay put, and the nightly backup (.github/workflows/backup.yml) keeps a copy.
revoke delete on public.games from anon, authenticated;

-- server clock for updated_at: see games_updated_at.sql
