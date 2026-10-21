-- One-off fixes for Tue Oct 20, 2026:
--   game one: Aaron was playing The Wise Mothman
--   game two: Chris won, not Tim
-- Run once in the Supabase SQL Editor. It only touches that one game and stops
-- without changing anything if the game it finds doesn't look right.
-- The updated_at trigger restamps the row, so every phone picks up the fix on its next sync.

do $$
declare
  g record;
  game_count int;
  tim_seat int;
  chris_seat int;
  new_players jsonb;
  new_events jsonb;
begin
  -- games started between noon Oct 20 and 6am Oct 21, Philadelphia time
  select count(*) into game_count
  from public.games
  where not deleted
    and to_timestamp((data->>'startedAt')::bigint / 1000.0) >= timestamptz '2026-10-20 12:00 America/New_York'
    and to_timestamp((data->>'startedAt')::bigint / 1000.0) <  timestamptz '2026-10-21 06:00 America/New_York';

  select id, data into g
  from (
    select id, data, row_number() over (order by (data->>'startedAt')::bigint) as n
    from public.games
    where not deleted
      and to_timestamp((data->>'startedAt')::bigint / 1000.0) >= timestamptz '2026-10-20 12:00 America/New_York'
      and to_timestamp((data->>'startedAt')::bigint / 1000.0) <  timestamptz '2026-10-21 06:00 America/New_York'
  ) t
  where n = 2;

  if g.id is null then
    raise exception 'Found % game(s) last night, so there is no game two. Nothing changed.', game_count;
  end if;
  if lower(trim(coalesce(g.data->>'winnerName', ''))) <> 'tim' then
    raise exception 'Game two (id %) lists % as the winner, not Tim. Nothing changed.', g.id, coalesce(g.data->>'winnerName', 'nobody');
  end if;

  select (p->>'seat')::int into tim_seat
  from jsonb_array_elements(g.data->'players') p where lower(trim(p->>'name')) = 'tim';
  select (p->>'seat')::int into chris_seat
  from jsonb_array_elements(g.data->'players') p where lower(trim(p->>'name')) = 'chris';
  if chris_seat is null then
    raise exception 'Chris is not in game two (id %). Nothing changed.', g.id;
  end if;

  -- Chris: win, no knockout. Tim: loss, still standing at the end.
  select jsonb_agg(
           case
             when (p->>'seat')::int = chris_seat then (p - 'outRound' - 'outCause') || '{"result":"win"}'
             when (p->>'seat')::int = tim_seat then p || jsonb_build_object('result', 'loss', 'outRound', (g.data->>'rounds')::int)
             else p
           end order by ord)
    into new_players
  from jsonb_array_elements(g.data->'players') with ordinality as e(p, ord);

  -- move the win to Chris in the game log and drop any knockout logged for him
  select coalesce(jsonb_agg(
           case when ev->>'kind' = 'win' then jsonb_set(ev, '{seat}', to_jsonb(chris_seat)) else ev end
           order by ord), '[]'::jsonb)
    into new_events
  from jsonb_array_elements(coalesce(g.data->'events', '[]'::jsonb)) with ordinality as e(ev, ord)
  where not (ev->>'kind' = 'out' and (ev->>'seat')::int = chris_seat);

  update public.games
  set data = data || jsonb_build_object('winnerName', 'Chris', 'players', new_players, 'events', new_events)
  where id = g.id;

  raise notice 'Fixed game % : Chris is now the winner.', g.id;

  -- ---------- game one: Aaron's commander ----------
  select id, data into g
  from (
    select id, data, row_number() over (order by (data->>'startedAt')::bigint) as n
    from public.games
    where not deleted
      and to_timestamp((data->>'startedAt')::bigint / 1000.0) >= timestamptz '2026-10-20 12:00 America/New_York'
      and to_timestamp((data->>'startedAt')::bigint / 1000.0) <  timestamptz '2026-10-21 06:00 America/New_York'
  ) t
  where n = 1;

  select (p->>'seat')::int into chris_seat  -- reused: Aaron's seat
  from jsonb_array_elements(g.data->'players') p where lower(trim(p->>'name')) = 'aaron';
  if chris_seat is null then
    raise exception 'Aaron is not in game one (id %). Nothing changed.', g.id;
  end if;

  select jsonb_agg(
           case when (p->>'seat')::int = chris_seat
                then (p - 'partner') || '{"commander":"The Wise Mothman","colors":["U","B","G"]}'
                else p end order by ord)
    into new_players
  from jsonb_array_elements(g.data->'players') with ordinality as e(p, ord);

  update public.games
  set data = jsonb_set(
               data || jsonb_build_object('players', new_players),
               array['config', 'players', chris_seat::text],
               ((coalesce(data #> array['config', 'players', chris_seat::text], '{}'::jsonb) - 'partner')
                 || '{"commander":{"name":"The Wise Mothman","colorIdentity":["U","B","G"]},"hasPartner":false,"colors":["U","B","G"]}'))
  where id = g.id;

  raise notice 'Fixed game % : Aaron played The Wise Mothman.', g.id;
end;
$$;
