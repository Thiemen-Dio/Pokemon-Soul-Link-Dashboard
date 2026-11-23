-- Per-Pokémon build for each player's catch: moves and held item (with an item pin for the team planner).
-- Shape: { "moves": [{ "id": 53, "name": "flamethrower", "type": "fire", "power": 90, "category": "special" }],
--          "item": "choice-scarf", "itemPinned": true }
-- Writes are already limited to signed-in players by the "players write" policy (002).
alter table public.encounters
  add column if not exists p1_build jsonb not null default '{}'::jsonb,
  add column if not exists p2_build jsonb not null default '{}'::jsonb;

-- Keep builds small and object-shaped (4 moves + an item is far under 4 kB).
alter table public.encounters drop constraint if exists builds_are_small_objects;
alter table public.encounters add constraint builds_are_small_objects check (
  jsonb_typeof(p1_build) = 'object' and jsonb_typeof(p2_build) = 'object'
  and pg_column_size(p1_build) < 4000 and pg_column_size(p2_build) < 4000
);
