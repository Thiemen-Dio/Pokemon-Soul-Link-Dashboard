// Dashboard helpers: PokeAPI lookups and run maths. Nothing here writes to the run database.
import { PLAYERS, primaryType } from '../../../soullink/rules.js'

const GRAPHQL = 'https://graphql.pokeapi.co/v1beta2'
const REGION_BY_GEN = { 1: 'kanto', 2: 'johto', 3: 'hoenn', 4: 'sinnoh', 5: 'unova', 6: 'kalos', 7: 'alola', 8: 'galar', 9: 'paldea' }

// shortcut: takes the first game of a version group ('black-white' → 'black'), upgrade when runs store their exact version.
export const versionOf = (baseGame) => baseGame.split('-')[0]

/** "Route 1" in Gen 5 → "unova-route-1"; "Pinwheel Forest" → "pinwheel-forest" (PokeAPI location names). */
export function locationSlug(area, gen) {
  const slug = area.toLowerCase().replace(/['’.]/g, '').replace(/\s+/g, '-')
  // Names every region has (routes, Victory Road, Safari Zone) carry the region in PokeAPI.
  return /^(route-\d+|victory-road|safari-zone)$/.test(slug) ? `${REGION_BY_GEN[gen]}-${slug}` : slug
}

// Gift areas PokeAPI has no wild data for: { area: [pokemonId, level] }.
export const GIFTS = {
  'Lavaridge Town (egg)': [360, 5], // Wynaut egg
  'Fortree City (Castform)': [351, 25],
  'Mossdeep City (Beldum)': [374, 5],
}

const cache = new Map()

/** Wild encounters on one location in one game, grouped per Pokémon: levels, methods, total chance. */
export function getAreaEncounters(location, version) {
  const key = `${location}|${version}`
  if (!cache.has(key)) {
    // Area names can be typed by players (custom areas), so they go in as variables, never into the query text.
    const query = `query ($ver: String!, $loc: String!) { encounter(where: {version: {name: {_eq: $ver}}, locationarea: {location: {name: {_eq: $loc}}}}) {
      min_level max_level pokemon { id name pokemon_species_id } encounterslot { rarity encountermethod { name } } } }`
    const body = JSON.stringify({ query, variables: { ver: version, loc: location } })
    const p = fetch(GRAPHQL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`PokeAPI returned ${r.status}`))))
      .then(({ data, errors }) => {
        if (errors) throw new Error(errors[0].message)
        const byMon = {}
        for (const e of data.encounter) {
          const m = (byMon[e.pokemon.id] ??= { id: e.pokemon.id, name: e.pokemon.name, dex: e.pokemon.pokemon_species_id, min: 99, max: 0, methods: {} })
          m.min = Math.min(m.min, e.min_level)
          m.max = Math.max(m.max, e.max_level)
          const method = e.encounterslot?.encountermethod?.name ?? 'other'
          m.methods[method] = (m.methods[method] ?? 0) + (e.encounterslot?.rarity ?? 0)
        }
        return Object.values(byMon).sort((a, b) => sum(b.methods) - sum(a.methods))
      })
    cache.set(key, p)
    p.catch(() => cache.delete(key))
  }
  return cache.get(key)
}
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0)

/** Every Pokémon either player caught in this run: [{ id, player, area, status }]. */
export function catches(encounters) {
  return encounters.flatMap((e) =>
    PLAYERS.filter((p) => e[`${p}_pokemon_id`]).map((p) => ({ id: e[`${p}_pokemon_id`], player: p, area: e.area, status: e.status, nickname: e[`${p}_nickname`] })),
  )
}

/** Primary types already used by team pairs. */
export function teamPrimaryTypes(encounters, rosterById, gen) {
  return new Set(
    encounters.filter((e) => e.status === 'team').flatMap((e) => PLAYERS.map((p) => primaryType(rosterById[e[`${p}_pokemon_id`]], gen))).filter(Boolean),
  )
}

