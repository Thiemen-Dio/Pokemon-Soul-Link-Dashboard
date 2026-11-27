// Test copy of the Pokédex detail card.
// New here: evolution method under each stage, PokémonDB-style stat bars with a nature preview,
// one generation choice for matchups + level-up moves, and a level-up move list under the matchups.
// gen: open at this generation (the run's game, when opened from a run).
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  TYPE_COLORS,
  chartForGeneration,
  defensiveMatchups,
  displayName,
  formatDexNumber,
  generationRangeLabel,
  getPokemonDetails,
  getTypeData,
  spriteUrl,
  typesInGeneration,
} from '../../../api/pokeapi.js'
import { getGames, getLearnset, getMoves } from '../../../api/pokeapiGraphql.js'
import { gameLabel } from '../../../api/games.js'
import TypeLink from '../../../components/TypeLink.jsx'
import { NATURES } from '../items.js'

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX']
const LATEST_GEN = 9
const STAT_LABELS = { hp: 'HP', attack: 'Atk', defense: 'Def', 'special-attack': 'SpA', 'special-defense': 'SpD', speed: 'Spe' }
// Same bands as the run cards (pokemondb.net colours).
const valueColor = (v) => (v < 30 ? '#f34444' : v < 60 ? '#ff7f0f' : v < 90 ? '#ffdd57' : v < 120 ? '#a0e515' : v < 150 ? '#23cd5e' : '#00c2b8')
const GROUPS = [
  { label: 'Weak ×4', test: (m) => m === 4 },
  { label: 'Weak ×2', test: (m) => m === 2 },
  { label: 'Resists ×½', test: (m) => m === 0.5 },
  { label: 'Resists ×¼', test: (m) => m === 0.25 },
  { label: 'Immune ×0', test: (m) => m === 0 },
]

function TypeBadges({ types, onNavigate }) {
  return <div className="types">{types.map((t) => <TypeLink key={t} type={t} onClick={onNavigate} />)}</div>
}

function Stats({ stats }) {
  const [nature, setNature] = useState('')
  const [up, down] = NATURES[nature] ?? []
  const value = (s) => Math.round(s.value * (s.name === up ? 1.1 : s.name === down ? 0.9 : 1))
  return (
    <>
      <div className="section-head">
        <h4>Base stats</h4>
        <select value={nature} onChange={(e) => setNature(e.target.value)} aria-label="Preview a nature">
          <option value="">No nature</option>
          {Object.entries(NATURES).map(([n, [u, d]]) => (
            <option key={n} value={n}>{displayName(n)}{u ? ` (+${STAT_LABELS[u]} −${STAT_LABELS[d]})` : ' (neutral)'}</option>
          ))}
        </select>
      </div>
      <table className="stats dex-stats">
        <tbody>
          {stats.map((s) => (
            <tr key={s.name} className={s.name === up ? 'nat-up' : s.name === down ? 'nat-down' : ''}>
              <th>{s.name === up ? '+' : s.name === down ? '−' : ''}{STAT_LABELS[s.name] ?? s.name}</th>
              <td className="stat-value">{value(s)}</td>
              <td className="stat-bar"><span style={{ width: `${Math.min(100, (value(s) / 255) * 100)}%`, background: valueColor(value(s)) }} /></td>
            </tr>
          ))}
          <tr className="total">
            <th>Total</th>
            <td className="stat-value">{stats.reduce((sum, s) => sum + value(s), 0)}</td>
            <td />
          </tr>
        </tbody>
      </table>
    </>
  )
}

function Matchups({ types, gen, onNavigate }) {
  const [typeData, setTypeData] = useState(null)
  const [error, setError] = useState(false)
  useEffect(() => { getTypeData().then(setTypeData).catch(() => setError(true)) }, [])
  const matchups = useMemo(() => (typeData ? defensiveMatchups(chartForGeneration(typeData, gen), types) : []), [typeData, gen, types])
  if (error) return <p className="status error">Couldn’t load the type chart.</p>
  if (!typeData) return <p className="status">Loading…</p>
  return (
    <dl className="matchups">
      {GROUPS.map(({ label, test }) => {
        const hits = matchups.filter((m) => test(m.multiplier))
        if (!hits.length) return null
        return (
          <div key={label}>
            <dt>{label}</dt>
            <dd className="types">{hits.map((m) => <TypeLink key={m.type} type={m.type} small onClick={onNavigate} />)}</dd>
          </div>
        )
      })}
    </dl>
  )
}

