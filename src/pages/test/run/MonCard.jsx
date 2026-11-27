// One caught Pokémon as it is now in the run: ability, stats with its held item, four moves, item (pinnable),
// what it's weak to / resists, and evolving. Ability, moves and item are saved on the encounter
// (p1_build / p2_build); evolving changes the run's Pokémon.
import { useEffect, useMemo, useRef, useState } from 'react'
import { defensiveMatchups, displayName, spriteUrl, TYPE_COLORS } from '../../../api/pokeapi.js'
import { getAbilities, getGames, getLearnset, getMovesInGeneration, rosterTypesInGeneration } from '../../../api/pokeapiGraphql.js'
import TypeBadge from './TypeBadge.jsx'
import PokemonDetail from '../pokedex/PokemonDetail.jsx'
import CategoryIcon from './CategoryIcon.jsx'
import { getHoldItems, getMonStats, getNextEvolutions, nickname, runSettings } from './data.js'
import { HELD_ITEMS, NATURES, STAT_KEYS, itemLabel, itemSprite, withBuild } from './items.js'

const STAT_LABELS = { hp: 'HP', attack: 'Atk', defense: 'Def', 'special-attack': 'SpA', 'special-defense': 'SpD', speed: 'Spe' }
const STATUS_TEXT = { team: 'on the team', box: 'in the PC', dead: 'dead', failed: 'failed', skipped: 'skipped', pending: 'waiting for the partner' }
const animatedUrl = (id) => spriteUrl(id).replace(/\/(\d+)\.png$/, '/other/showdown/$1.gif')
const MOVE_TABS = [['level', 'Level-up'], ['machine', 'TM & tutor'], ['other', 'All other moves']]

/**
 * Moves this Pokémon can have: { level: [{ move, level }], machine: [move], other: [move], starting, byId }.
 * Learnsets come from the game (or, when the Pokémon follow another generation, that generation's latest game);
 * power and type follow the run's move generation. Each list leaves out the moves of the lists before it.
 */
function useMoveOptions(run, id, monGen, movesGen) {
  const [state, setState] = useState(null)
  useEffect(() => {
    let live = true
    ;(async () => {
      const games = await getGames()
      const game = monGen === run.generation ? games.find((g) => g.name === run.base_game) : games.filter((g) => g.generation === monGen).at(-1)
      const [all, learnset] = await Promise.all([getMovesInGeneration(movesGen), getLearnset(id, game?.id ?? null)])
      const moves = all.filter((m) => m.generation <= run.generation)
      const byId = Object.fromEntries(moves.map((m) => [m.id, m]))
      const level = Object.entries(learnset).flatMap(([moveId, ways]) => ways.filter((w) => w.method === 'level-up' && byId[moveId]).map((w) => ({ move: byId[moveId], level: w.level })))
        .sort((a, b) => a.level - b.level || a.move.name.localeCompare(b.move.name))
      const seen = new Set(level.map((l) => l.move.id))
      const machine = Object.entries(learnset).filter(([moveId, ways]) => !seen.has(Number(moveId)) && byId[moveId] && ways.some((w) => w.method !== 'level-up'))
        .map(([moveId]) => byId[moveId]).sort((a, b) => a.name.localeCompare(b.name))
      machine.forEach((m) => seen.add(m.id))
      const other = moves.filter((m) => !seen.has(m.id)).sort((a, b) => a.name.localeCompare(b.name))
      // Moves it knows at level 1 in this game (the last four, like the game keeps).
      const starting = level.filter((l) => l.level === 1).map((l) => l.move).slice(-4).map(toSaved)
      if (live) setState({ level, machine, other, starting, byId })
    })().catch(() => live && setState({ level: [], machine: [], other: [], starting: [], byId: {} }))
    return () => { live = false }
  }, [run.base_game, run.generation, id, monGen, movesGen])
  return state
}

/** Close something (a list, a card) when the pointer goes down anywhere outside ref. */
export function useClickOutside(ref, onClose, active) {
  useEffect(() => {
    if (!active) return
    const down = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('pointerdown', down)
    return () => document.removeEventListener('pointerdown', down)
  }, [ref, onClose, active])
}

// Stat bars coloured by value like pokemondb.net; the nature shows on the stat name (+ red, − blue).
// pokemondb.net bands, low to high (shortcut: colours from memory, their stylesheet wasn't readable).
const valueColor = (v) => (v < 30 ? '#f34444' : v < 60 ? '#ff7f0f' : v < 90 ? '#ffdd57' : v < 120 ? '#a0e515' : v < 150 ? '#23cd5e' : '#00c2b8')

