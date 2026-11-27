// Test · Achievements: every achievement worked out from the run data (nothing stored).
// Ideas from Steam (rarity, hidden ones, unlock dates), PlayStation trophies (tiers, points),
// Black 2/White 2's Medal Rally (categories) and the Trainer Card (rank colours by score).
//
// An achievement: { id, name, desc, tier, cat, scope: 'run' | 'all', hidden?, icon: { item } | { mon }, check(ctx) → { have, goal, at } }
// at = when it was unlocked (ISO), worked out from the rows' timestamps when possible.
import { PLAYERS, areaRows, primaryType } from '../../../soullink/rules.js'
import { rosterTypesInGeneration } from '../../../api/pokeapiGraphql.js'
import { catches } from '../run/data.js'

export const TIERS = {
  bronze: { label: 'Bronze', points: 10 },
  silver: { label: 'Silver', points: 25 },
  gold: { label: 'Gold', points: 50 },
  platinum: { label: 'Platinum', points: 100 },
}
export const CATEGORIES = {
  adventure: 'Adventure',
  collection: 'Collection',
  classes: 'Trainer classes',
  survival: 'Survival',
  teamwork: 'Team building',
  secret: 'Secrets',
  career: 'Career',
  meta: 'Trophies',
}

// ---- small helpers ----
const byTime = (list) => list.filter(Boolean).sort()
/** have/goal from a list of timestamps; unlocked at the goal-th one. */
const count = (times, goal) => { const t = byTime(times); return { have: t.length, goal, at: t[goal - 1] ?? null } }
const flag = (ok, at = null) => ({ have: ok ? 1 : 0, goal: 1, at: ok ? at : null })
/** count() for caught Pokémon, plus who earned it (Pokémon ids, oldest first) for the "earned by" sprites. */
const catchCount = (mons, goal) => ({ ...count(mons.map((m) => m.at), goal), mons: [...mons].sort((a, b) => (a.at ?? '').localeCompare(b.at ?? '')).map((m) => m.id) })
const hour = (iso) => new Date(iso).getHours()
const day = (iso) => new Date(iso).toDateString()
const DAY_MS = 86400000

/** Everything one run's achievements need. stats: { [pokemonId]: { bst, legendary } } (may be partial). */
export function runContext({ run, encounters, rosterById, families, stats = {} }) {
  const gen = run.generation
  const rows = areaRows(run.base_game, encounters)
  const mons = catches(encounters).map((c) => {
    const row = encounters.find((e) => e.area === c.area)
    const entry = rosterById[c.id]
    return { ...c, row, entry, at: row?.created_at, type: primaryType(entry, gen), types: entry ? rosterTypesInGeneration(entry, gen) : [], stats: stats[c.id] }
  })
  const pairs = encounters.filter((e) => e.p1_pokemon_id && e.p2_pokemon_id)
  const team = encounters.filter((e) => e.status === 'team')
  const teamMons = mons.filter((m) => m.status === 'team')
  const dead = encounters.filter((e) => e.status === 'dead')
  return { run, gen, rows, encounters, mons, pairs, team, teamMons, dead, rosterById, families, stats }
}

/** Trainer classes: [id, class, type(s), goal, icon Pokémon]. Count catches with any of the types. */
const CLASSES = [
  ['youngster', 'Youngster', ['normal'], 5, 19],
  ['bug-catcher', 'Bug Catcher', ['bug'], 5, 10],
  ['bird-keeper', 'Bird Keeper', ['flying'], 5, 16],
  ['fisherman', 'Fisherman', ['water'], 6, 129],
  ['hiker', 'Hiker', ['rock', 'ground'], 5, 74],
  ['kindler', 'Kindler', ['fire'], 4, 58],
  ['aroma-lady', 'Aroma Lady', ['grass'], 5, 43],
  ['guitarist', 'Guitarist', ['electric'], 4, 25],
  ['black-belt', 'Black Belt', ['fighting'], 4, 66],
  ['psychic', 'Psychic', ['psychic'], 4, 63],
  ['hex-maniac', 'Hex Maniac', ['ghost'], 3, 92],
  ['skier', 'Skier', ['ice'], 3, 220],
  ['dragon-tamer', 'Dragon Tamer', ['dragon'], 2, 147],
  ['biker', 'Biker', ['poison'], 4, 109],
  ['worker', 'Worker', ['steel'], 3, 81],
  ['punk', 'Punk', ['dark'], 3, 261],
  ['fairy-tale', 'Fairy Tale Girl', ['fairy'], 3, 35],
]
export const classCount = (mons, types) => mons.filter((m) => m.types.some((t) => types.includes(t)))