/** Level-up moves in one game of the chosen generation. */
function LevelUpMoves({ id, gen }) {
  const [games, setGames] = useState(null)
  const [gameId, setGameId] = useState(null)
  const [rows, setRows] = useState(null)

  useEffect(() => {
    getGames().then((all) => {
      const here = all.filter((g) => g.generation === gen)
      setGames(here)
      setGameId(here.at(-1)?.id ?? null)
    }).catch(() => setGames([]))
  }, [gen])

  useEffect(() => {
    if (!gameId) return
    let live = true
    setRows(null)
    Promise.all([getLearnset(id, gameId), getMoves()]).then(([learnset, moves]) => {
      const byId = Object.fromEntries(moves.map((m) => [m.id, m]))
      const list = Object.entries(learnset).flatMap(([moveId, ways]) =>
        ways.filter((w) => w.method === 'level-up').map((w) => ({ level: w.level, move: byId[moveId] })))
        .filter((r) => r.move).sort((a, b) => a.level - b.level || a.move.name.localeCompare(b.move.name))
      if (live) setRows(list)
    }).catch(() => live && setRows([]))
    return () => { live = false }
  }, [id, gameId])

  if (!games) return <p className="status">Loading…</p>
  if (games.length === 0) return <p className="status small-print">No games with move data in Gen {ROMAN[gen]}.</p>
  return (
    <>
      {games.length > 1 && (
        <div className="tabs game-tabs" role="group" aria-label="Game">
          {games.map((g) => <button key={g.id} type="button" aria-pressed={g.id === gameId} onClick={() => setGameId(g.id)}>{gameLabel(g.name)}</button>)}
        </div>
      )}
      {!rows ? <p className="status">Loading…</p> : rows.length === 0 ? (
        <p className="status small-print">Not in {gameLabel(games.find((g) => g.id === gameId)?.name ?? '')}, or no level-up data.</p>
      ) : (
        <table className="levelup">
          <thead><tr><th>Lv</th><th>Move</th><th>Cat.</th><th className="num">Pow</th><th className="num">Acc</th></tr></thead>
          <tbody>
            {rows.map(({ level, move }) => (
              <tr key={`${level}-${move.id}`}>
                <td className="num">{level === 0 ? 'Evo' : level}</td>
                <td><span className="move-name" style={{ '--type-color': TYPE_COLORS[move.type] }}>{displayName(move.name)}</span></td>
                <td>{move.category && <span className={`cat cat-${move.category}`}>{move.category}</span>}</td>
                <td className="num">{move.power ?? '—'}</td>
                <td className="num">{move.accuracy ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}

export default function PokemonDetail({ id, onSelect, onClose, gen: startGen = LATEST_GEN }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)
  const [gen, setGen] = useState(startGen)
  const [showMoves, setShowMoves] = useState(false)

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError(false)
    getPokemonDetails(id).then((d) => !cancelled && setData(d)).catch(() => !cancelled && setError(true))
    return () => { cancelled = true }
  }, [id])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // A Pokémon from a later generation is shown in its first one.
  const shownGen = data ? Math.max(gen, data.introducedIn) : gen
  const gens = []
  for (let g = data?.introducedIn ?? 1; g <= LATEST_GEN; g++) gens.push(g)

  return (
    <div className="overlay test-dex-overlay" onClick={onClose}>
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
                <TypeBadges types={typesInGeneration(data.typeHistory, shownGen)} onNavigate={onClose} />
                {data.flavor && <p className="flavor">{data.flavor}</p>}
              </div>
            </header>

            <div className="detail-columns">
              <section>
                <dl className="facts">
                  <div><dt>Height</dt><dd>{data.heightM} m</dd></div>
                  <div><dt>Weight</dt><dd>{data.weightKg} kg</dd></div>
                </dl>

                <h4>Abilities</h4>
                <div className="ability-links">
                  {data.abilities.map((a) => (
                    <Link key={a.name} to={`/pokedex/abilities/${a.name}`} onClick={onClose} className="ability-chip" title={`Open the ${displayName(a.name)} ability`}>
                      {displayName(a.name)}
                      {a.hidden && <span className="hidden-tag">hidden</span>}
                    </Link>
                  ))}
                </div>

                <Stats stats={data.stats} />

                {data.evolutions.length > 1 && (
                  <>
                    <h4>Evolution</h4>
                    <ol className="evo-lane">
                      {data.evolutions.map((stage, i) => (
                        <li key={i}>
                          {i > 0 && <span className="evo-arrow" aria-hidden="true">→</span>}
                          {/* Many branches (Eevee): two columns, so the lane stays short. */}
                          <div className="evo-stage" style={{ '--cols': stage.length > 3 ? 2 : 1 }}>
                            {stage.map((p) => (
                              <button key={p.id} className={p.id === data.id ? 'evo current' : 'evo'} onClick={() => onSelect(p.id)}>
                                <img src={spriteUrl(p.id)} alt="" width="80" height="80" />
                                <span className="evo-name">{p.label}</span>
                                {p.how && <span className="evo-how">{p.how}</span>}
                              </button>
                            ))}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </>
                )}
              </section>

              <section>
                <div className="section-head">
                  <h4>Generation</h4>
                  <select value={shownGen} onChange={(e) => setGen(Number(e.target.value))} aria-label="Generation for typing, matchups and moves">
                    {gens.map((g) => <option key={g} value={g}>Gen {ROMAN[g]}</option>)}
                  </select>
                </div>

                {data.typeHistory.length > 1 && (
                  <dl className="type-history">
                    {data.typeHistory.map((range) => (
                      <div key={range.from}>
                        <dt>{generationRangeLabel(range)}</dt>
                        <dd><TypeBadges types={range.types} onNavigate={onClose} /></dd>
                      </div>
                    ))}
                  </dl>
                )}

                <h4>Type matchups</h4>
                <Matchups types={typesInGeneration(data.typeHistory, shownGen)} gen={shownGen} onNavigate={onClose} />

                <div className="section-head">
                  <h4>Level-up moves</h4>
                  <button type="button" className="chip-button" aria-expanded={showMoves} onClick={() => setShowMoves((s) => !s)}>
                    {showMoves ? 'Hide' : 'Show'}
                  </button>
                </div>
                {showMoves && <LevelUpMoves id={data.id} gen={shownGen} />}
              </section>
            </div>
          </>
        )}
      </article>
    </div>
  )
}
