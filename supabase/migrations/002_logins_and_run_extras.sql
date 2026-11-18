-- Soul Link dashboard: logins, plus two new run features.
-- After this, anyone can still READ runs (the stream overlay needs that), but only
-- the logged-in players on the allow-list can add, change or delete anything.
-- Safe to run more than once.

-- 1. Who may change data: the players' login e-mails.
--    Not readable or editable through the website (RLS on, no policies).
create table if not exists public.allowed_players (
  email text primary key
);
alter table public.allowed_players enable row level security;

-- True when the logged-in account is on the allow-list.
create or replace function public.is_player() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.allowed_players
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- Only logged-in accounts need it (the write policies below); not callable without login.
revoke execute on function public.is_player() from public, anon;
grant execute on function public.is_player() to authenticated;
alter function public.touch_updated_at() set search_path = public;

-- 2. Replace "anyone may do anything" with: everyone reads, players write.
drop policy if exists "anon full access" on public.runs;
drop policy if exists "anon full access" on public.encounters;

drop policy if exists "everyone reads" on public.runs;
create policy "everyone reads" on public.runs for select to anon, authenticated using (true);
drop policy if exists "players write" on public.runs;
create policy "players write" on public.runs for all to authenticated
  using (public.is_player()) with check (public.is_player());

drop policy if exists "everyone reads" on public.encounters;
create policy "everyone reads" on public.encounters for select to anon, authenticated using (true);
drop policy if exists "players write" on public.encounters;
create policy "players write" on public.encounters for all to authenticated
  using (public.is_player()) with check (public.is_player());

-- 3. New run features.
-- House rules and randomizer settings chosen in "New run".
alter table public.runs add column if not exists rules jsonb;
-- Graveyard favourites, shared between both players.
alter table public.encounters add column if not exists favorite boolean not null default false;

-- Then add your own login e-mails (Supabase → SQL Editor):
--   insert into public.allowed_players (email) values ('you@example.com'), ('friend@example.com');
