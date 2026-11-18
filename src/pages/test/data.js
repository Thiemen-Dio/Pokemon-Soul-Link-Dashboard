// Test tab helpers. Experimental: nothing here writes to the run database.
import { PLAYERS, primaryType } from '../../soullink/rules.js'

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
 * Base stat totals per PokeAPI pokemon id: { [id]: 525 }.
 * shortcut: today's stats (Gen 6+ buffs included), upgrade if older-gen totals matter.
 */
export async function getBaseStatTotals(ids) {
  if (ids.length === 0) return {}
  const query = 'query ($ids: [Int!]) { pokemonstat(where: {pokemon_id: {_in: $ids}}) { pokemon_id base_stat } }'
  const r = await fetch(GRAPHQL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables: { ids } }) })
  if (!r.ok) throw new Error(`PokeAPI returned ${r.status}`)
  const { data, errors } = await r.json()
  if (errors) throw new Error(errors[0].message)
  const totals = {}
  for (const s of data.pokemonstat) totals[s.pokemon_id] = (totals[s.pokemon_id] ?? 0) + s.base_stat
  return totals
}
