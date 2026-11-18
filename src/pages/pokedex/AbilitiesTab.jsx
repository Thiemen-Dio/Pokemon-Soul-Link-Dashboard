import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { displayName, spriteUrl } from '../../api/pokeapi.js'
import { getAbilities } from '../../api/pokeapiGraphql.js'
import { GenerationPicker, PickerRow } from '../../components/Pickers.jsx'
import PokemonDetail from '../../components/PokemonDetail.jsx'

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX']

export default function AbilitiesTab() {
  const [abilities, setAbilities] = useState(null)
  const [error, setError] = useState(false)
  const [query, setQuery] = useState('')
  const [gen, setGen] = useState('all')
  const [selectedPokemon, setSelectedPokemon] = useState(null)

  // The open ability lives in the URL (/pokedex/abilities/levitate), so other pages can link to it.
  const { abilityName } = useParams()
  const navigate = useNavigate()

  useEffect(() => {
    getAbilities().then(setAbilities).catch(() => setError(true))
  }, [])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (abilities ?? []).filter(
      (a) =>
        (gen === 'all' || a.generation === gen) &&
        (!q || a.name.includes(q.replace(/\s+/g, '-')) || a.short.toLowerCase().includes(q)),
    )
  }, [abilities, query, gen])

  // When arriving via a link: clear filters that would hide the ability, then scroll to it.
  useEffect(() => {
    if (!abilityName || !abilities) return
    if (!visible.some((a) => a.name === abilityName)) {
      if (abilities.some((a) => a.name === abilityName)) {
        setQuery('')
        setGen('all')
      }
      return
    }
    document.getElementById(`ability-${abilityName}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [abilityName, abilities, visible])

  const linkedMissing = abilityName && abilities && !abilities.some((a) => a.name === abilityName)

  return (
    <>
      <PickerRow>
        <GenerationPicker
          value={gen}
          onChange={setGen}
          title="Introduced in"
          labelFor={(o) => `New in ${o.label}`}
        />
      </PickerRow>
      <div className="toolbar">
        <input
          type="search"
          placeholder="Search name or effect"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {error && <p className="status error">Couldn’t reach PokeAPI. Try again later.</p>}
      {!abilities && !error && <p className="status">Loading abilities…</p>}
      {abilities && <p className="status">{visible.length} abilities · click one for the full explanation</p>}
      {linkedMissing && (
        <p className="status error">There’s no ability called “{displayName(abilityName)}”.</p>
      )}

      <ul className="entry-list">
        {visible.map((a) => {
          const open = abilityName === a.name
          return (
            <li key={a.id} id={`ability-${a.name}`} className={open ? 'entry open' : 'entry'}>
              <button
                className="entry-head"
                onClick={() => navigate(open ? '/pokedex/abilities' : `/pokedex/abilities/${a.name}`, { replace: true })}
                aria-expanded={open}
              >
                <span className="entry-name">{displayName(a.name)}</span>
                <span className="entry-gen">Gen {ROMAN[a.generation]}</span>
                <span className="entry-short">{a.short}</span>
              </button>

              {open && (
                <div className="entry-body">
                  {a.effect && a.effect !== a.short && (
                    <>
                      <h5>How it works</h5>
                      {a.effect.split(/\n\n+/).map((p, i) => <p key={i}>{p}</p>)}
                    </>
                  )}
                  {a.flavor && a.flavor !== a.short && (
                    <>
                      <h5>In-game description</h5>
                      <p className="flavor">{a.flavor}</p>
                    </>
                  )}
                  <h5>Pokémon with {displayName(a.name)} ({a.pokemon.length})</h5>
                  {a.pokemon.length === 0 ? (
                    <p className="status">No regular Pokémon have this ability.</p>
                  ) : (
                    <ul className="mini-mons">
                      {a.pokemon.map((p) => (
                        <li key={p.id}>
                          <button className="mini-mon" onClick={() => setSelectedPokemon(p.id)}>
                            <img src={spriteUrl(p.id)} alt="" loading="lazy" width="56" height="56" />
                            <span>{p.label}</span>
                            {p.hidden && <span className="hidden-tag">hidden</span>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {selectedPokemon && (
        <PokemonDetail
          id={selectedPokemon}
          onSelect={setSelectedPokemon}
          onClose={() => setSelectedPokemon(null)}
        />
      )}
    </>
  )
}
