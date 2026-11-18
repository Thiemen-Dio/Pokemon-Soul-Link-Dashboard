import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  displayName,
  formatDexNumber,
  generationRangeLabel,
  getPokemonDetails,
  spriteUrl,
} from '../api/pokeapi.js'
import TypeLink from './TypeLink.jsx'
import TypeMatchups from './TypeMatchups.jsx'

// Links close the panel first, so it doesn't stay open over the page we navigate to.
function TypeBadges({ types, onNavigate }) {
  return (
    <div className="types">
      {types.map((t) => <TypeLink key={t} type={t} onClick={onNavigate} />)}
    </div>
  )
}

const STAT_LABELS = {
  hp: 'HP',
  attack: 'Atk',
  defense: 'Def',
  'special-attack': 'SpA',
  'special-defense': 'SpD',
  speed: 'Spe',
}

export default function PokemonDetail({ id, onSelect, onClose }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError(false)
    getPokemonDetails(id)
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setError(true))
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="overlay" onClick={onClose}>
      <article className="detail" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button className="close" onClick={onClose} aria-label="Close">×</button>

        {error && <p className="status error">Couldn’t load this Pokémon.</p>}
        {!data && !error && <p className="status">Loading…</p>}

        {data && (
          <>
            <header className="detail-head">
              <img src={data.artwork} alt={data.label} width="180" height="180" />
              <div>
                <span className="dex-number">
                  {formatDexNumber(data.dex)}
                  {data.region && <span className="region-tag">{data.region.adjective} form</span>}
                </span>
                <h3>{data.label}</h3>
                <p className="genus">{data.genus}</p>
                <TypeBadges types={data.types} onNavigate={onClose} />
                {data.flavor && <p className="flavor">{data.flavor}</p>}
              </div>
            </header>

            {/* Two columns on wide screens: facts & stats left, typing right. */}
            <div className="detail-columns">
              <section>
                <dl className="facts">
                  <div><dt>Height</dt><dd>{data.heightM} m</dd></div>
                  <div><dt>Weight</dt><dd>{data.weightKg} kg</dd></div>
                </dl>

                <h4>Abilities</h4>
                <div className="ability-links">
                  {data.abilities.map((a) => (
                    <Link
                      key={a.name}
                      to={`/pokedex/abilities/${a.name}`}
                      onClick={onClose}
                      className="ability-chip"
                      title={`Open the ${displayName(a.name)} ability`}
                    >
                      {displayName(a.name)}
                      {a.hidden && <span className="hidden-tag">hidden</span>}
                    </Link>
                  ))}
                </div>

                <h4>Base stats</h4>
                <table className="stats">
                  <tbody>
                    {data.stats.map((s) => (
                      <tr key={s.name}>
                        <th>{STAT_LABELS[s.name] ?? s.name}</th>
                        <td className="stat-value">{s.value}</td>
                        <td className="stat-bar">
                          <span style={{ width: `${Math.min(100, (s.value / 255) * 100)}%` }} />
                        </td>
                      </tr>
                    ))}
                    <tr className="total">
                      <th>Total</th>
                      <td className="stat-value">{data.stats.reduce((sum, s) => sum + s.value, 0)}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>

                {data.evolutions.length > 1 && (
                  <>
                    <h4>Evolution</h4>
                    <ol className="evolutions">
                      {data.evolutions.map((stage, i) => (
                        <li key={i}>
                          {stage.map((p) => (
                            <button
                              key={p.id}
                              className={p.id === data.id ? 'evo current' : 'evo'}
                              onClick={() => onSelect(p.id)}
                            >
                              {/* p.id is the form's own id, so regional forms show their own picture. */}
                              <img src={spriteUrl(p.id)} alt="" width="72" height="72" />
                              {p.label}
                            </button>
                          ))}
                        </li>
                      ))}
                    </ol>
                  </>
                )}
              </section>

              <section>
                {data.typeHistory.length > 1 && (
                  <>
                    <h4>Types by generation</h4>
                    <dl className="type-history">
                      {data.typeHistory.map((range) => (
                        <div key={range.from}>
                          <dt>{generationRangeLabel(range)}</dt>
                          <dd><TypeBadges types={range.types} onNavigate={onClose} /></dd>
                        </div>
                      ))}
                    </dl>
                  </>
                )}

                <TypeMatchups
                  key={data.id}
                  typeHistory={data.typeHistory}
                  introducedIn={data.introducedIn}
                  onNavigate={onClose}
                />
              </section>
            </div>
          </>
        )}
      </article>
    </div>
  )
}