const caughtDex = (ctx, dex) => ctx.mons.filter((m) => m.entry?.dex === dex)
const everyTeamMon = (ctx, test) => ctx.teamMons.length >= 2 && ctx.teamMons.every((m) => test(m.row?.[`${m.player}_build`] ?? {}))

// ================= in one run =================
export const RUN_ACHIEVEMENTS = [
  // Adventure
  { id: 'first-pair', cat: 'adventure', tier: 'bronze', name: 'Linked up', desc: 'Catch your first pair', icon: { item: 'poke-ball' },
    check: (c) => count(c.pairs.map((e) => e.created_at), 1) },
  { id: 'ten-areas', cat: 'adventure', tier: 'bronze', name: 'Route regular', desc: 'Use 10 areas', icon: { item: 'town-map' },
    check: (c) => count(c.encounters.filter((e) => e.status !== 'pending').map((e) => e.updated_at), 10) },
  { id: 'halfway', cat: 'adventure', tier: 'silver', name: 'Halfway there', desc: 'Use half of all areas', icon: { item: 'pass-orb' },
    check: (c) => count(c.encounters.filter((e) => e.status !== 'pending').map((e) => e.updated_at), Math.ceil(c.rows.length / 2)) },
  { id: 'all-areas', cat: 'adventure', tier: 'gold', name: 'No stone unturned', desc: 'Use every area in the run log', icon: { item: 'dowsing-machine' },
    check: (c) => ({ have: c.rows.filter((r) => r.status !== 'pending').length, goal: c.rows.length, at: null }) },
  { id: 'skipper', cat: 'adventure', tier: 'bronze', name: 'Not today', desc: 'Skip 3 routes', icon: { item: 'escape-rope' },
    check: (c) => count(c.encounters.filter((e) => e.status === 'skipped').map((e) => e.updated_at), 3) },
  { id: 'champions', cat: 'adventure', tier: 'platinum', name: 'Champions', desc: 'Beat the run', icon: { item: 'master-ball' },
    check: (c) => flag(c.run.status === 'won', c.run.updated_at) },
  { id: 'speedlink', cat: 'adventure', tier: 'gold', hidden: true, name: 'Speedlink', desc: 'Beat a run within 3 weeks of starting it', icon: { item: 'quick-ball' },
    check: (c) => flag(c.run.status === 'won' && new Date(c.run.updated_at) - new Date(c.run.created_at) < 21 * DAY_MS, c.run.updated_at) },

  // Collection
  { id: 'full-squad', cat: 'collection', tier: 'bronze', name: 'Full squad', desc: 'Have 6 pairs on the team', icon: { item: 'premier-ball' },
    check: (c) => ({ have: c.team.length, goal: 6, at: null }) },
  { id: 'collector', cat: 'collection', tier: 'silver', name: 'Collector', desc: 'Catch 25 pairs', icon: { item: 'great-ball' },
    check: (c) => count(c.pairs.map((e) => e.created_at), 25) },
  { id: 'hoarder', cat: 'collection', tier: 'gold', name: 'PC hoarder', desc: 'Catch 40 pairs', icon: { item: 'ultra-ball' },
    check: (c) => count(c.pairs.map((e) => e.created_at), 40) },
  { id: 'rainbow', cat: 'collection', tier: 'silver', name: 'Type rainbow', desc: 'Catch 10 different primary types', icon: { item: 'shiny-stone' },
    check: (c) => firstOfEach(c.mons, (m) => m.type, 10) },
  { id: 'spectrum', cat: 'collection', tier: 'gold', name: 'Full spectrum', desc: 'Catch 15 different primary types', icon: { item: 'prism-scale' },
    check: (c) => firstOfEach(c.mons, (m) => m.type, 15) },
  { id: 'legend', cat: 'collection', tier: 'gold', name: 'Soul dew', desc: 'Catch a legendary or mythical Pokémon', icon: { item: 'soul-dew' },
    check: (c) => catchCount(c.mons.filter((m) => m.stats?.legendary), 1) },
  { id: 'regional', cat: 'collection', tier: 'silver', name: 'Regional flavour', desc: 'Catch a regional form', icon: { item: 'lava-cookie' },
    check: (c) => catchCount(c.mons.filter((m) => m.entry && m.entry.id !== m.entry.dex), 1) },
  { id: 'local', cat: 'collection', tier: 'silver', name: 'Local talent', desc: 'Catch 10 Pokémon from the game’s own generation', icon: { item: 'friend-ball' },
    check: (c) => catchCount(c.mons.filter((m) => m.entry?.generation === c.gen), 10) },
  { id: 'retro', cat: 'collection', tier: 'bronze', name: 'Old school', desc: 'Catch 6 Gen I Pokémon in a later game', icon: { mon: 1 },
    check: (c) => (c.gen === 1 ? { have: 0, goal: 6, at: null, never: true } : catchCount(c.mons.filter((m) => m.entry?.generation === 1), 6)) },
  { id: 'heavy', cat: 'collection', tier: 'silver', name: 'Heavy hitter', desc: 'Catch a non-legendary with 500+ base stats', icon: { item: 'choice-band' },
    check: (c) => catchCount(c.mons.filter((m) => m.stats && !m.stats.legendary && m.stats.bst >= 500), 1) },
  { id: 'elite-squad', cat: 'collection', tier: 'gold', name: 'Elite squad', desc: 'A team of 4+ pairs averaging 450+ base stats', icon: { item: 'expert-belt' },
    check: (c) => { const s = c.teamMons.map((m) => m.stats?.bst).filter(Boolean); const avg = s.length ? s.reduce((a, b) => a + b, 0) / s.length : 0; return { have: c.team.length >= 4 ? Math.round(avg) : 0, goal: 450, at: null } } },
  { id: 'matching', cat: 'collection', tier: 'bronze', name: 'Matching outfits', desc: 'A pair whose two Pokémon share their primary type', icon: { item: 'twisted-spoon' },
    check: (c) => count(c.pairs.filter((e) => { const [a, b] = PLAYERS.map((p) => primaryType(c.rosterById[e[`${p}_pokemon_id`]], c.gen)); return a && a === b }).map((e) => e.updated_at), 1) },
  { id: 'twin-souls', cat: 'collection', tier: 'silver', hidden: true, name: 'Twin souls', desc: 'You both caught the same species on one area', icon: { item: 'soothe-bell' },
    check: (c) => count(c.pairs.filter((e) => c.rosterById[e.p1_pokemon_id]?.dex === c.rosterById[e.p2_pokemon_id]?.dex).map((e) => e.updated_at), 1) },

  // Trainer classes: catch enough of a type (either player). The Rivals panel says who holds the title.
  ...CLASSES.map(([id, name, types, goal, mon]) => ({
    id: `class-${id}`, cat: 'classes', tier: goal <= 3 ? 'silver' : 'bronze', name, desc: `Catch ${goal} ${types.map((t) => t[0].toUpperCase() + t.slice(1)).join(' or ')} types`, icon: { mon }, types,
    check: (c) => catchCount(classCount(c.mons, types), goal),
  })),

  // Survival
  { id: 'first-blood', cat: 'survival', tier: 'bronze', name: 'It had to happen', desc: 'Lose your first pair', icon: { item: 'revive' },
    check: (c) => count(c.dead.map((e) => e.updated_at), 1) },
  { id: 'last-words', cat: 'survival', tier: 'bronze', name: 'Last words', desc: 'Write down how 5 pairs died', icon: { item: 'reaper-cloth' },
    check: (c) => count(c.dead.filter((e) => e.died_at).map((e) => e.updated_at), 5) },
  { id: 'never-forget', cat: 'survival', tier: 'bronze', name: 'Never forget', desc: 'Star a fallen pair in the graveyard', icon: { item: 'sacred-ash' },
    check: (c) => count(c.dead.filter((e) => e.favorite).map((e) => e.updated_at), 1) },
  { id: 'graveyard', cat: 'survival', tier: 'silver', name: 'Graveyard keeper', desc: 'Lose 10 pairs (and keep going)', icon: { item: 'cleanse-tag' },
    check: (c) => count(c.dead.map((e) => e.updated_at), 10) },
  { id: 'clean-sheet', cat: 'survival', tier: 'silver', name: 'Clean sheet', desc: 'Use 20 areas without a failed encounter', icon: { item: 'lucky-egg' },
    check: (c) => (c.encounters.some((e) => e.status === 'failed') ? { have: 0, goal: 20, at: null } : count(c.encounters.filter((e) => e.status !== 'pending').map((e) => e.updated_at), 20)) },
  { id: 'untouchable', cat: 'survival', tier: 'gold', name: 'Untouchable', desc: 'Catch 15 pairs before anyone falls', icon: { item: 'bright-powder' },
    check: (c) => { const firstDeath = byTime(c.dead.map((e) => e.updated_at))[0]; return count(c.pairs.map((e) => e.created_at).filter((t) => !firstDeath || t < firstDeath), 15) } },
  { id: 'survivor', cat: 'survival', tier: 'gold', name: 'Survivor', desc: 'Catch 20 pairs with fewer than 5 deaths', icon: { item: 'focus-sash' },
    check: (c) => (c.dead.length >= 5 ? { have: 0, goal: 20, at: null } : count(c.pairs.map((e) => e.created_at), 20)) },
  { id: 'ride-or-die', cat: 'survival', tier: 'gold', name: 'Ride or die', desc: 'Beat the run with your starters still alive', icon: { item: 'oran-berry' },
    check: (c) => flag(c.run.status === 'won' && c.encounters.some((e) => e.area === 'Starter' && (e.status === 'team' || e.status === 'box')), c.run.updated_at) },
  { id: 'flawless', cat: 'survival', tier: 'platinum', name: 'Nearly flawless', desc: 'Beat the run with 2 or fewer deaths', icon: { item: 'max-revive' },
    check: (c) => flag(c.run.status === 'won' && c.dead.length <= 2, c.run.updated_at) },
  { id: 'bad-day', cat: 'survival', tier: 'bronze', hidden: true, name: 'Bad day', desc: 'Lose 3 pairs on the same day', icon: { item: 'black-sludge' },
    check: (c) => { const days = {}; for (const e of c.dead) (days[day(e.updated_at)] ??= []).push(e.updated_at); const worst = Object.values(days).sort((a, b) => b.length - a.length)[0] ?? []; return count(worst, 3) } },

  // Team building (the cards' builds)
  { id: 'movesets', cat: 'teamwork', tier: 'silver', name: 'Moveset master', desc: 'Every team Pokémon has 4 moves saved', icon: { item: 'pp-max' },
    check: (c) => flag(everyTeamMon(c, (b) => b.moves?.length === 4)) },
  { id: 'equipped', cat: 'teamwork', tier: 'silver', name: 'Well equipped', desc: 'Every team Pokémon holds an item', icon: { item: 'leftovers' },
    check: (c) => flag(everyTeamMon(c, (b) => !!b.item)) },
  { id: 'natures', cat: 'teamwork', tier: 'bronze', name: 'Personality test', desc: 'Pick a nature for every team Pokémon', icon: { item: 'adamant-mint' },
    check: (c) => (c.gen < 3 ? { have: 0, goal: 1, at: null, never: true } : flag(everyTeamMon(c, (b) => !!b.nature))) },
  { id: 'abilities', cat: 'teamwork', tier: 'bronze', name: 'Ability check', desc: 'Pick an ability for every team Pokémon', icon: { item: 'ability-capsule' },
    check: (c) => (c.gen < 3 ? { have: 0, goal: 1, at: null, never: true } : flag(everyTeamMon(c, (b) => !!b.ability))) },
  { id: 'pinned', cat: 'teamwork', tier: 'bronze', name: 'Hands off', desc: 'Pin a held item in the team planner', icon: { item: 'sticky-barb' },
    check: (c) => flag(c.mons.some((m) => m.row?.[`${m.player}_build`]?.itemPinned)) },
  { id: 'names', cat: 'teamwork', tier: 'bronze', name: 'Name them all', desc: 'Give 10 pairs a name', icon: { item: 'poke-doll' },
    check: (c) => count(c.pairs.filter((e) => e.p1_nickname || e.p2_nickname).map((e) => e.updated_at), 10) },

  // Secrets
  { id: 'night-owl', cat: 'secret', tier: 'bronze', hidden: true, name: 'Night owl', desc: 'Log a catch between 1 and 5 at night', icon: { item: 'dusk-ball' },
    check: (c) => count(c.encounters.filter((e) => e.created_at && hour(e.created_at) >= 1 && hour(e.created_at) < 5).map((e) => e.created_at), 1) },
  { id: 'joey', cat: 'secret', tier: 'bronze', hidden: true, name: 'Top percentage', desc: 'Catch a Rattata', icon: { mon: 19 }, check: (c) => catchCount(caughtDex(c, 19), 1) },
  { id: 'splash', cat: 'secret', tier: 'bronze', hidden: true, name: 'Splash!', desc: 'Catch a Magikarp', icon: { mon: 129 }, check: (c) => catchCount(caughtDex(c, 129), 1) },
  { id: 'ditto', cat: 'secret', tier: 'bronze', hidden: true, name: 'Identity crisis', desc: 'Catch a Ditto', icon: { mon: 132 }, check: (c) => catchCount(caughtDex(c, 132), 1) },
  { id: 'eevee', cat: 'secret', tier: 'bronze', hidden: true, name: 'Choose your fighter', desc: 'Catch an Eevee', icon: { mon: 133 }, check: (c) => catchCount(caughtDex(c, 133), 1) },
  { id: 'wobbuffet', cat: 'secret', tier: 'bronze', hidden: true, name: 'Patience', desc: 'Catch a Wobbuffet', icon: { mon: 202 }, check: (c) => catchCount(caughtDex(c, 202), 1) },
  { id: 'shedinja', cat: 'secret', tier: 'silver', hidden: true, name: 'One HP wonder', desc: 'Catch a Shedinja', icon: { mon: 292 }, check: (c) => catchCount(caughtDex(c, 292), 1) },
  { id: 'feebas', cat: 'secret', tier: 'silver', hidden: true, name: 'Ugly duckling', desc: 'Catch a Feebas', icon: { mon: 349 }, check: (c) => catchCount(caughtDex(c, 349), 1) },
]