// Vanilla boss aces (highest level on the boss's team). Hacks like JetBlack will differ.
export const LEVEL_CAPS = {
  emerald: [
    ['Roxanne', 'rock', 15], ['Brawly', 'fighting', 19], ['Wattson', 'electric', 24], ['Flannery', 'fire', 29],
    ['Norman', 'normal', 31], ['Winona', 'flying', 33], ['Tate & Liza', 'psychic', 42], ['Juan', 'water', 46],
    ['Sidney', 'dark', 49], ['Phoebe', 'ghost', 51], ['Glacia', 'ice', 53], ['Drake', 'dragon', 55], ['Wallace', 'water', 58],
  ],
  'black-white': [
    ['Cilan / Chili / Cress', 'grass', 14], ['Lenora', 'normal', 20], ['Burgh', 'bug', 23], ['Elesa', 'electric', 27],
    ['Clay', 'ground', 31], ['Skyla', 'flying', 35], ['Brycen', 'ice', 39], ['Drayden / Iris', 'dragon', 43],
    ['Elite Four', 'psychic', 50], ['N', 'dragon', 52], ['Ghetsis', 'dark', 54],
  ],
}

/** "3 min ago" style text. */
export function timeAgo(iso) {
  const s = (Date.now() - new Date(iso)) / 1000
  if (s < 60) return 'just now'
  for (const [unit, size] of [['day', 86400], ['hour', 3600], ['min', 60]]) {
    if (s >= size) {
      const n = Math.floor(s / size)
      return `${n} ${unit}${n > 1 && unit !== 'min' ? 's' : ''} ago`
    }
  }
}

/** Next evolutions of these species: { [fromSpeciesId]: [{ id, name, generation, how }] }. */
export async function getNextEvolutions(speciesIds) {
  if (speciesIds.length === 0) return {}
  const query = `query ($ids: [Int!]) { pokemonspecies(where: {evolves_from_species_id: {_in: $ids}}) {
    id name generation_id evolves_from_species_id
    pokemonevolutions { min_level min_happiness time_of_day evolutiontrigger { name } item { name } } } }`
  const res = await fetch(GRAPHQL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables: { ids: speciesIds } }) })
  if (!res.ok) throw new Error(`PokeAPI returned ${res.status}`)
  const { data, errors } = await res.json()
  if (errors) throw new Error(errors[0].message)
  const out = {}
  for (const s of data.pokemonspecies) {
    (out[s.evolves_from_species_id] ??= []).push({ id: s.id, name: s.name, generation: s.generation_id, how: evolutionHow(s.pokemonevolutions[0]) })
  }
  return out
}

function evolutionHow(e) {
  if (!e) return 'special'
  const bits = []
  if (e.min_level) bits.push(`Lv ${e.min_level}`)
  if (e.item) bits.push(e.item.name.replace(/-/g, ' '))
  if (e.min_happiness) bits.push('friendship')
  if (e.time_of_day) bits.push(e.time_of_day)
  if (e.evolutiontrigger?.name === 'trade') bits.push('trade')
  return bits.join(', ') || e.evolutiontrigger?.name?.replace(/-/g, ' ') || 'special'
}

/**
 * Base stats and legendary flag per PokeAPI pokemon id:
 * { [id]: { hp, attack, defense, 'special-attack', 'special-defense', speed, bst, legendary } }.
 * shortcut: today's stats (Gen 6+ buffs included), upgrade if older-gen totals matter.
 */
export async function getMonStats(ids) {
  if (ids.length === 0) return {}
  const query = `query ($ids: [Int!]) { pokemon(where: {id: {_in: $ids}}) {
    id pokemonspecy { is_legendary is_mythical } pokemonstats { base_stat stat { name } } } }`
  const r = await fetch(GRAPHQL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables: { ids } }) })
  if (!r.ok) throw new Error(`PokeAPI returned ${r.status}`)
  const { data, errors } = await r.json()
  if (errors) throw new Error(errors[0].message)
  return Object.fromEntries(data.pokemon.map((p) => {
    const stats = Object.fromEntries(p.pokemonstats.map((s) => [s.stat.name, s.base_stat]))
    stats.bst = p.pokemonstats.reduce((t, s) => t + s.base_stat, 0)
    stats.legendary = !!(p.pokemonspecy?.is_legendary || p.pokemonspecy?.is_mythical)
    return [p.id, stats]
  }))
}

