const API = 'https://pokeapi.co/api/v2'
const SPRITES = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon'

export const GENERATIONS = [
  { id: 'all', label: 'All generations' },
  { id: 1, label: 'Gen I · Kanto' },
  { id: 2, label: 'Gen II · Johto' },
  { id: 3, label: 'Gen III · Hoenn' },
  { id: 4, label: 'Gen IV · Sinnoh' },
  { id: 5, label: 'Gen V · Unova' },
  { id: 6, label: 'Gen VI · Kalos' },
  { id: 7, label: 'Gen VII · Alola' },
  { id: 8, label: 'Gen VIII · Galar' },
  { id: 9, label: 'Gen IX · Paldea' },
]

export const TYPE_COLORS = {
  normal: '#9fa19f', fire: '#e62829', water: '#2980ef', electric: '#e5b700',
  grass: '#3fa129', ice: '#3dcef3', fighting: '#ff8000', poison: '#9141cb',
  ground: '#915121', flying: '#81b9ef', psychic: '#ef4179', bug: '#91a119',
  rock: '#afa981', ghost: '#704170', dragon: '#5060e1', dark: '#624d4e',
  steel: '#60a1b8', fairy: '#ef70ef',
}

export function idFromUrl(url) {
  const match = /\/(\d+)\/?$/.exec(url ?? '')
  return match ? Number(match[1]) : null
}

export function formatDexNumber(id) {
  return `#${String(id).padStart(4, '0')}`
}

