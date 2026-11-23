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
import { GenerationPicker, PickerRow, TypePicker } from '../../../components/Pickers.jsx'
import PokemonDetail from '../../../components/PokemonDetail.jsx'
import TypeLink from '../../../components/TypeLink.jsx'

export default function PokemonTab() {
  const [gen, setGen] = useState(1)
  const [type, setType] = useState('')
  const [species, setSpecies] = useState([])
  const [typeMap, setTypeMap] = useState(null)
  const [status, setStatus] = useState('loading')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(null)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    // Regional forms are optional: if they fail to load, still show the normal Pokémon.
    // A form is listed under the generation where it's caught (Alolan Dugtrio: Gen VII),
    // right after that region's starter lines (the water starter's final evolution).
    const lastStarterLine = gen === 'all' ? null : STARTERS[gen][2] + 2
    Promise.all([getGeneration(gen), getRegionalForms().catch(() => [])])
      .then(([list, forms]) => {
        if (cancelled) return
        setSpecies(gridForGeneration(gen, list, forms, lastStarterLine))
        setStatus('ready')
      })
      .catch(() => !cancelled && setStatus('error'))
    return () => {
      cancelled = true
    }
  }, [gen])

  useEffect(() => {
    getTypeMap()
      .then(setTypeMap)
      .catch(() => setTypeMap({}))
  }, [])

  const visible = useMemo(
    () =>
      species.filter(
        (s) => matchesQuery(s, query) && (!type || typeMap?.[s.id]?.includes(type)),
      ),
    [species, query, type, typeMap],
  )

  const typesLoading = type && !typeMap

  return (
    <>
      <PickerRow>
        <GenerationPicker value={gen} onChange={setGen} />
        <TypePicker value={type} onChange={setType} />
      </PickerRow>
      <div className="toolbar">
        <input
          type="search"
          placeholder="Search name or #"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
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
              {/* This button stretches over the whole card; the type links sit on top of it. */}
              <button className="dex-name card-button" onClick={() => setSelectedId(s.id)}>
                {s.label}
              </button>
              <span className="types">
                {(typeMap?.[s.id] ?? []).map((t) => <TypeLink key={t} type={t} small />)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {selectedId && (
        <PokemonDetail id={selectedId} onSelect={setSelectedId} onClose={() => setSelectedId(null)} />
      )}
    </>
  )
}