// ---- Universal Pokémon Randomizer ZX log ----

const words = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const squash = (s) => s.toLowerCase().replace(/♀/g, 'f').replace(/♂/g, 'm').replace(/[^a-z0-9]/g, '')

/**
 * The "--Wild Pokemon--" section of a randomizer log: [{ name: 'Route 1 Grass/Cave', mons: [{ name, min, max }] }].
 * Format (ZX Randomizer.java logWildPokemonChanges): "Set #1 - Route 1 Grass/Cave (rate=20)",
 * then one line per Pokémon: "Lillipup Lv4   HP 45 …" or "Patrat Lvs 2-4   HP …".
 */
export function parseRandomizerLog(text) {
  const lines = text.split(/\r?\n/)
  const at = lines.findIndex((l) => l.trim() === '--Wild Pokemon--')
  if (at < 0) return []
  const sets = []
  for (const line of lines.slice(at + 1)) {
    if (/^--.*--$/.test(line.trim())) break
    const head = line.match(/^Set #\d+(?: - (.*?))? \(rate=\d+\)/)
    if (head) { sets.push({ name: head[1] ?? `Set ${sets.length + 1}`, mons: [] }); continue }
    const mon = line.match(/^(?:\w* ?SOS: )?\s*(.+?) Lvs? ?(\d+)(?:-(\d+))?/)
    if (mon && sets.length) sets.at(-1).mons.push({ name: mon[1].trim(), min: Number(mon[2]), max: Number(mon[3] ?? mon[2]) })
  }
  return sets
}

/** Sets in the log that belong to an area: "Route 1 Grass/Cave" belongs to "Route 1", not to "Route 10". */
export function logSetsFor(area, sets) {
  const a = words(area)
  return sets.filter((s) => { const n = words(s.name); return n === a || n.startsWith(`${a} `) })
}

/** An area's Pokémon from the log, shaped like getAreaEncounters (where = the set, e.g. "Grass/Cave"). */
export function logEncounters(area, sets, roster) {
  const bySlug = {}
  for (const e of roster) bySlug[squash(e.name)] ??= e // species come before forms, so they win
  const byMon = {}
  for (const s of logSetsFor(area, sets)) {
    const where = s.name.slice(area.length).trim() || 'wild'
    for (const m of s.mons) {
      const e = bySlug[squash(m.name)]
      if (!e) continue
      const x = (byMon[e.id] ??= { id: e.id, name: e.name, dex: e.dex, min: 99, max: 0, methods: {}, where: new Set() })
      x.min = Math.min(x.min, m.min)
      x.max = Math.max(x.max, m.max)
      x.where.add(where)
    }
  }
  return Object.values(byMon).map((m) => ({ ...m, where: [...m.where].join(', ') }))
}

const HELD_CATEGORIES = ['held-items', 'choice', 'bad-held-items', 'plates', 'species-specific', 'type-enhancement', 'scarves', 'jewels', 'mega-stones', 'effort-training', 'training']
let holdItems = null
/** Every item a Pokémon can hold, with the generation it first appears in: [{ name, berry, gen }]. Cached. */
export function getHoldItems() {
  holdItems ??= fetch(GRAPHQL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `query ($cats: [String!]) { item(where: {_or: [{itemcategory: {name: {_in: $cats}}}, {itemcategory: {itempocket: {name: {_eq: "berries"}}}}]}, order_by: {name: asc}) {
        name itemcategory { itempocket { name } } itemgameindices(order_by: {generation_id: asc}, limit: 1) { generation_id } } }`,
      variables: { cats: HELD_CATEGORIES },
    }),
  })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`PokeAPI returned ${r.status}`))))
    .then(({ data, errors }) => {
      if (errors) throw new Error(errors[0].message)
      // Items with no game data yet (newest games only) are left out.
      return data.item.filter((i) => i.itemgameindices[0]).map((i) => ({ name: i.name, berry: i.itemcategory.itempocket.name === 'berries', gen: i.itemgameindices[0].generation_id }))
    })
  holdItems.catch(() => { holdItems = null })
  return holdItems
}
