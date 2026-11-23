import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, useParams } from 'react-router-dom'
import {
  TYPE_COLORS,
  chartForGeneration,
  displayName,
  getTypeData,
  idFromUrl,
  spriteUrl,
} from '../../../api/pokeapi.js'
import { getTypeRoster, rosterTypesInGeneration } from '../../../api/pokeapiGraphql.js'
import { GenerationPicker, PickerRow } from '../../../components/Pickers.jsx'
import PokemonDetail from '../../../components/PokemonDetail.jsx'
import TypeLink from '../../../components/TypeLink.jsx'

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX']
const LATEST_GEN = 9
const CELL = { 2: '2', 0.5: '½', 0: '0' }

export default function TypesTab() {
  const { typeName } = useParams()
  // 'all' = today's type chart and every Pokémon; a number = how things were in that generation.
  const [genChoice, setGenChoice] = useState('all')
  const gen = genChoice === 'all' ? LATEST_GEN : genChoice
  const genText = genChoice === 'all' ? 'all generations' : `Gen ${ROMAN[gen]} games`
  const [typeData, setTypeData] = useState(null)
  const [roster, setRoster] = useState(null)
  const [error, setError] = useState(false)
  const [detailId, setDetailId] = useState(null)

  useEffect(() => {
    getTypeData().then(setTypeData).catch(() => setError(true))
    getTypeRoster().then(setRoster).catch(() => setError(true))
  }, [])

  const chart = useMemo(() => typeData && chartForGeneration(typeData, gen), [typeData, gen])
  const types = chart ? Object.keys(chart) : []
  const selected = TYPE_COLORS[typeName] ? typeName : null

  return (
    <>
      <PickerRow>
        <GenerationPicker
          value={genChoice}
          onChange={setGenChoice}
          title="Type chart"
          allLabel="All generations (current chart)"
          labelFor={(o) => `As in Gen ${o.short} games`}
        />
      </PickerRow>

      {error && <p className="status error">Couldn’t reach PokeAPI. Try again later.</p>}
      {!chart && !error && <p className="status">Loading types…</p>}

      {chart && (
        <nav className="type-picker" aria-label="Types">
          <NavLink to="/pokedex/types" end className="type-pick overview">All types</NavLink>
          {types.map((t) => (
            <NavLink
              key={t}
              to={`/pokedex/types/${t}`}
              className="type-pick"
              style={{ '--type-color': TYPE_COLORS[t] }}
            >
              {t}
            </NavLink>
          ))}
        </nav>
      )}

      {chart && !selected && <TypeChart chart={chart} types={types} genText={genText} />}

      {chart && selected && !chart[selected] && (
        <p className="status">
          The {displayName(selected)} type doesn’t exist yet in Gen {ROMAN[gen]}. It was added in Gen{' '}
          {ROMAN[idFromUrl(typeData.find((t) => t.name === selected).generation.url)]}.
        </p>
      )}

      {chart && selected && chart[selected] && (
        <TypeDetail
          type={selected}
          chart={chart}
          gen={gen}
          genText={genText}
          roster={roster}
          onSelectPokemon={setDetailId}
        />
      )}

      {detailId && (
        <PokemonDetail id={detailId} onSelect={setDetailId} onClose={() => setDetailId(null)} />
      )}
    </>
  )
}

/** The full attacker × defender chart for one generation. */
function TypeChart({ chart, types, genText }) {
  return (
    <>
      <p className="status">
        Type chart for {genText}. Rows attack, columns defend: 2 = super effective, ½ = not very
        effective, 0 = no effect. Click a type for details.
      </p>
      <div className="table-wrap">
        <table className="type-chart">
          <thead>
            <tr>
              <th className="corner">Atk ↓ / Def →</th>
              {types.map((t) => (
                <th key={t} className="col-head">
                  <Link to={`/pokedex/types/${t}`} style={{ background: TYPE_COLORS[t] }} title={displayName(t)}>
                    {t.slice(0, 3)}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {types.map((att) => (
              <tr key={att}>
                <th className="row-head"><TypeLink type={att} small /></th>
                {types.map((def) => {
                  const m = chart[att][def] ?? 1
                  return (
                    <td
                      key={def}
                      className={`cell m-${String(m).replace('.', '')}`}
                      title={`${displayName(att)} → ${displayName(def)}: ×${m}`}
                    >
                      {CELL[m] ?? ''}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function TypeGroup({ label, types }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className="types">
        {types.length ? types.map((t) => <TypeLink key={t} type={t} small />) : <span className="status">None</span>}
      </dd>
    </div>
  )
}

/** One type: what it hits, what hits it, and which Pokémon have it in this generation. */
function TypeDetail({ type, chart, gen, genText, roster, onSelectPokemon }) {
  const all = Object.keys(chart)
  const attacking = (m) => all.filter((def) => (chart[type][def] ?? 1) === m)
  const defending = (m) => all.filter((att) => (chart[att][type] ?? 1) === m)

  const pokemon = useMemo(
    () =>
      (roster ?? []).filter(
        (p) => p.generation <= gen && rosterTypesInGeneration(p, gen).includes(type),
      ),
    [roster, gen, type],
  )

  return (
    <article className="type-detail">
      <header className="type-detail-head" style={{ '--type-color': TYPE_COLORS[type] }}>
        <h3>{displayName(type)}</h3>
        <span className="status">in {genText}</span>
        <Link className="chip-button" to={`/pokedex/moves?type=${type}`}>
          See all {displayName(type)} moves →
        </Link>
      </header>

      <div className="type-columns">
        <section>
          <h4>When attacking with {displayName(type)}</h4>
          <dl className="matchups">
            <TypeGroup label="Super effective ×2" types={attacking(2)} />
            <TypeGroup label="Not very effective ×½" types={attacking(0.5)} />
            <TypeGroup label="No effect ×0" types={attacking(0)} />
          </dl>
        </section>
        <section>
          <h4>When defending as {displayName(type)}</h4>
          <dl className="matchups">
            <TypeGroup label="Weak to ×2" types={defending(2)} />
            <TypeGroup label="Resists ×½" types={defending(0.5)} />
            <TypeGroup label="Immune ×0" types={defending(0)} />
          </dl>
        </section>
      </div>
      <p className="status small-print">
        For a dual-type Pokémon the two types are multiplied, e.g. ×2 and ×2 makes ×4, ×2 and ×½ makes ×1.
      </p>

      <h4>
        {displayName(type)} Pokémon in {genText}
        {roster && ` (${pokemon.length})`}
      </h4>
      {!roster && <p className="status">Loading…</p>}
      {roster && (
        <ul className="mini-mons">
          {pokemon.map((p) => {
            const other = rosterTypesInGeneration(p, gen).filter((t) => t !== type)
            return (
              <li key={p.id}>
                <button className="mini-mon" onClick={() => onSelectPokemon(p.id)}>
                  <img src={spriteUrl(p.id)} alt="" loading="lazy" width="56" height="56" />
                  <span>{p.label}</span>
                  <span className="ways">{other.length ? `+ ${other.join(' / ')}` : `pure ${type}`}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </article>
  )
}