export function displayName(name) {
  return name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function spriteUrl(id) {
  return `${SPRITES}/${id}.png`
}

/** Large official artwork (used e.g. faded behind the generation blocks). */
export function artworkUrl(id) {
  return `${SPRITES}/other/official-artwork/${id}.png`
}

// ---- regional forms (Alolan Dugtrio, Galarian Meowth, Hisuian Growlithe, Paldean Tauros…) ----

const REGIONS = {
  alola: { adjective: 'Alolan', generation: 7 },
  galar: { adjective: 'Galarian', generation: 8 },
  hisui: { adjective: 'Hisuian', generation: 8 },
  paldea: { adjective: 'Paldean', generation: 9 },
}

/** The region a form belongs to, from its PokeAPI name ("dugtrio-alola" → alola), or null. */
export function regionOf(name) {
  const part = name.split('-').find((p) => REGIONS[p])
  return part ? { key: part, ...REGIONS[part] } : null
}

/**
 * Readable name for a Pokémon or form:
 * "dugtrio-alola" → "Alolan Dugtrio", "tauros-paldea-combat-breed" → "Paldean Tauros (Combat Breed)",
 * "darmanitan-galar-zen" → "Galarian Darmanitan (Zen)", "mr-mime-galar" → "Galarian Mr Mime".
 */
export function formName(name) {
  const parts = name.split('-')
  const at = parts.findIndex((p) => REGIONS[p])
  if (at < 0) return displayName(name)
  const base = displayName(parts.slice(0, at).join('-'))
  const rest = parts.slice(at + 1).filter((p) => p !== 'standard')
  const extra = rest.length ? ` (${displayName(rest.join('-'))})` : ''
  return `${REGIONS[parts[at]].adjective} ${base}${extra}`
}

/**
 * Entries in the dex grid: { id (PokeAPI pokemon id, used for sprite/details),
 * dex (national dex number), name, label }. Regional forms are placed right after
 * their normal form and share its dex number.
 */
export function withRegionalForms(species, forms) {
  const bySpecies = {}
  for (const f of forms) (bySpecies[f.speciesId] ??= []).push(f)
  return species.flatMap((s) => [
    { id: s.id, dex: s.id, name: s.name, label: displayName(s.name) },
    ...(bySpecies[s.id] ?? []).map((f) => ({ id: f.id, dex: s.id, name: f.name, label: formName(f.name) })),
  ])
}

export function matchesQuery(entry, query) {
  const q = query.trim().toLowerCase().replace(/^#/, '')
  if (!q) return true
  if (/^\d+$/.test(q)) return String(entry.dex ?? entry.id).startsWith(String(Number(q)))
  const label = (entry.label ?? '').toLowerCase()
  return entry.name.includes(q.replace(/\s+/g, '-')) || label.includes(q)
}

export function englishFlavorText(species) {
  const entries = (species?.flavor_text_entries ?? []).filter((e) => e.language.name === 'en')
  const latest = entries.at(-1)
  return latest ? latest.flavor_text.replace(/\s+/g, ' ').trim() : ''
}

/**
 * Cards for the dex grid for one generation choice. A regional form is listed under the
 * generation where it can be caught (Alolan Dugtrio: Gen VII), not its dex number's
 * generation. Within that generation the forms come right after the starters' evolution
 * lines (`afterDex` = dex number of the last one, e.g. Primarina). With 'all', forms sit
 * right after their normal form.
 */
export function gridForGeneration(gen, species, forms, afterDex = null) {
  if (gen === 'all') return withRegionalForms(species, forms)
  const here = forms
    .filter((f) => regionOf(f.name)?.generation === gen)
    .map((f) => ({ id: f.id, dex: f.speciesId, name: f.name, label: formName(f.name) }))
    .sort((a, b) => a.dex - b.dex || a.id - b.id)
  const normal = withRegionalForms(species, [])
  const last = normal.findIndex((e) => e.dex === afterDex)
  const at = last < 0 ? 0 : last + 1
  return [...normal.slice(0, at), ...here, ...normal.slice(at)]
}

// ---- evolution line that matches the Pokémon's form ----

const NOT_REGIONAL_FORM = /totem|-cap$/

/** A species' normal form and its regional forms: { default: {name,id}, byRegion: { alola: {name,id} } }. */
export function formsOfSpecies(species) {
  const def = species.varieties.find((v) => v.is_default).pokemon
  const byRegion = {}
  for (const v of species.varieties) {
    if (v.is_default || NOT_REGIONAL_FORM.test(v.pokemon.name)) continue
    const r = regionOf(v.pokemon.name)
    if (r && !byRegion[r.key]) byRegion[r.key] = { name: v.pokemon.name, id: idFromUrl(v.pokemon.url) }
  }
  return { default: { name: def.name, id: idFromUrl(def.url) }, byRegion }
}

/**
 * The evolution tree as it works for one variant: region = 'alola' | 'galar' | 'hisui' |
 * 'paldea', or null for the normal forms. Uses PokeAPI's evolution details, which say
 * which form evolves ("meowth-galar → perrserker") and into which form ("pikachu → raichu-alola").
 * info: { [speciesName]: formsOfSpecies(...) }. Returns { form: {name,id}, children: [...] }.
 */
export function evolutionTreeFor(chain, region, info) {
  const root = info[chain.species.name]
  const build = (node, form) => {
    const parent = info[node.species.name]
    const parentIsRegional = form.name !== parent.default.name
    const children = []
    for (const child of node.evolves_to) {
      const kid = info[child.species.name]
      const details = child.evolution_details.map((d) => ({
        req: d.required_pokemon_form?.name ?? null,
        evo: d.evolved_pokemon_form?.name ?? null,
        region: d.region?.name ?? null,
        raw: d,
      }))
      // An ordinary evolution: no special form needed or produced, not tied to a region.
      const ordinary = (d) =>
        (!d.req || d.req === parent.default.name) && (!d.evo || d.evo === kid.default.name) && !d.region
      const forRegion = (d) =>
        region && (d.region === region || regionOf(d.req ?? '')?.key === region || regionOf(d.evo ?? '')?.key === region)

      let applies
      if (parentIsRegional) {
        // A regional form only evolves the way PokeAPI says that form evolves.
        applies = details.filter((d) => d.req === form.name)
        if (!applies.length) applies = details.filter(forRegion)
      } else if (region) {
        applies = details.filter(forRegion)
        if (!applies.length) applies = details.filter(ordinary)
      } else {
        applies = details.filter(ordinary)
      }
      if (!applies.length) continue

      const evo = applies.find((d) => d.evo)?.evo
      const childForm = evo
        ? evo === kid.default.name
          ? kid.default
          : kid.byRegion[regionOf(evo)?.key] ?? kid.default
        : (region && kid.byRegion[region]) || kid.default
      children.push({ ...build(child, childForm), how: evolutionHow(applies.map((d) => d.raw)) })
    }
    return { form, children }
  }
  return build(chain, (region && root.byRegion[region]) || root.default)
}

const words = (slug) => slug.replace(/-/g, ' ')

/** One PokeAPI evolution_details entry in plain words: "Lv 16", "Fire Stone", "Trade holding Metal Coat". */
function detailHow(d) {
  const trigger = d.trigger?.name
  const bits = []
  if (trigger === 'trade') bits.push(d.held_item ? `Trade holding ${displayName(d.held_item.name)}` : d.trade_species ? `Trade for ${displayName(d.trade_species.name)}` : 'Trade')
  else if (d.item) bits.push(displayName(d.item.name))
  else if (d.min_level) bits.push(`Lv ${d.min_level}`)
  else if (trigger === 'level-up') bits.push('Level up')
  else if (trigger) bits.push(displayName(trigger))
  if (trigger !== 'trade' && d.held_item) bits.push(`holding ${displayName(d.held_item.name)}`)
  if (d.min_happiness) bits.push('high friendship')
  if (d.min_affection) bits.push('high affection')
  if (d.min_beauty) bits.push('high beauty')
  if (d.time_of_day) bits.push(`at ${d.time_of_day}`)
  if (d.known_move) bits.push(`knowing ${displayName(d.known_move.name)}`)
  if (d.known_move_type) bits.push(`knowing a ${words(d.known_move_type.name)} move`)
  if (d.location) bits.push(`at ${displayName(d.location.name)}`)
  if (d.gender === 1) bits.push('female')
  if (d.gender === 2) bits.push('male')
  if (d.needs_overworld_rain) bits.push('in rain')
  if (d.turn_upside_down) bits.push('console upside down')
  if (d.party_species) bits.push(`with ${displayName(d.party_species.name)} in party`)
  if (d.party_type) bits.push(`with a ${words(d.party_type.name)} type in party`)
  if (d.relative_physical_stats === 1) bits.push('Atk > Def')
  if (d.relative_physical_stats === -1) bits.push('Atk < Def')
  if (d.relative_physical_stats === 0) bits.push('Atk = Def')
  return bits.join(', ')
}

/** All ways an evolution can happen, without repeats (games differ, e.g. a stone or a place). */
export function evolutionHow(details) {
  const ways = [...new Set(details.map(detailHow).filter(Boolean))]
  return ways.length > 2 ? `${ways.slice(0, 2).join(' / ')} / …` : ways.join(' / ') || null
}

function treeHas(tree, name) {
  return tree.form.name === name || tree.children.some((c) => treeHas(c, name))
}

/** Flatten a tree into stages: [[{id, name, label}], [...], ...]. */
export function treeStages(tree) {
  const stages = []
  let level = [tree]
  while (level.length) {
    stages.push(level.map((n) => ({ id: n.form.id, name: n.form.name, label: formName(n.form.name), how: n.how ?? null })))
    level = level.flatMap((n) => n.children)
  }
  return stages
}

/**
 * The evolution stages that belong with this Pokémon, with matching pictures:
 * Alolan Dugtrio → Alolan Diglett → Alolan Dugtrio; Perrserker → Galarian Meowth → Perrserker.
 */
export async function evolutionLine(chain, pokemonName, ownRegion) {
  if (!chain) return []
  const names = []
  const collect = (n) => {
    names.push(n.species)
    n.evolves_to.forEach(collect)
  }
  collect(chain)
  const species = await Promise.all(names.map((s) => getJson(s.url)))
  const info = Object.fromEntries(names.map((s, i) => [s.name, formsOfSpecies(species[i])]))

  // Try this Pokémon's own variant first; a species like Perrserker is only reached via
  // a regional form (Galarian Meowth), so then try each region.
  const tries = [...new Set([ownRegion ?? null, null, 'alola', 'galar', 'hisui', 'paldea'])]
  for (const region of tries) {
    const tree = evolutionTreeFor(chain, region, info)
    if (treeHas(tree, pokemonName)) return treeStages(tree)
  }
  return treeStages(evolutionTreeFor(chain, null, info))
}

/**
 * Types per generation range, e.g. Clefairy:
 * [{ from: 1, to: 5, types: ['normal'] }, { from: 6, to: null, types: ['fairy'] }]
 * PokeAPI's past_types entries mean "these types up to and including this generation".
 */
export function typeHistory(currentTypes, pastTypes = [], introducedIn = 1) {
  const history = []
  let from = introducedIn
  const past = pastTypes
    .map((p) => ({
      to: idFromUrl(p.generation.url),
      types: [...p.types].sort((a, b) => a.slot - b.slot).map((t) => t.type.name),
    }))
    .sort((a, b) => a.to - b.to)
  for (const { to, types } of past) {
    if (to < from) continue
    history.push({ from, to, types })
    from = to + 1
  }
  history.push({ from, to: null, types: currentTypes })
  return history
}

/** The types a Pokémon had in a given generation, from its typeHistory. */
export function typesInGeneration(history, gen) {
  return (history.find((r) => gen >= r.from && (r.to === null || gen <= r.to)) ?? history.at(-1)).types
}

/**
 * Attack chart for one generation: { attacker: { defender: multiplier } }.
 * Uses each type's past_damage_relations ("relations up to and including that
 * generation") and leaves out types that didn't exist yet (Dark/Steel < II, Fairy < VI).
 */
export function chartForGeneration(typeResponses, gen) {
  const existing = new Set(
    typeResponses.filter((t) => idFromUrl(t.generation.url) <= gen).map((t) => t.name),
  )
  const chart = {}
  for (const type of typeResponses) {
    if (!existing.has(type.name)) continue
    const past = (type.past_damage_relations ?? [])
      .map((p) => ({ upTo: idFromUrl(p.generation.url), relations: p.damage_relations }))
      .filter((p) => p.upTo >= gen)
      .sort((a, b) => a.upTo - b.upTo)[0]
    const relations = past?.relations ?? type.damage_relations
    const row = {}
    const set = (list, value) =>
      list.forEach(({ name }) => existing.has(name) && (row[name] = value))
    set(relations.double_damage_to, 2)
    set(relations.half_damage_to, 0.5)
    set(relations.no_damage_to, 0)
    chart[type.name] = row
  }
  return chart
}

/** Multiplier of every attacking type against a defender with the given types. */
export function defensiveMatchups(chart, defenderTypes) {
  return Object.keys(chart).map((attacker) => ({
    type: attacker,
    multiplier: defenderTypes.reduce((m, def) => m * (chart[attacker][def] ?? 1), 1),
  }))
}

/** Raw /type responses for all 18 types (cached, shared with getTypeMap). */
export function getTypeData() {
  return Promise.all(Object.keys(TYPE_COLORS).map((t) => getJson(`${API}/type/${t}`)))
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']

export function generationRangeLabel({ from, to }) {
  if (to === null) return `Gen ${ROMAN[from] ?? from}+`
  if (from === to) return `Gen ${ROMAN[from] ?? from}`
  return `Gen ${ROMAN[from] ?? from}–${ROMAN[to] ?? to}`
}

const cache = new Map()

async function getJson(url) {
  if (!cache.has(url)) {
    const promise = fetch(url).then((res) => {
      if (!res.ok) throw new Error(`PokeAPI returned ${res.status}`)
      return res.json()
    })
    cache.set(url, promise)
    promise.catch(() => cache.delete(url))
  }
  return cache.get(url)
}

/** Species in a generation (or every species for 'all'), sorted by national dex number. */
export async function getGeneration(gen) {
  const list =
    gen === 'all'
      ? (await getJson(`${API}/pokemon-species?limit=10000`)).results
      : (await getJson(`${API}/generation/${gen}`)).pokemon_species
  return list
    .map((s) => ({ name: s.name, id: idFromUrl(s.url) }))
    .sort((a, b) => a.id - b.id)
}

/**
 * Build { [pokemonId]: ['grass', 'poison'] } from the /type endpoints.
 * 18 requests cover every Pokémon, instead of one request per Pokémon.
 */
export async function getTypeMap() {
  return buildTypeMap(await getTypeData())
}

export function buildTypeMap(typeResponses) {
  const slots = {}
  for (const type of typeResponses) {
    for (const { pokemon, slot } of type.pokemon) {
      const id = idFromUrl(pokemon.url)
      ;(slots[id] ??= []).push({ slot, name: type.name })
    }
  }
  const map = {}
  for (const [id, list] of Object.entries(slots)) {
    map[id] = list.sort((a, b) => a.slot - b.slot).map((t) => t.name)
  }
  return map
}

/**
 * Everything the detail view needs for one Pokémon. `id` is a PokeAPI pokemon id, so it
 * works for regional forms too (e.g. 10106 = Alolan Dugtrio); the species comes from it.
 */
export async function getPokemonDetails(id) {
  const pokemon = await getJson(`${API}/pokemon/${id}`)
  const species = await getJson(pokemon.species.url)
  const chain = species.evolution_chain?.url ? await getJson(species.evolution_chain.url) : null
  const types = [...pokemon.types].sort((a, b) => a.slot - b.slot).map((t) => t.type.name)
  // A regional form first appeared in its region's generation (Alolan forms: Gen VII).
  const region = pokemon.is_default ? null : regionOf(pokemon.name)
  const introducedIn = region?.generation ?? idFromUrl(species.generation?.url) ?? 1
  return {
    id: pokemon.id,
    dex: species.id,
    name: pokemon.is_default ? species.name : pokemon.name,
    label: pokemon.is_default ? displayName(species.name) : formName(pokemon.name),
    region,
    types,
    introducedIn,
    typeHistory: typeHistory(types, pokemon.past_types, introducedIn),
    heightM: pokemon.height / 10,
    weightKg: pokemon.weight / 10,
    abilities: pokemon.abilities.map((a) => ({ name: a.ability.name, hidden: a.is_hidden })),
    stats: pokemon.stats.map((s) => ({ name: s.stat.name, value: s.base_stat })),
    artwork: pokemon.sprites.other?.['official-artwork']?.front_default ?? spriteUrl(pokemon.id),
    genus: species.genera.find((g) => g.language.name === 'en')?.genus ?? '',
    flavor: englishFlavorText(species),
    evolutions: await evolutionLine(chain?.chain, pokemon.name, region?.key),
  }
}
