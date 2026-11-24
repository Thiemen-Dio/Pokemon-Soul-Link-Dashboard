-- A route can be skipped (e.g. its Pokémon would share a primary type with the team).
alter table public.encounters drop constraint encounters_status_check;
alter table public.encounters add constraint encounters_status_check
  check (status in ('pending', 'team', 'box', 'dead', 'failed', 'skipped'));
