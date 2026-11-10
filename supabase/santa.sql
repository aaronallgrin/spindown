-- Pauper Secret Santa.
-- Run once in Supabase, SQL Editor, New query. Safe to run again.
--
-- Who drew whom never leaves the database: santa_pairs can't be read by the app at all,
-- and santa_my_match() answers only for the phone that signed up (its secret player key,
-- which the app can't read back for anyone else).

create table if not exists santa_settings (
  exchange         text primary key,          -- '2026'
  size             int,                       -- unused: the host draws names from the app
  unboxing         date,                      -- Unboxing Day, null = TBD
  drawn_notified   boolean not null default false,
  date_notified    date,                      -- the date we last told everyone about
  reminder_notified boolean not null default false
);
alter table santa_settings alter column size drop not null, alter column size drop default;
insert into santa_settings (exchange) values ('2026') on conflict do nothing;

create table if not exists santa_signups (
  exchange   text not null references santa_settings(exchange),
  name       text not null,
  player_key text not null,                   -- secret: proves "this phone is me"
  theme      text not null,
  avoid      text not null default '',
  created_at timestamptz not null default now(),
  primary key (exchange, name),
  unique (exchange, player_key)
);

create table if not exists santa_pairs (
  exchange text not null,
  giver    text not null,
  receiver text not null,
  primary key (exchange, giver)
);

-- one sign-up at a time, none after Thu Nov 19 (Philly time), and none once names are drawn
create or replace function santa_before_signup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext('santa:' || new.exchange));
  if exists (select 1 from santa_pairs where exchange = new.exchange) then
    raise exception 'Names are already drawn';
  end if;
  if (now() at time zone 'America/New_York')::date > date '2026-11-19' then
    raise exception 'Sign-ups closed on November 19';
  end if;
  return new;
end $$;

-- the host taps Draw names: one shuffled loop, nobody gets themselves, and no two people just swap
create or replace function santa_draw(p_exchange text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext('santa:' || p_exchange));
  if exists (select 1 from santa_pairs where exchange = p_exchange) then return true; end if;
  if (select count(*) from santa_signups where exchange = p_exchange) < 3 then
    raise exception 'Need at least 3 people to draw';
  end if;
  with s as (
    select name, row_number() over (order by random()) as i, count(*) over () as n
    from santa_signups where exchange = p_exchange
  )
  insert into santa_pairs (exchange, giver, receiver)
  select p_exchange, a.name, b.name from s a join s b on b.i = a.i % a.n + 1;
  return true;
end $$;

drop trigger if exists santa_before on santa_signups;
drop trigger if exists santa_after on santa_signups;
drop function if exists santa_after_signup();
create trigger santa_before before insert on santa_signups for each row execute function santa_before_signup();

-- "who did I draw?" for the phone holding p_key, and nobody else
create or replace function santa_my_match(p_exchange text, p_key text)
returns table (name text, theme text, avoid text)
language sql security definer set search_path = public as $$
  select r.name, r.theme, r.avoid
  from santa_signups me
  join santa_pairs p on p.exchange = me.exchange and p.giver = me.name
  join santa_signups r on r.exchange = p.exchange and r.name = p.receiver
  where me.exchange = p_exchange and me.player_key = p_key;
$$;

-- has the draw happened? (true/false only, no names)
create or replace function santa_drawn(p_exchange text) returns boolean
language sql security definer set search_path = public as $$
  select exists (select 1 from santa_pairs where exchange = p_exchange);
$$;

-- ---------- who can do what with the app's key ----------
alter table santa_settings enable row level security;
alter table santa_signups enable row level security;
alter table santa_pairs enable row level security;

revoke all on santa_settings, santa_signups, santa_pairs from anon, authenticated;

-- settings: anyone reads; only the Unboxing Day date can be changed
grant select on santa_settings to anon;
grant update (unboxing) on santa_settings to anon;
drop policy if exists "read settings" on santa_settings;
drop policy if exists "set date" on santa_settings;
create policy "read settings" on santa_settings for select to anon using (true);
create policy "set date" on santa_settings for update to anon using (true) with check (true);

-- sign-ups: anyone signs up and sees names and themes, never the player keys
grant insert (exchange, name, player_key, theme, avoid) on santa_signups to anon;
grant select (exchange, name, theme, avoid, created_at) on santa_signups to anon;
drop policy if exists "read signups" on santa_signups;
drop policy if exists "sign up" on santa_signups;
create policy "read signups" on santa_signups for select to anon using (true);
create policy "sign up" on santa_signups for insert to anon with check (true);

-- pairs: no access at all; only the two functions above look inside
revoke execute on function santa_my_match(text, text), santa_drawn(text), santa_draw(text) from public;
grant execute on function santa_my_match(text, text), santa_drawn(text), santa_draw(text) to anon;