/** Distinct values (e.g. primary types), unlocked when the goal-th new one was caught. */
function firstOfEach(mons, key, goal) {
  const seen = new Map()
  for (const m of [...mons].sort((a, b) => (a.at ?? '').localeCompare(b.at ?? ''))) { const k = key(m); if (k && !seen.has(k)) seen.set(k, m.at) }
  return count([...seen.values()], goal)
}

// ================= over every run =================
/** ctxs = runContext for every run. */
export const ALL_ACHIEVEMENTS = [
  { id: 'runs-3', cat: 'career', tier: 'bronze', name: 'Here we go again', desc: 'Start 3 runs', icon: { item: 'repeat-ball' },
    check: (a) => count(a.runs.map((r) => r.created_at), 3) },
  { id: 'runs-10', cat: 'career', tier: 'gold', name: 'Serial linkers', desc: 'Start 10 runs', icon: { item: 'timer-ball' },
    check: (a) => count(a.runs.map((r) => r.created_at), 10) },
  { id: 'gens-3', cat: 'career', tier: 'silver', name: 'Generation tourists', desc: 'Runs in 3 different generations', icon: { item: 'town-map' },
    check: (a) => firstRunPer(a.runs, (r) => r.generation, 3) },
  { id: 'gens-6', cat: 'career', tier: 'gold', name: 'World tour', desc: 'Runs in 6 different generations', icon: { item: 'vs-seeker' },
    check: (a) => firstRunPer(a.runs, (r) => r.generation, 6) },
  { id: 'gens-9', cat: 'career', tier: 'platinum', name: 'Every region', desc: 'A run in all 9 generations', icon: { item: 'azure-flute' },
    check: (a) => firstRunPer(a.runs, (r) => r.generation, 9) },
  { id: 'rando-1', cat: 'career', tier: 'bronze', name: 'Chaos mode', desc: 'Play a randomized run', icon: { item: 'luxury-ball' },
    check: (a) => count(a.runs.filter((r) => r.randomized).map((r) => r.created_at), 1) },
  { id: 'rando-3', cat: 'career', tier: 'silver', name: 'Chaos enjoyers', desc: 'Play 3 randomized runs', icon: { item: 'dream-ball' },
    check: (a) => count(a.runs.filter((r) => r.randomized).map((r) => r.created_at), 3) },
  { id: 'pairs-100', cat: 'career', tier: 'gold', name: 'Century of souls', desc: '100 pairs over all runs', icon: { item: 'heal-ball' },
    check: (a) => count(a.ctxs.flatMap((c) => c.pairs.map((e) => e.created_at)), 100) },
  { id: 'pairs-250', cat: 'career', tier: 'platinum', name: 'Soul collectors', desc: '250 pairs over all runs', icon: { item: 'cherish-ball' },
    check: (a) => count(a.ctxs.flatMap((c) => c.pairs.map((e) => e.created_at)), 250) },
  { id: 'species-150', cat: 'career', tier: 'gold', name: 'Pokédex dreamers', desc: '150 different species caught', icon: { item: 'pokeblock-case' },
    check: (a) => firstOfEach(a.ctxs.flatMap((c) => c.mons), (m) => m.entry?.dex, 150) },
  { id: 'species-400', cat: 'career', tier: 'platinum', name: 'Living dex energy', desc: '400 different species caught', icon: { item: 'oval-charm' },
    check: (a) => firstOfEach(a.ctxs.flatMap((c) => c.mons), (m) => m.entry?.dex, 400) },
  { id: 'lines-100', cat: 'career', tier: 'silver', name: 'Family reunion', desc: '100 different evolution lines caught', icon: { item: 'everstone' },
    check: (a) => firstOfEach(a.ctxs.flatMap((c) => c.mons), (m) => m.entry && (a.families[m.entry.dex] ?? -m.entry.dex), 100) },
  { id: 'types-18', cat: 'career', tier: 'gold', name: 'Ace Trainers', desc: 'Every type caught as a primary type', icon: { item: 'rainbow-wing' },
    check: (a) => firstOfEach(a.ctxs.flatMap((c) => c.mons), (m) => m.type, 18) },
  { id: 'legends-5', cat: 'career', tier: 'gold', name: 'Legend hunters', desc: '5 legendaries or mythicals over all runs', icon: { item: 'red-orb' },
    check: (a) => catchCount(a.ctxs.flatMap((c) => c.mons.filter((m) => m.stats?.legendary)), 5) },
  { id: 'old-favourite', cat: 'career', tier: 'silver', name: 'Old favourite', desc: 'The same evolution line in 3 runs', icon: { item: 'soothe-bell' },
    check: (a) => { const per = {}; a.ctxs.forEach((c) => { for (const f of new Set(c.mons.map((m) => m.entry && (a.families[m.entry.dex] ?? -m.entry.dex)).filter(Boolean))) per[f] = (per[f] ?? 0) + 1 }); return { have: Math.max(0, ...Object.values(per)), goal: 3, at: null } } },
  { id: 'dead-50', cat: 'career', tier: 'bronze', name: 'Heartbreak hotel', desc: '50 fallen pairs over all runs', icon: { item: 'spell-tag' },
    check: (a) => count(a.ctxs.flatMap((c) => c.dead.map((e) => e.updated_at)), 50) },
  { id: 'dead-150', cat: 'career', tier: 'silver', hidden: true, name: 'Professional mourners', desc: '150 fallen pairs over all runs', icon: { item: 'odd-keystone' },
    check: (a) => count(a.ctxs.flatMap((c) => c.dead.map((e) => e.updated_at)), 150) },
  { id: 'win-1', cat: 'career', tier: 'gold', name: 'Hall of Fame', desc: 'Beat a run', icon: { item: 'master-ball' },
    check: (a) => count(a.runs.filter((r) => r.status === 'won').map((r) => r.updated_at), 1) },
  { id: 'win-3', cat: 'career', tier: 'platinum', name: 'Dynasty', desc: 'Beat 3 runs', icon: { item: 'park-ball' },
    check: (a) => count(a.runs.filter((r) => r.status === 'won').map((r) => r.updated_at), 3) },
  { id: 'comeback', cat: 'career', tier: 'silver', name: 'Comeback kids', desc: 'Beat a run after losing one', icon: { item: 'max-elixir' },
    check: (a) => { const lost = byTime(a.runs.filter((r) => r.status === 'lost').map((r) => r.updated_at))[0]; return count(a.runs.filter((r) => r.status === 'won' && lost && r.created_at > lost).map((r) => r.updated_at), 1) } },
  { id: 'bounce', cat: 'career', tier: 'bronze', hidden: true, name: 'Back on the horse', desc: 'Start a new run within 2 days of losing one', icon: { item: 'super-repel' },
    check: (a) => count(a.runs.filter((r) => a.runs.some((l) => l.status === 'lost' && r.created_at > l.updated_at && new Date(r.created_at) - new Date(l.updated_at) < 2 * DAY_MS)).map((r) => r.created_at), 1) },
  { id: 'marathon', cat: 'career', tier: 'silver', name: 'Marathon session', desc: 'Log 15 areas on one day', icon: { item: 'exp-share' },
    check: (a) => { const days = {}; for (const e of a.ctxs.flatMap((c) => c.encounters)) if (e.created_at) (days[day(e.created_at)] ??= []).push(e.created_at); return count(Object.values(days).sort((x, y) => y.length - x.length)[0] ?? [], 15) } },
  { id: 'weekend', cat: 'career', tier: 'bronze', name: 'Weekend warriors', desc: 'Log 25 areas on Saturdays and Sundays', icon: { item: 'amulet-coin' },
    check: (a) => count(a.ctxs.flatMap((c) => c.encounters).filter((e) => e.created_at && [0, 6].includes(new Date(e.created_at).getDay())).map((e) => e.created_at), 25) },
]