const toSaved = (m) => ({ id: m.id, name: m.name, type: m.type, power: m.power, category: m.category })

/** A filled move slot, opened: what the move does. */
function MoveInfo({ move }) {
  return (
    <div className="move-info">
      <span className="small-print">
        {move.accuracy ? `${move.accuracy}% accuracy` : 'Never misses'}{move.pp ? ` · ${move.pp} PP` : ''}{move.priority ? ` · priority ${move.priority > 0 ? '+' : ''}${move.priority}` : ''}
      </span>
      {move.short && <span className="small-print">{move.short}</span>}
    </div>
  )
}

/** Abilities this Pokémon can have in the run's generation (none before Gen 3, hidden ones from Gen 5). */
function useAbilityOptions(id, gen) {
  const [list, setList] = useState(null)
  useEffect(() => {
    let live = true
    if (gen < 3) { setList([]); return }
    getAbilities().then((all) => live && setList(all.flatMap((a) => {
      const hit = a.pokemon.find((p) => p.id === id)
      return hit && a.generation <= gen && (!hit.hidden || gen >= 5) ? [{ name: a.name, short: a.short, hidden: hit.hidden }] : []
    }).sort((a, b) => a.hidden - b.hidden))).catch(() => live && setList([]))
    return () => { live = false }
  }, [id, gen])
  return list
}

