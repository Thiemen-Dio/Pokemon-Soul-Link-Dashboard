// Test copy of the Pokédex Pokémon tab: chip pickers with multi-pick and a primary type.
import { useEffect, useMemo, useState } from 'react'
import {
  formatDexNumber,
  getGeneration,
  getTypeMap,
  gridForGeneration,
  matchesQuery,
  regionOf,
  spriteUrl,
} from '../../../api/pokeapi.js'
import { getRegionalForms } from '../../../api/pokeapiGraphql.js'
import { STARTERS } from '../../../components/starters.js'
import TypeLink from '../../../components/TypeLink.jsx'
import PokemonDetail from './PokemonDetail.jsx'
import { GenerationChips, TypeChips, typeFilterMatches } from './Pickers.jsx'
import './pokedex.css'

/** Grid entries for the chosen generations ([] = all), in generation order. */
async function loadGrid(gens) {
  const forms = await getRegionalForms().catch(() => [])
  if (gens.length === 0) return gridForGeneration('all', await getGeneration('all'), forms)
  const lists = await Promise.all([...gens].sort((a, b) => a - b).map(async (g) =>
    gridForGeneration(g, await getGeneration(g), forms, STARTERS[g][2] + 2)))
  return lists.flat()
}

export default function PokemonTab() {
  const [gens, setGens] = useState([1])
  const [typeFilter, setTypeFilter] = useState({ types: [], primary: null })
  const [multiGen, setMultiGen] = useState(false)
  const [multiType, setMultiType] = useState(false)
  const [species, setSpecies] = useState([])
  const [typeMap, setTypeMap] = useState(null)
  const [status, setStatus] = useState('loading')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(null)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    loadGrid(gens)
      .then((list) => { if (!cancelled) { setSpecies(list); setStatus('ready') } })
      .catch(() => !cancelled && setStatus('error'))
    return () => { cancelled = true }
  }, [gens])

  useEffect(() => {
    getTypeMap().then(setTypeMap).catch(() => setTypeMap({}))
  }, [])

  // Switching multi-pick off keeps only the first choice.
  const setMultiGenAndTrim = (on) => { setMultiGen(on); if (!on) setGens((g) => g.slice(0, 1)) }
  const setMultiTypeAndTrim = (on) => {
    setMultiType(on)
    if (!on) setTypeFilter(({ types, primary }) => {
      const keep = types.includes(primary) ? [primary] : types.slice(0, 1)
      return { types: keep, primary: keep.includes(primary) ? primary : null }
    })
  }

  const filtering = typeFilter.types.length > 0
  const visible = useMemo(
    () => species.filter((s) => matchesQuery(s, query) && (!filtering || typeFilterMatches(typeMap?.[s.id], typeFilter))),
    [species, query, typeFilter, filtering, typeMap],
  )
  const typesLoading = filtering && !typeMap

  return (
    <>
      <div className="dex-filters">
        <GenerationChips value={gens} onChange={setGens} multi={multiGen} onMulti={setMultiGenAndTrim} />
        <TypeChips value={typeFilter} onChange={setTypeFilter} multi={multiType} onMulti={setMultiTypeAndTrim} />
      </div>
      <div className="toolbar">
        <input type="search" placeholder="Search name or #" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {(status === 'loading' || typesLoading) && <p className="status">Loading…</p>}
      {status === 'error' && <p className="status error">Couldn’t reach PokeAPI. Try again later.</p>}
      {status === 'ready' && !typesLoading && (
        <p className="status">
          {visible.length} Pokémon
          {visible.some((s) => s.id !== s.dex) && ` (incl. ${visible.filter((s) => s.id !== s.dex).length} regional forms)`}
        </p>
      )}

      {status === 'ready' && !typesLoading && (
        <ul className="dex-grid">
          {visible.map((s) => (
            <li key={s.id} className={s.id !== s.dex ? 'dex-card regional' : 'dex-card'}>
              <img src={spriteUrl(s.id)} alt="" loading="lazy" width="96" height="96" />
              <span className="dex-number">
                {formatDexNumber(s.dex)}
                {s.id !== s.dex && <span className="region-tag">{regionOf(s.name)?.adjective}</span>}
              </span>
              <button className="dex-name card-button" onClick={() => setSelectedId(s.id)}>{s.label}</button>
              <span className="types">
                {(typeMap?.[s.id] ?? []).map((t) => <TypeLink key={t} type={t} small />)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {selectedId && <PokemonDetail id={selectedId} onSelect={setSelectedId} onClose={() => setSelectedId(null)} />}
    </>
  )
}
