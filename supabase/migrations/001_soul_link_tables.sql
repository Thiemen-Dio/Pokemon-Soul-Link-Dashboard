-- Soul Link dashboard: tables for shared run data.
-- Paste this whole file into Supabase → SQL Editor → New query, and press Run.
-- Safe to run more than once.

-- One row per Soul Link run (e.g. "Randomized Emerald", "JetBlack").
create table if not exists public.runs (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,                       -- shown on the page, e.g. 'JetBlack'
  base_game    text not null,                       -- PokeAPI version group, e.g. 'black-white', 'emerald'
  generation   int  not null check (generation between 1 and 9), -- for Gen-correct typings
  randomized   boolean not null default false,
  player1_name text not null default 'Player 1',
  player2_name text not null default 'Player 2',
  status       text not null default 'active' check (status in ('active', 'won', 'lost')),
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- One row per area = one linked pair. Both players' catches from that area share a fate.
create table if not exists public.encounters (
  id          uuid primary key default gen_random_uuid(),
  run_id      uuid not null references public.runs (id) on delete cascade,
  area        text not null,                        -- e.g. 'Route 1', 'Starter'
  sort_order  int  not null default 0,              -- order the areas appear in the game
  -- The pair's fate:
  --   pending = not both caught yet, team = in the party, box = in the PC,
  --   dead = fainted (both die), failed = one player's encounter failed (pair lost)
  status      text not null default 'pending'
              check (status in ('pending', 'team', 'box', 'dead', 'failed')),
  p1_pokemon_id int,                                -- PokeAPI pokemon id (regional forms work too)
  p1_nickname   text,
  p2_pokemon_id int,
  p2_nickname   text,
  died_at     text,                                 -- optional: where/how the pair died
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (run_id, area)
);

create index if not exists encounters_run_id_idx on public.encounters (run_id, sort_order);

-- Keep updated_at current on every change.
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists runs_touch on public.runs;
create trigger runs_touch before update on public.runs
  for each row execute function public.touch_updated_at();

drop trigger if exists encounters_touch on public.encounters;
create trigger encounters_touch before update on public.encounters
  for each row execute function public.touch_updated_at();

-- Access rules (Row Level Security).
-- For now the app runs on your own computers with the public key in .env, so the
-- public ("anon") key may read and write. Tighten this with logins before putting
-- the dashboard online.
alter table public.runs       enable row level security;
alter table public.encounters enable row level security;

drop policy if exists "anon full access" on public.runs;
create policy "anon full access" on public.runs
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "anon full access" on public.encounters;
create policy "anon full access" on public.encounters
  for all to anon, authenticated using (true) with check (true);

-- Live updates: when one player edits the run, the other sees it straight away.
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'runs') then
    alter publication supabase_realtime add table public.runs;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'encounters') then
    alter publication supabase_realtime add table public.encounters;
  end if;
end;
$$;
