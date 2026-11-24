// Soul Link house rules: no shared primary types on the team, and the dupes clause.
import { rosterTypesInGeneration } from '../api/pokeapiGraphql.js'
import { templateAreas } from './areas.js'

export const TEAM_SIZE = 6
export const PLAYERS = ['p1', 'p2']

export const STATUSES = [
  { id: 'pending', label: 'Not caught yet' },
  { id: 'team', label: 'On the team' },
  { id: 'box', label: 'In the PC' },
  { id: 'dead', label: 'Dead' },
  { id: 'failed', label: 'Failed' },
]

/** The primary type a Pokémon had in a generation (from the type roster), or null. */
export function primaryType(entry, gen) {
  return entry ? rosterTypesInGeneration(entry, gen)[0] ?? null : null
}

/**
 * No shared primary types: a primary type may appear in only one pair on the team.
 * (The two Pokémon of one pair may share a type with each other.)
 * Returns { [encounterId]: ['fire', ...] } for the team pairs that clash.
 */
export function typeConflicts(encounters, rosterById, gen) {
  const pairsByType = {}
  for (const e of encounters) {
    if (e.status !== 'team') continue
    const types = new Set(
      PLAYERS.map((p) => primaryType(rosterById[e[`${p}_pokemon_id`]], gen)).filter(Boolean),
    )
    for (const t of types) (pairsByType[t] ??= []).push(e.id)
  }
  const conflicts = {}
  for (const [type, ids] of Object.entries(pairsByType)) {
    if (ids.length < 2) continue
    for (const id of ids) (conflicts[id] ??= []).push(type)
  }
  return conflicts
}

/**
 * Hard lock for no shared types: would this row, if on the team, share a primary type with another team pair?
 * Returns { area, type } of the first clash, or null.
 */
export function teamClash(encounters, row, rosterById, gen) {
  if (row.status !== 'team') return null
  const mine = new Set(PLAYERS.map((p) => primaryType(rosterById[row[`${p}_pokemon_id`]], gen)).filter(Boolean))
  for (const e of encounters) {
    if (e.status !== 'team' || e.area === row.area) continue
    const type = PLAYERS.map((p) => primaryType(rosterById[e[`${p}_pokemon_id`]], gen)).find((t) => mine.has(t))
    if (type) return { area: e.area, type }
  }
  return null
}

/**
 * Dupes clause: earlier catches (either player) from the same evolution family.
 * Returns [{ area, player }] for every other slot holding that family.
 */
export function findDupes(encounters, pokemonId, rosterById, families, self) {
  const familyOf = (id) => {
    const dex = rosterById[id]?.dex
    return dex ? families[dex] ?? -dex : null
  }
  const family = familyOf(pokemonId)
  if (family === null) return []
  const hits = []
  for (const e of encounters) {
    for (const p of PLAYERS) {
      if (e.area === self.area && p === self.player) continue
      const other = e[`${p}_pokemon_id`]
      if (other && familyOf(other) === family) hits.push({ area: e.area, player: p })
    }
  }
  return hits
}

/** Status to use once both players have caught something in an area. */
export function statusAfterCatch(encounters, current) {
  if (current.status !== 'pending') return current.status
  const both = current.p1_pokemon_id && current.p2_pokemon_id
  if (!both) return 'pending'
  const onTeam = encounters.filter((e) => e.status === 'team' && e.area !== current.area).length
  return onTeam < TEAM_SIZE ? 'team' : 'box'
}

/**
 * Rows to show: every template area for the game (saved or not) plus custom areas,
 * in game order. Unsaved rows have no id.
 */
export function areaRows(baseGame, encounters, logAreas) {
  const saved = Object.fromEntries(encounters.map((e) => [e.area, e]))
  const rows = templateAreas(baseGame, logAreas).map(({ area, sortOrder }) => ({
    ...(saved[area] ?? emptyEncounter(area)),
    sort_order: sortOrder,
    template: true,
  }))
  const known = new Set(rows.map((r) => r.area))
  for (const e of encounters) if (!known.has(e.area)) rows.push({ ...e, template: false })
  return rows.sort((a, b) => a.sort_order - b.sort_order)
}

export function emptyEncounter(area) {
  return {
    id: null,
    area,
    status: 'pending',
    p1_pokemon_id: null,
    p1_nickname: '',
    p2_pokemon_id: null,
    p2_nickname: '',
  }
}
