// PokeAPI's GraphQL endpoint returns every ability / move with its text in one request,
// instead of ~1,300 separate REST calls.
import { formName, regionOf } from './pokeapi.js'

const GRAPHQL = 'https://graphql.pokeapi.co/v1beta2'
const ENGLISH = 9

// Filter (inside `pokemon: {…}`): a Pokémon's normal form, or a real regional form
// (Alolan / Galarian / Hisuian / Paldean) — but not Totem Raticate or Cap Pikachu.
const NORMAL_OR_REGIONAL = `_or: [
  {is_default: {_eq: true}},
  {_and: [
    {_or: [{name: {_like: "%-alola%"}}, {name: {_like: "%-galar%"}}, {name: {_like: "%-hisui%"}}, {name: {_like: "%-paldea%"}}]},
    {name: {_nlike: "%totem%"}},
    {name: {_nlike: "%-cap"}}
  ]}
]`

const ABILITIES_QUERY = `{
  ability(where: {is_main_series: {_eq: true}}, order_by: {name: asc}) {
    id name generation_id
    abilityeffecttexts(where: {language_id: {_eq: ${ENGLISH}}}) { short_effect effect }
    abilityflavortexts(where: {language_id: {_eq: ${ENGLISH}}}, order_by: {version_group_id: desc}, limit: 1) { flavor_text }
    pokemonabilities(where: {pokemon: {${NORMAL_OR_REGIONAL}}}, order_by: [{pokemon: {pokemon_species_id: asc}}, {pokemon_id: asc}]) {
      is_hidden pokemon { id name pokemon_species_id }
    }
  }
}`

const MOVES_QUERY = `{
  move(where: {id: {_lt: 10000}}, order_by: {name: asc}) {
    id name power accuracy pp priority generation_id move_effect_chance
    type { name }
    movedamageclass { name }
    moveeffect { moveeffecteffecttexts(where: {language_id: {_eq: ${ENGLISH}}}) { short_effect effect } }
    moveflavortexts(where: {language_id: {_eq: ${ENGLISH}}}, order_by: {version_group_id: desc}, limit: 1) { flavor_text }
  }
}`

/**
 * Tidy PokeAPI text: fill in $effect_chance, turn "[label]{mechanic:x}" links into
 * plain words, and collapse the odd line breaks in game flavor text.
 */
