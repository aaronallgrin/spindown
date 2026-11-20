-- Voice fixes the group confirmed ("kodi" → "cody"), shared so every phone learns.
-- Run once in Supabase, SQL Editor, New query. Safe to run again.

create table if not exists voice_words (
  heard      text primary key,              -- what the phone heard, lowercase
  meant      text not null,                 -- the player or commander name it meant
  updated_at timestamptz not null default now()
);

-- Same trust model as games and polls: the app's public key reads and adds fixes.
-- No deleting from the app; a bad fix is changed here in the Table Editor.
alter table voice_words enable row level security;
drop policy if exists "group reads voice words" on voice_words;
drop policy if exists "group adds voice words" on voice_words;
drop policy if exists "group fixes voice words" on voice_words;
create policy "group reads voice words" on voice_words for select to anon using (true);
create policy "group adds voice words" on voice_words for insert to anon
  with check (length(heard) between 1 and 60 and length(meant) between 1 and 60);
create policy "group fixes voice words" on voice_words for update to anon using (true)
  with check (length(heard) between 1 and 60 and length(meant) between 1 and 60);