function firstRunPer(runs, key, goal) {
  const seen = new Map()
  for (const r of [...runs].sort((a, b) => a.created_at.localeCompare(b.created_at))) if (!seen.has(key(r))) seen.set(key(r), r.created_at)
  return count([...seen.values()], goal)
}

/** Run every check: [{ ...achievement, have, goal, at, done, progress }]. A failing check counts as locked. */
export function evaluate(list, ctx) {
  return list.map((a) => {
    let r
    try { r = a.check(ctx) } catch { r = { have: 0, goal: 1, at: null } }
    const done = r.have >= r.goal && !r.never
    return { ...a, ...r, done, progress: r.goal ? Math.min(1, r.have / r.goal) : 0 }
  })
}

/** Score and Trainer Card rank (the card's colour goes up with stars in the games). */
export function score(results) {
  const points = results.filter((r) => r.done).reduce((s, r) => s + TIERS[r.tier].points, 0)
  const max = results.reduce((s, r) => s + TIERS[r.tier].points, 0)
  return { points, max, got: results.filter((r) => r.done).length, total: results.length }
}
export const RANKS = [
  { min: 0, name: 'Rookie', color: '#7b8794' },
  { min: 0.1, name: 'Bronze card', color: '#b0703a' },
  { min: 0.25, name: 'Copper card', color: '#c4563a' },
  { min: 0.45, name: 'Silver card', color: '#8f9bab' },
  { min: 0.65, name: 'Gold card', color: '#d3a20f' },
  { min: 0.85, name: 'Black card', color: '#1d2130' },
]
export const rankFor = ({ points, max }) => [...RANKS].reverse().find((r) => (max ? points / max : 0) >= r.min)