export function cleanText(text, effectChance) {
  if (!text) return ''
  return text
    .replace(/\$effect_chance/g, effectChance ?? '?')
    .replace(/\[([^\]]*)\]\{[^:}]*:([^}]*)\}/g, (_, label, id) => label || id.replace(/-/g, ' '))
    .replace(/[\f­]/g, ' ')
    .replace(/[ \t]*\n[ \t]*(?!\n)/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

export function normalizeAbility(a) {
  const effect = a.abilityeffecttexts[0]
  const flavor = cleanText(a.abilityflavortexts[0]?.flavor_text)
  return {
    id: a.id,
    name: a.name,
    generation: a.generation_id,
    short: cleanText(effect?.short_effect) || flavor,
    effect: cleanText(effect?.effect),
    flavor,
    // id = PokeAPI pokemon id (sprite + detail panel), dex = national dex number.
    pokemon: a.pokemonabilities.map((p) => ({
      id: p.pokemon.id,
      dex: p.pokemon.pokemon_species_id,
      name: p.pokemon.name,
      label: formName(p.pokemon.name),
      hidden: p.is_hidden,
    })),
  }
}

export function normalizeMove(m) {
  const effect = m.moveeffect?.moveeffecteffecttexts[0]
  const flavor = cleanText(m.moveflavortexts[0]?.flavor_text)
  return {
    id: m.id,
    name: m.name,
    type: m.type?.name ?? null,
    category: m.movedamageclass?.name ?? null,
    power: m.power,
    accuracy: m.accuracy,
    pp: m.pp,
    priority: m.priority,
    generation: m.generation_id,
    short: cleanText(effect?.short_effect, m.move_effect_chance) || flavor,
    effect: cleanText(effect?.effect, m.move_effect_chance),
    flavor,
  }
}

// ---- learnsets ----

// PokeAPI's move_learn_method ids. Anything else (Colosseum purification, etc.) is "special".
export const LEARN_METHODS = { 1: 'level-up', 2: 'egg', 3: 'tutor', 4: 'machine' }
const METHOD_ORDER = ['level-up', 'machine', 'tutor', 'egg', 'special']

/** Japan-only duplicates and spin-offs without a normal learnset are left out of the game picker. */
const HIDDEN_GAMES = new Set(['red-green-japan', 'blue-japan', 'colosseum', 'xd'])

export function methodName(methodId) {
  return LEARN_METHODS[methodId] ?? 'special'
}

/** Short label for one way of learning a move, e.g. "Lv. 26", "TM", "Egg". */
export function methodLabel(method, level) {
  switch (method) {
    case 'level-up':
      if (level === null || level === undefined) return 'Level-up'
      return level === 0 ? 'On evolution' : `Lv. ${level}`
    case 'machine':
      return 'TM'
    case 'tutor':
      return 'Tutor'
    case 'egg':
      return 'Egg move'
    default:
      return 'Special'
  }
}

/**
 * Group learnset rows by a key (a Pokémon id or a move id) into sorted "ways to learn":
 * { [key]: [{ method: 'level-up', level: 7 }, { method: 'machine', level: null }] }
 * `level` is only kept for level-up moves when the rows come from a single game.
 */
export function groupLearnset(rows, keyOf, singleGame) {
  const grouped = {}
  for (const row of rows) {
    const key = keyOf(row)
    const method = methodName(row.move_learn_method_id)
    const level = method === 'level-up' && singleGame ? row.level : null
    const list = (grouped[key] ??= [])
    if (!list.some((w) => w.method === method && w.level === level)) list.push({ method, level })
  }
  for (const list of Object.values(grouped)) list.sort(compareWays)
  return grouped
}

export function compareWays(a, b) {
  const byMethod = METHOD_ORDER.indexOf(a.method) - METHOD_ORDER.indexOf(b.method)
  return byMethod || (a.level ?? 0) - (b.level ?? 0)
}

/** Games that have learnset data, oldest first. */
export async function getGames() {
  const data = await query(
    'games',
    `{ versiongroup(order_by: {order: asc}) { id name generation_id } }`,
  )
  return data.versiongroup
    .filter((g) => !HIDDEN_GAMES.has(g.name))
    .map((g) => ({ id: g.id, name: g.name, generation: g.generation_id }))
}

// With one game we need every row (levels differ); across all games one row per
// (Pokémon/move, method) is enough, which keeps popular moves like Tackle small.
function learnsetQuery(field, id, otherField, gameId) {
  const where = [`${field}: {_eq: ${Number(id)}}`]
  // For "who learns this move": normal forms plus regional forms (Alolan Dugtrio…).
  if (field === 'move_id') where.push(`pokemon: {${NORMAL_OR_REGIONAL}}`)
  if (gameId) where.push(`version_group_id: {_eq: ${Number(gameId)}}`)
  const distinct = gameId
    ? ''
    : `distinct_on: [${otherField}, move_learn_method_id], order_by: [{${otherField}: asc}, {move_learn_method_id: asc}],`
  return `{ pokemonmove(where: {${where.join(', ')}}, ${distinct}) {
    ${otherField} move_learn_method_id level pokemon { id name pokemon_species_id }
  } }`
}

/**
 * Pokémon (and regional forms) that can learn a move:
 * [{ id, dex, name, label, ways: [...] }], in dex order, each form right after its normal form.
 */
export async function getMoveLearners(moveId, gameId = null) {
  const data = await query(
    `learners:${moveId}:${gameId ?? 'all'}`,
    learnsetQuery('move_id', moveId, 'pokemon_id', gameId),
  )
  const info = {}
  for (const row of data.pokemonmove) info[row.pokemon.id] = row.pokemon
  const ways = groupLearnset(data.pokemonmove, (r) => r.pokemon.id, Boolean(gameId))
  return Object.keys(ways)
    .map(Number)
    .sort((a, b) => info[a].pokemon_species_id - info[b].pokemon_species_id || a - b)
    .map((id) => ({
      id,
      dex: info[id].pokemon_species_id,
      name: info[id].name,
      label: formName(info[id].name),
      ways: ways[id],
    }))
}

/** Moves a Pokémon can learn, by PokeAPI pokemon id (so regional forms work too): { [moveId]: ways }. */
export async function getLearnset(pokemonId, gameId = null) {
  const data = await query(
    `learnset:${pokemonId}:${gameId ?? 'all'}`,
    learnsetQuery('pokemon_id', pokemonId, 'move_id', gameId),
  )
  return groupLearnset(data.pokemonmove, (r) => r.move_id, Boolean(gameId))
}

// ---- types per Pokémon, per generation ----

function groupBy(rows, keyOf) {
  const out = {}
  for (const row of rows) (out[keyOf(row)] ??= []).push(row)
  return out
}

const typesBySlot = (rows) => [...rows].sort((a, b) => a.slot - b.slot).map((r) => r.type.name)

/**
 * Every species and regional form with its current types and past types:
 * { id, dex, name, label, generation, types: ['fairy'], pastTypes: [{ upTo: 5, types: ['normal'] }] }
 * A pastTypes entry means "these types up to and including generation upTo".
 * A regional form's generation is when it appeared (Alolan Dugtrio: 7), not its dex number's.
 */
export function buildTypeRoster({ pokemonspecies, pokemontype, pokemontypepast }, forms = []) {
  const current = groupBy(pokemontype, (r) => r.pokemon_id)
  const past = groupBy(pokemontypepast, (r) => r.pokemon_id)
  const pastFor = (id) =>
    Object.entries(groupBy(past[id] ?? [], (r) => r.generation_id))
      .map(([gen, rows]) => ({ upTo: Number(gen), types: typesBySlot(rows) }))
      .sort((a, b) => a.upTo - b.upTo)

  const species = pokemonspecies.map((s) => ({
    id: s.id,
    dex: s.id,
    name: s.name,
    label: formName(s.name),
    generation: s.generation_id,
    types: typesBySlot(current[s.id] ?? []),
    pastTypes: pastFor(s.id),
  }))
  const regional = forms.map((f) => ({
    id: f.id,
    dex: f.speciesId,
    name: f.name,
    label: formName(f.name),
    generation: regionOf(f.name)?.generation ?? 1,
    types: typesBySlot(current[f.id] ?? []),
    pastTypes: pastFor(f.id),
  }))
  return [...species, ...regional].sort((a, b) => a.dex - b.dex || a.id - b.id)
}

/** The types a roster entry had in a given generation. */
export function rosterTypesInGeneration(entry, gen) {
  return entry.pastTypes.find((p) => p.upTo >= gen)?.types ?? entry.types
}

export async function getTypeRoster() {
  const [data, forms] = await Promise.all([
    query(
      'type-roster',
      `{
        pokemonspecies(order_by: {id: asc}) { id name generation_id }
        pokemontype(where: {pokemon: {${NORMAL_OR_REGIONAL}}}) { pokemon_id slot type { name } }
        pokemontypepast { pokemon_id generation_id slot type { name } }
      }`,
    ),
    getRegionalForms(),
  ])
  return buildTypeRoster(data, forms)
}

/** Evolution family per species, for the dupes clause: { [speciesId]: evolutionChainId }. */
export async function getEvolutionFamilies() {
  const data = await query('evolution-families', `{ pokemonspecies { id evolution_chain_id } }`)
  return Object.fromEntries(data.pokemonspecies.map((s) => [s.id, s.evolution_chain_id ?? -s.id]))
}

// ---- regional forms ----

// Not real regional variants: the boss-only Totem Raticate and the hat-wearing Pikachu.
export const NOT_REGIONAL = /totem|-cap$/

/** All Alolan / Galarian / Hisuian / Paldean forms: [{ id, name, speciesId }]. */
export async function getRegionalForms() {
  const data = await query(
    'regional-forms',
    `{ pokemon(where: {is_default: {_eq: false}, _or: [
        {name: {_like: "%-alola%"}}, {name: {_like: "%-galar%"}},
        {name: {_like: "%-hisui%"}}, {name: {_like: "%-paldea%"}}
      ]}, order_by: {id: asc}) { id name pokemon_species_id } }`,
  )
  return data.pokemon
    .filter((p) => !NOT_REGIONAL.test(p.name))
    .map((p) => ({ id: p.id, name: p.name, speciesId: p.pokemon_species_id }))
}

const cache = new Map()

function query(key, gql) {
  if (!cache.has(key)) {
    const promise = fetch(GRAPHQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: gql }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`PokeAPI returned ${res.status}`)
        return res.json()
      })
      .then((json) => {
        if (json.errors) throw new Error(json.errors[0].message)
        return json.data
      })
    cache.set(key, promise)
    promise.catch(() => cache.delete(key))
  }
  return cache.get(key)
}

