-- Stamp every saved or deleted game with the server's clock instead of the phone's.
-- Sync downloads "everything changed since the last download" by updated_at, so a
-- phone whose clock runs behind could otherwise upload games the others never see.
-- Run once in the Supabase SQL Editor. Safe to run again.

create or replace function public.games_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists games_touch_updated_at on public.games;
create trigger games_touch_updated_at
  before insert or update on public.games
  for each row execute function public.games_touch_updated_at();