/** Rivals: for every trainer class, who has caught more of its types in this run. */
export function rivalry(ctx) {
  return CLASSES.map(([id, name, types, goal, mon]) => {
    const per = Object.fromEntries(PLAYERS.map((p) => [p, classCount(ctx.mons.filter((m) => m.player === p), types).length]))
    const holder = per.p1 === per.p2 ? null : per.p1 > per.p2 ? 'p1' : 'p2'
    return { id, name, types, goal, mon, per, holder }
  })
}

/**
 * PlayStation-style meta trophies on top of a list: half of everything (gold) and the platinum for all of it.
 * Achievements that can't be done in this game don't count against you.
 */
export function withMeta(results, label = 'this run') {
  const possible = results.filter((r) => !r.never)
  const got = possible.filter((r) => r.done)
  const lastAt = (list) => list.map((r) => r.at).filter(Boolean).sort().at(-1) ?? null
  const half = Math.ceil(possible.length / 2)
  const meta = [
    { id: 'meta-half', cat: 'meta', tier: 'gold', name: 'Over the hump', desc: `Unlock half of the achievements in ${label}`, icon: { item: 'star-piece' },
      have: got.length, goal: half, at: got.length >= half ? got.map((r) => r.at).filter(Boolean).sort()[half - 1] ?? null : null },
    { id: 'meta-all', cat: 'meta', tier: 'platinum', hidden: true, name: 'Living legends', desc: `Unlock every other achievement in ${label}`, icon: { item: 'comet-shard' },
      have: got.length, goal: possible.length, at: got.length === possible.length ? lastAt(got) : null },
  ]
  return [...results, ...meta.map((m) => ({ ...m, done: m.have >= m.goal, progress: Math.min(1, m.have / m.goal) }))]
}