export async function getAbilities() {
  return (await query('abilities', ABILITIES_QUERY)).ability.map(normalizeAbility)
}

export async function getMoves() {
  return (await query('moves', MOVES_QUERY)).move.map(normalizeMove)
}

// Before Gen 4 a move's type decided physical or special.
const SPECIAL_TYPES = new Set(['fire', 'water', 'grass', 'electric', 'psychic', 'ice', 'dragon', 'dark'])

/**
 * Every move as it was in one generation (Leech Life: 20 power before Gen 7, Bite: Normal before Gen 2).
 * PokeAPI's move changes hold the values in effect *before* their version group's generation.
 */
export async function getMovesInGeneration(gen) {
  const [moves, data] = await Promise.all([
    getMoves(),
    query('move-changes', `{ movechange(order_by: {version_group_id: asc}) { move_id power accuracy pp type { name } versiongroup { generation_id } } }`),
  ])
  const later = groupBy(data.movechange.filter((c) => c.versiongroup.generation_id > gen), (c) => c.move_id)
  return moves.filter((m) => m.generation <= gen).map((m) => {
    const out = { ...m }
    // The earliest change after this generation says what the values still were.
    for (const field of ['power', 'accuracy', 'pp']) {
      const c = later[m.id]?.find((x) => x[field] !== null)
      if (c) out[field] = c[field]
    }
    const t = later[m.id]?.find((x) => x.type)
    if (t) out.type = t.type.name
    if (gen < 4 && out.category !== 'status') out.category = SPECIAL_TYPES.has(out.type) ? 'special' : 'physical'
    return out
  })
}
