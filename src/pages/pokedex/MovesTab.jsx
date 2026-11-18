import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  GENERATIONS,
  TYPE_COLORS,
  displayName,
  formatDexNumber,
  getGeneration,
  spriteUrl,
  withRegionalForms,
} from '../../api/pokeapi.js'
import { compareWays, getGames, getLearnset, getMoves, getRegionalForms, methodLabel } from '../../api/pokeapiGraphql.js'
import { gameLabel } from '../../api/games.js'
import { GenerationPicker, PickerRow, TypePicker } from '../../components/Pickers.jsx'
import MoveLearners from '../../components/MoveLearners.jsx'
import PokemonDetail from '../../components/PokemonDetail.jsx'

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX']
const CATEGORIES = {
  physical: 'Physical — uses Attack vs. Defense',
  special: 'Special — uses Sp. Atk vs. Sp. Def',
  status: 'Status — no direct damage',
}

const dash = (v, suffix = '') => (v === null || v === undefined ? '—' : `${v}${suffix}`)

/**
 * Find a Pokémon or regional form by typed name ("mr mime", "Alolan Dugtrio", "dugtrio-alola")
 * or number ("25", "#025" — the normal form).
 */
function findSpecies(species, text) {
  const q = text.trim().toLowerCase().replace(/^#/, '')
  if (!q) return null
  if (/^\d+$/.test(q)) return species.find((s) => s.dex === Number(q) && s.id === s.dex) ?? null
  const slug = q.replace(/[.']/g, '').replace(/\s+/g, '-')
  return species.find((s) => s.name === slug || s.label.toLowerCase() === q) ?? null
}

export default function MovesTab() {
  const [moves, setMoves] = useState(null)
  const [games, setGames] = useState([])
  const [species, setSpecies] = useState([])
  const [error, setError] = useState(false)

  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState('')
  // "See all Fire moves" on the Types tab links here as /pokedex/moves?type=fire
  const [type, setType] = useState(() => (TYPE_COLORS[searchParams.get('type')] ? searchParams.get('type') : ''))
  const [category, setCategory] = useState('')
  const [gen, setGen] = useState('all')
  const [gameId, setGameId] = useState(null)
  const [pokemonText, setPokemonText] = useState('')
  const [pokemonId, setPokemonId] = useState(null)
  const [learnset, setLearnset] = useState(null)
  const [learnsetError, setLearnsetError] = useState(false)

  const [openId, setOpenId] = useState(null)
  const [detailId, setDetailId] = useState(null)

  useEffect(() => {
    getMoves().then(setMoves).catch(() => setError(true))
    getGames().then(setGames).catch(() => setGames([]))
    // Every Pokémon plus regional forms, so you can look up Alolan Dugtrio's moves too.
    Promise.all([getGeneration('all'), getRegionalForms().catch(() => [])])
      .then(([list, forms]) => setSpecies(withRegionalForms(list, forms)))
      .catch(() => setSpecies([]))
  }, [])

  useEffect(() => {
    if (!pokemonId) return setLearnset(null)
    let cancelled = false
    setLearnset(null)
    setLearnsetError(false)
    getLearnset(pokemonId, gameId)
      .then((ls) => !cancelled && setLearnset(ls))
      .catch(() => !cancelled && setLearnsetError(true))
    return () => {
      cancelled = true
    }
  }, [pokemonId, gameId])

  const game = games.find((g) => g.id === gameId)
  const pokemon = species.find((s) => s.id === pokemonId)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = (moves ?? []).filter(
      (m) =>
        (!learnset || learnset[m.id]) &&
        (!type || m.type === type) &&
        (!category || m.category === category) &&
        (gen === 'all' || m.generation === gen) &&
        (!q || m.name.includes(q.replace(/\s+/g, '-')) || m.short.toLowerCase().includes(q)),
    )
    // For a Pokémon's learnset: level-up moves first (by level), then TMs, tutor, egg moves.
    if (learnset) list.sort((a, b) => compareWays(learnset[a.id][0], learnset[b.id][0]) || a.name.localeCompare(b.name))
    return list
  }, [moves, learnset, query, type, category, gen])

  function choosePokemon(match) {
    setPokemonId(match.id)
    setPokemonText('')
  }

  // Pick automatically only when the typed name can't still grow into another one
  // ("mew" could become "mewtwo"); numbers and ambiguous names wait for Enter.
  function onPokemonInput(text) {
    setPokemonText(text)
    const match = findSpecies(species, text)
    if (match && !/^#?\d+$/.test(text.trim())) {
      const longer = species.some((s) => s.name !== match.name && s.name.startsWith(match.name))
      if (!longer) choosePokemon(match)
    }
  }

  function onPokemonKeyDown(e) {
    if (e.key !== 'Enter') return
    const match = findSpecies(species, pokemonText)
    if (match) choosePokemon(match)
  }

  const waitingForLearnset = pokemonId && !learnset && !learnsetError
  const columns = learnset ? 8 : 7

  return (
    <>
      <PickerRow>
        <TypePicker value={type} onChange={setType} />
        <GenerationPicker
          value={gen}
          onChange={setGen}
          title="Introduced in"
          labelFor={(o) => `New in ${o.label}`}
        />
      </PickerRow>
      <div className="toolbar">
        <input
          list="pokemon-names"
          placeholder="Pokémon: name or # + Enter"
          value={pokemonText}
          onChange={(e) => onPokemonInput(e.target.value)}
          onKeyDown={onPokemonKeyDown}
          aria-label="Show the moves of a Pokémon"
        />
        <datalist id="pokemon-names">
          {species.map((s) => <option key={s.id} value={s.label} />)}
        </datalist>
        <select
          value={gameId ?? ''}
          onChange={(e) => setGameId(e.target.value ? Number(e.target.value) : null)}
          aria-label="Game"
        >
          <option value="">All games</option>
          {games.map((g) => <option key={g.id} value={g.id}>{gameLabel(g.name)}</option>)}
        </select>
        <input
          type="search"
          placeholder="Search move name or effect"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="toolbar">
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {Object.keys(CATEGORIES).map((c) => <option key={c} value={c}>{displayName(c)}</option>)}
        </select>
      </div>

      {pokemon && (
        <div className="learnset-banner">
          <img src={spriteUrl(pokemon.id)} alt="" width="56" height="56" />
          <div>
            <strong>Moves {pokemon.label} can learn</strong>
            <span className="status"> {formatDexNumber(pokemon.dex)} · {game ? gameLabel(game.name) : 'all games combined'}</span>
          </div>
          <button className="chip-button" onClick={() => setDetailId(pokemon.id)}>View Pokémon</button>
          <button className="chip-button" onClick={() => setPokemonId(null)} aria-label="Stop filtering by Pokémon">× Clear</button>
        </div>
      )}

      {(error || learnsetError) && <p className="status error">Couldn’t reach PokeAPI. Try again later.</p>}
      {(!moves || waitingForLearnset) && !error && !learnsetError && <p className="status">Loading moves…</p>}
      {moves && !waitingForLearnset && (
        <p className="status">
          {visible.length} moves
          {pokemon && learnset && Object.keys(learnset).length === 0 && game && ` · ${pokemon.label} isn’t in ${gameLabel(game.name)}`}
          {' · '}click one for the full explanation and who can learn it
        </p>
      )}

      {moves && !waitingForLearnset && (
        <div className="table-wrap">
          <table className="moves">
            <thead>
              <tr>
                {learnset && <th>How</th>}
                <th>Move</th>
                <th>Type</th>
                <th>Cat.</th>
                <th className="num" title="Base power">Pow</th>
                <th className="num" title="Accuracy">Acc</th>
                <th className="num" title="Power points: how many times it can be used">PP</th>
                <th>Effect</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((m) => {
                const open = openId === m.id
                return (
                  <MoveRow
                    key={m.id}
                    move={m}
                    ways={learnset?.[m.id]}
                    columns={columns}
                    open={open}
                    onToggle={() => setOpenId(open ? null : m.id)}
                  >
                    <MoveLearners
                      moveId={m.id}
                      moveName={m.name}
                      gameId={gameId}
                      gameName={game && gameLabel(game.name)}
                      onSelectPokemon={setDetailId}
                    />
                  </MoveRow>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {detailId && (
        <PokemonDetail id={detailId} onSelect={setDetailId} onClose={() => setDetailId(null)} />
      )}
    </>
  )
}

function MoveRow({ move: m, ways, columns, open, onToggle, children }) {
  return (
    <>
      <tr className={open ? 'move-row open' : 'move-row'} onClick={onToggle}>
        {ways && <td className="ways-cell">{ways.map((w) => methodLabel(w.method, w.level)).join(', ')}</td>}
        <td className="entry-name">
          <button className="link-button" aria-expanded={open}>{displayName(m.name)}</button>
        </td>
        <td>
          {m.type && <span className="type small" style={{ background: TYPE_COLORS[m.type] }}>{m.type}</span>}
        </td>
        <td><span className={`cat cat-${m.category}`}>{m.category}</span></td>
        <td className="num">{dash(m.power)}</td>
        <td className="num">{dash(m.accuracy, '%')}</td>
        <td className="num">{dash(m.pp)}</td>
        <td className="entry-short">{m.short || 'No description available yet.'}</td>
      </tr>
      {open && (
        <tr className="move-detail">
          <td colSpan={columns}>
            <dl className="facts">
              <div><dt>Category</dt><dd>{CATEGORIES[m.category] ?? '—'}</dd></div>
              <div><dt>Priority</dt><dd>{m.priority > 0 ? `+${m.priority} (goes first)` : m.priority < 0 ? `${m.priority} (goes last)` : '0 (normal)'}</dd></div>
              <div><dt>Introduced</dt><dd>Gen {ROMAN[m.generation]}</dd></div>
            </dl>
            {m.effect && m.effect !== m.short && (
              <>
                <h5>How it works</h5>
                {m.effect.split(/\n\n+/).map((p, i) => <p key={i}>{p}</p>)}
              </>
            )}
            {m.flavor && m.flavor !== m.short && (
              <>
                <h5>In-game description</h5>
                <p className="flavor">{m.flavor}</p>
              </>
            )}
            {children}
          </td>
        </tr>
      )}
    </>
  )
}