export default function MonCard({ run, row, player, names, rosterById, chart, onSave, picked, settings = runSettings(run) }) {
  // gen = the game (items, natures); monGen = what the Pokémon follow (typing, abilities, learnsets).
  const gen = run.generation
  const { monGen, movesGen } = settings
  const id = row[`${player}_pokemon_id`]
  const entry = rosterById[id]
  const build = row[`${player}_build`] ?? {}
  const [itemTab, setItemTab] = useState('held')
  const [allItems, setAllItems] = useState(null)
  const [dexOpen, setDexOpen] = useState(null) // Pokédex pop-up on the run page
  const types = entry ? rosterTypesInGeneration(entry, monGen) : []
  const nick = nickname(row, player, settings)

  const [stats, setStats] = useState(null)
  useEffect(() => {
    let live = true
    setStats(null)
    if (id) getMonStats([id]).then((s) => live && setStats(s[id])).catch(() => {})
    return () => { live = false }
  }, [id])
  const [evos, setEvos] = useState([])
  const dex = entry?.dex
  useEffect(() => {
    if (!dex) return
    getNextEvolutions([dex]).then((e) => setEvos((e[dex] ?? []).filter((x) => x.generation <= gen))).catch(() => setEvos([]))
  }, [dex, gen])
  const moveOptions = useMoveOptions(run, id, monGen, movesGen)
  const abilities = useAbilityOptions(id, monGen)
  // Until moves are set, it starts with its level 1 moves.
  const starting = build.moves === undefined && moveOptions?.starting?.length > 0
  // Saved moves show with this run's move generation (power, type, category).
  const moves = (build.moves ?? moveOptions?.starting ?? []).map((m) => (moveOptions?.byId[m.id] ? toSaved(moveOptions.byId[m.id]) : m))

  const [movesOpen, setMovesOpen] = useState(false) // the move picker under the four blocks
  const [moveTab, setMoveTab] = useState('level')
  const [moveText, setMoveText] = useState('')
  const [activeMove, setActiveMove] = useState(null) // index of the filled slot showing its info
  const [swapAt, setSwapAt] = useState(null) // index the picker replaces (null = adds a move)
  const moveRef = useRef(null)
  const closeMoves = useMemo(() => () => { setMovesOpen(false); setSwapAt(null); setActiveMove(null) }, [])
  useClickOutside(moveRef, closeMoves, movesOpen)
  const [itemsOpen, setItemsOpen] = useState(false)
  const itemRef = useRef(null)
  const closeItems = useMemo(() => () => setItemsOpen(false), [])
  useClickOutside(itemRef, closeItems, itemsOpen)
  const [confirmEvo, setConfirmEvo] = useState(null)

  if (!id) return <div className="mon-card"><span className="mon-owner">{names[player]}</span><p className="status">Not caught yet.</p></div>

  const saveBuild = (changes) => onSave(row, { [`${player}_build`]: { ...build, ...changes } })
  function addMove(m) {
    if (moves.some((x) => x.id === m.id)) return
    if (swapAt !== null) {
      // Swap: the picked move takes the slot's place.
      saveBuild({ moves: moves.map((x, i) => (i === swapAt ? toSaved(m) : x)) })
      closeMoves()
      return
    }
    if (moves.length >= 4) return
    if (moves.length === 3) setMovesOpen(false)
    saveBuild({ moves: [...moves, toSaved(m)] })
  }
  const forget = (i) => { saveBuild({ moves: moves.filter((_, j) => j !== i) }); closeMoves() }
  const swap = (i) => { setSwapAt(i); setMovesOpen(true) }
  // The open tab's moves, filtered by the search text.
  const q = moveText.trim().toLowerCase()
  const tabMoves = !moveOptions ? [] : (moveTab === 'level' ? moveOptions.level : moveOptions[moveTab].map((move) => ({ move })))
    .filter(({ move }) => !q || displayName(move.name).toLowerCase().includes(q) || move.type === q)
  const openItems = () => {
    setItemsOpen((o) => !o)
    if (!allItems) getHoldItems().then(setAllItems).catch(() => setAllItems([]))
  }
  const pickItem = (slug) => { setItemsOpen(false); saveBuild({ item: slug, itemPinned: slug ? build.itemPinned : false }) }

  const eff = withBuild(stats, build)
  const itemBoost = HELD_ITEMS[build.item]?.boost ?? {}
  const [natUp, natDown] = NATURES[build.nature] ?? []
  // The ability it has: the saved one, or the only one it can have.
  const ability = build.ability ?? (abilities?.filter((a) => !a.hidden).length === 1 ? abilities[0].name : null)
  const abilityInfo = abilities?.find((a) => a.name === ability)
  const matchups = chart && types.length ? defensiveMatchups(chart, types) : []
  const weak = matchups.filter((m) => m.multiplier > 1)
  const resist = matchups.filter((m) => m.multiplier < 1)

  return (
    <div className={picked ? 'mon-card picked' : 'mon-card'}>
      <div className="mon-card-head">
        <div className="anim-stage">
          <img src={animatedUrl(id)} alt={entry?.label ?? ''} onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = spriteUrl(id) }} />
        </div>
        <div>
          <span className="mon-owner">{names[player]} · {row.area} · {STATUS_TEXT[row.status]}</span>
          <div className="mon-card-title">
            <strong className="mon-card-name">{nick || entry?.label}</strong>
            <button type="button" className="chip-button dex-button" onClick={() => setDexOpen(id)}>Pokédex</button>
          </div>
          {nick && <span className="status small-print">{entry?.label}</span>}
          <span className="types">{types.map((t) => <TypeBadge key={t} type={t} small />)}</span>
          {stats?.legendary && <span className="small-print">★ Legendary</span>}
        </div>
      </div>

      {/* Opens at the run's game generation (its type chart, typing and moves). */}
      {dexOpen && <PokemonDetail id={dexOpen} gen={gen} onSelect={setDexOpen} onClose={() => setDexOpen(null)} />}

      <div className="build-pair">
      {gen >= 3 && (
        <div className="build-part">
          <span className="mini-label">Nature</span>
          <select className="ability-select" value={build.nature ?? ''} aria-label="Nature" onChange={(e) => saveBuild({ nature: e.target.value || null })}>
            <option value="">Pick its nature…</option>
            {Object.entries(NATURES).map(([n, [up, down]]) => (
              <option key={n} value={n}>{displayName(n)}{up ? ` (+${STAT_LABELS[up]} −${STAT_LABELS[down]})` : ' (neutral)'}</option>
            ))}
          </select>
        </div>
      )}

      {abilities?.length > 0 && (
        <div className="build-part">
          <span className="mini-label">Ability</span>
          <select className="ability-select" value={ability ?? ''} aria-label="Ability" onChange={(e) => saveBuild({ ability: e.target.value || null })}>
            {!ability && <option value="">Pick its ability…</option>}
            {abilities.map((a) => <option key={a.name} value={a.name}>{displayName(a.name)}{a.hidden ? ' (hidden)' : ''}</option>)}
          </select>
          {abilityInfo && <span className="status small-print">{abilityInfo.short}</span>}
        </div>
      )}
      </div>

      {evos.length > 0 && (
        <div className="evolve-row">
          {evos.map((e) => (
            confirmEvo === e.id ? (
              <span key={e.id} className="evolve-confirm">
                Evolve into {displayName(e.name)} in the run?
                <button type="button" className="primary-button" onClick={() => { setConfirmEvo(null); onSave(row, { [`${player}_pokemon_id`]: e.id }) }}>Evolve</button>
                <button type="button" className="chip-button" onClick={() => setConfirmEvo(null)}>Cancel</button>
              </span>
            ) : (
              <button key={e.id} type="button" className="chip-button" onClick={() => setConfirmEvo(e.id)} title={`Evolves: ${e.how}`}>
                <img className="pixel" src={spriteUrl(e.id)} alt="" width="32" height="32" /> Evolve into {displayName(e.name)} <em className="small-print">{e.how}</em>
              </button>
            )
          ))}
        </div>
      )}

      <span className="mini-label">Stats</span>
      {eff ? (
        <table className="stats">
          <tbody>
            {STAT_KEYS.map((k) => (
              <tr key={k} className={k === natUp ? 'nat-up' : k === natDown ? 'nat-down' : ''} title={k === natUp ? 'Raised by its nature (+10%)' : k === natDown ? 'Lowered by its nature (−10%)' : undefined}>
                <th>{k === natUp ? '+' : k === natDown ? '−' : ''}{STAT_LABELS[k]}</th>
                <td className="stat-value">{eff[k]}{itemBoost[k] && <img className="stat-item" src={itemSprite(build.item)} alt="" title={`Boosted by ${itemLabel(build.item)}`} width="18" height="18" />}</td>
                <td className="stat-bar"><span style={{ width: `${Math.min(100, (eff[k] / 255) * 100)}%`, background: valueColor(eff[k]) }} /></td>
              </tr>
            ))}
            <tr className="total"><th>Total</th><td className="stat-value">{eff.bst}</td><td className="small-print">{eff.bst !== stats.bst && `base ${stats.bst}`}</td></tr>
          </tbody>
        </table>
      ) : <p className="status small-print">Loading stats…</p>}

      <div className="build-part" ref={moveRef}>
        <span className="mini-label">Moves{starting && ' · starting moves (level 1), change them freely'}</span>
        <div className="move-blocks">
          {[0, 1, 2, 3].map((i) => {
            const m = moves[i]
            if (m) {
              const active = activeMove === i
              return (
                <div key={i} className={['move-block filled', active && 'active', swapAt === i && 'swapping'].filter(Boolean).join(' ')} style={{ '--type-color': TYPE_COLORS[m.type] }}>
                  <button type="button" className="move-main" aria-expanded={active} onClick={() => setActiveMove(active ? null : i)} title="Show this move">
                    <strong>{displayName(m.name)}</strong>
                    <span className="small-print move-meta"><CategoryIcon category={m.category} size={15} />{displayName(m.type)} · {m.power ? `${m.power} power` : 'status'}</span>
                  </button>
                  <span className="move-actions">
                    <button type="button" className="move-swap" onClick={() => swap(i)} aria-label={`Swap ${displayName(m.name)} for another move`} title="Swap for another move">
                      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M2 4h3.5l5 8H14M2 12h3.5L7 9.6M9 6.4 10.5 4H14M12 2l2 2-2 2M12 10l2 2-2 2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                    <button type="button" className="move-forget" onClick={() => forget(i)} aria-label={`Forget ${displayName(m.name)}`} title="Forget this move">×</button>
                  </span>
                  {active && <MoveInfo move={moveOptions?.byId[m.id] ?? m} />}
                </div>
              )
            }
            return (
              <button key={i} type="button" className="move-block empty" disabled={i !== moves.length} aria-expanded={i === moves.length ? movesOpen : undefined} onClick={() => { setSwapAt(null); setMovesOpen((o) => !o) }}>
                {i === moves.length ? '+ Move' : ''}
              </button>
            )
          })}
        </div>
        {movesOpen && (
          <div className="item-picker-wrap" onKeyDown={(e) => e.key === 'Escape' && closeMoves()}>
            {swapAt !== null && moves[swapAt] && <p className="status small-print">Pick a move to replace {displayName(moves[swapAt].name)}.</p>}
            <div className="tabs" role="group" aria-label="Move kind">
              {MOVE_TABS.map(([k, label]) => (
                <button key={k} type="button" aria-pressed={moveTab === k} onClick={() => setMoveTab(k)}>
                  {label}{moveOptions && <span className="tab-count">{moveOptions[k].length}</span>}
                </button>
              ))}
            </div>
            <input type="search" className="move-search" placeholder="Search a move or type (e.g. fire)" aria-label="Search moves" value={moveText} onChange={(e) => setMoveText(e.target.value)} />
            {!moveOptions ? <p className="status small-print">Loading moves…</p> : tabMoves.length === 0 ? <p className="status small-print">No moves here.</p> : (
              <ul className="move-picker">
                {tabMoves.map(({ move, level }) => {
                  const known = moves.some((x) => x.id === move.id)
                  return (
                    <li key={`${move.id}-${level ?? ''}`}>
                      <button type="button" className="move-block" style={{ '--type-color': TYPE_COLORS[move.type] }} disabled={known} onClick={() => addMove(move)} title={move.short}>
                        {level !== undefined && <span className="move-lv">{level === 0 ? 'Evo' : `Lv ${level}`}</span>}
                        <strong>{displayName(move.name)}</strong>
                        <span className="small-print move-meta"><CategoryIcon category={move.category} size={15} />{displayName(move.type)} · {move.power ? `${move.power} power` : 'status'}{move.accuracy ? ` · ${move.accuracy}%` : ''}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
            <p className="status small-print">Learnsets from Gen {monGen}, move power and type from Gen {movesGen} (see ⚙ Settings). Each list skips moves already in the lists before it.</p>
          </div>
        )}
      </div>

      <div className="build-part" ref={itemRef}>
        <span className="mini-label">Held item</span>
        <div className="item-row">
          <button type="button" className="item-box" onClick={openItems} aria-expanded={itemsOpen} title={build.item ? itemLabel(build.item) : 'Give an item'}>
            {build.item ? <img src={itemSprite(build.item)} alt={itemLabel(build.item)} width="32" height="32" /> : '+'}
          </button>
          <span>{build.item ? itemLabel(build.item) : <span className="status small-print">No item</span>}</span>
          {build.item && <button type="button" className="unplace" onClick={() => pickItem(null)} aria-label={`Take ${itemLabel(build.item)} off`} title="Take the item off">×</button>}
          {build.item && (
            <button type="button" className={build.itemPinned ? 'pin on' : 'pin'} aria-pressed={!!build.itemPinned} onClick={() => saveBuild({ itemPinned: !build.itemPinned })}
              title={build.itemPinned ? 'Unpin: the planner may suggest moving it' : 'Pin: this item stays on this Pokémon in suggestions'}>
              {build.itemPinned ? 'Pinned' : 'Pin'}
            </button>
          )}
        </div>
        {itemsOpen && (
          <div className="item-picker-wrap" onKeyDown={(e) => e.key === 'Escape' && setItemsOpen(false)}>
            <div className="tabs" role="group" aria-label="Item kind">
              <button type="button" aria-pressed={itemTab === 'held'} onClick={() => setItemTab('held')}>Held items</button>
              <button type="button" aria-pressed={itemTab === 'berry'} onClick={() => setItemTab('berry')}>Berries</button>
              {build.item && <button type="button" onClick={() => pickItem(null)}>Take item off</button>}
            </div>
            {!allItems ? <p className="status small-print">Loading items…</p> : (
              <ul className="item-picker">
                {allItems.filter((it) => it.gen <= gen && it.berry === (itemTab === 'berry')).map((it) => (
                  <li key={it.name}>
                    <button type="button" aria-pressed={build.item === it.name} onClick={() => pickItem(it.name)} title={HELD_ITEMS[it.name] ? 'The planner counts what this item does' : itemLabel(it.name)}>
                      <img src={itemSprite(it.name)} alt="" width="28" height="28" loading="lazy" />{itemLabel(it.name)}{HELD_ITEMS[it.name] && <span className="item-counts">★</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="status small-print">★ = the planner counts what it does. Items from Gen {gen} and earlier.</p>
          </div>
        )}
      </div>

      {matchups.length > 0 && (
        <div className="build-part">
          <span className="mini-label">Defence</span>
          <div className="def-row"><span className="small-print">Weak to</span>{weak.map((m) => <span key={m.type} className="def-chip"><TypeBadge type={m.type} small />{m.multiplier === 4 && '×4'}</span>)}{weak.length === 0 && '—'}</div>
          <div className="def-row"><span className="small-print">Resists</span>{resist.map((m) => <span key={m.type} className="def-chip"><TypeBadge type={m.type} small />{m.multiplier === 0 && '×0'}</span>)}{resist.length === 0 && '—'}</div>
        </div>
      )}
    </div>
  )
}
