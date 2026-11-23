// One caught Pokémon as it is now in the run: ability, stats with its held item, four moves, item (pinnable),
// what it's weak to / resists, and evolving. Ability, moves and item are saved on the encounter
// (p1_build / p2_build); evolving changes the run's Pokémon.
import { useEffect, useMemo, useRef, useState } from 'react'
import { defensiveMatchups, displayName, spriteUrl, TYPE_COLORS } from '../../api/pokeapi.js'
import { getAbilities, getGames, getLearnset, getMoves, rosterTypesInGeneration } from '../../api/pokeapiGraphql.js'
import TypeBadge from './TypeBadge.jsx'
import PokemonDetail from '../../components/PokemonDetail.jsx'
import { getHoldItems, getMonStats, getNextEvolutions } from './data.js'
import { HELD_ITEMS, NATURES, STAT_KEYS, itemLabel, itemSprite, withBuild } from './items.js'

const STAT_LABELS = { hp: 'HP', attack: 'Atk', defense: 'Def', 'special-attack': 'SpA', 'special-defense': 'SpD', speed: 'Spe' }
const STATUS_TEXT = { team: 'on the team', box: 'in the PC', dead: 'dead', failed: 'failed', pending: 'waiting for the partner' }
const animatedUrl = (id) => spriteUrl(id).replace(/\/(\d+)\.png$/, '/other/showdown/$1.gif')

/** Moves this Pokémon can have in the run's game: learnable ones first, then every move of the generation. */
function useMoveOptions(run, id) {
  const [state, setState] = useState(null)
  useEffect(() => {
    let live = true
    ;(async () => {
      const game = (await getGames()).find((g) => g.name === run.base_game)
      const [moves, learnset] = await Promise.all([getMoves(), getLearnset(id, game?.id ?? null)])
      const canLearn = new Set(Object.keys(learnset).map(Number))
      const list = moves.filter((m) => m.generation <= run.generation)
        .sort((a, b) => canLearn.has(b.id) - canLearn.has(a.id) || a.name.localeCompare(b.name))
      // Moves it knows at level 1 in this game (the last four, like the game keeps).
      const byId = Object.fromEntries(moves.map((m) => [m.id, m]))
      const starting = Object.entries(learnset).filter(([, ways]) => ways.some((w) => w.method === 'level-up' && w.level === 1))
        .map(([moveId]) => byId[moveId]).filter(Boolean).slice(-4).map(toSaved)
      if (live) setState({ list, canLearn, starting })
    })().catch(() => live && setState({ list: [], canLearn: new Set(), starting: [] }))
    return () => { live = false }
  }, [run.base_game, run.generation, id])
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

// Two ways to show stats, to compare: 'game' (grey bars, nature stat red ▲ / blue ▼)
// or 'pokedb' (bars coloured by value like pokemondb.net, nature as + / −). Remembered per browser.
const STAT_STYLE_KEY = 'test-stat-style'
const readStatStyle = () => { try { return localStorage.getItem(STAT_STYLE_KEY) || 'game' } catch { return 'game' } }
// pokemondb.net bands, low to high (shortcut: colours from memory, their stylesheet wasn't readable).
const valueColor = (v) => (v < 30 ? '#f34444' : v < 60 ? '#ff7f0f' : v < 90 ? '#ffdd57' : v < 120 ? '#a0e515' : v < 150 ? '#23cd5e' : '#00c2b8')

const toSaved = (m) => ({ id: m.id, name: m.name, type: m.type, power: m.power, category: m.category })

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

export default function MonCard({ run, row, player, names, rosterById, chart, onSave, picked }) {
  const gen = run.generation
  const id = row[`${player}_pokemon_id`]
  const entry = rosterById[id]
  const build = row[`${player}_build`] ?? {}
  const [itemTab, setItemTab] = useState('held')
  const [allItems, setAllItems] = useState(null)
  const [dexOpen, setDexOpen] = useState(null) // Pokédex pop-up on the run page
  const types = entry ? rosterTypesInGeneration(entry, gen) : []

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
  const moveOptions = useMoveOptions(run, id)
  const abilities = useAbilityOptions(id, gen)
  // Until moves are set, it starts with its level 1 moves.
  const starting = build.moves === undefined && moveOptions?.starting?.length > 0
  const moves = build.moves ?? moveOptions?.starting ?? []
  const byLabel = useMemo(() => Object.fromEntries((moveOptions?.list ?? []).map((m) => [displayName(m.name).toLowerCase(), m])), [moveOptions])

  const [adding, setAdding] = useState(false) // the empty move block being typed in
  const [moveText, setMoveText] = useState('')
  const [statStyle, setStatStyleState] = useState(readStatStyle)
  const setStatStyle = (v) => { setStatStyleState(v); try { localStorage.setItem(STAT_STYLE_KEY, v) } catch { /* this card only */ } }
  const [itemsOpen, setItemsOpen] = useState(false)
  const itemRef = useRef(null)
  const closeItems = useMemo(() => () => setItemsOpen(false), [])
  useClickOutside(itemRef, closeItems, itemsOpen)
  const [confirmEvo, setConfirmEvo] = useState(null)

  if (!id) return <div className="mon-card"><span className="mon-owner">{names[player]}</span><p className="status">Not caught yet.</p></div>

  const saveBuild = (changes) => onSave(row, { [`${player}_build`]: { ...build, ...changes } })
  function addMove(text) {
    setMoveText(text)
    const m = byLabel[text.trim().toLowerCase()]
    if (!m || moves.length >= 4 || moves.some((x) => x.id === m.id)) return
    setMoveText('')
    setAdding(false)
    saveBuild({ moves: [...moves, toSaved(m)] })
  }
  const openItems = () => {
    setItemsOpen((o) => !o)
    if (!allItems) getHoldItems().then(setAllItems).catch(() => setAllItems([]))
  }
  const pickItem = (slug) => { setItemsOpen(false); saveBuild({ item: slug, itemPinned: slug ? build.itemPinned : false }) }

  const eff = withBuild(stats, build)
  const itemBoost = HELD_ITEMS[build.item]?.boost ?? {}
  const [natUp, natDown] = NATURES[build.nature] ?? []
  const listId = `moves-${player}-${row.area.replace(/\W+/g, '-')}`
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
            <strong className="mon-card-name">{row[`${player}_nickname`] || entry?.label}</strong>
            <button type="button" className="chip-button dex-button" onClick={() => setDexOpen(id)}>Pokédex</button>
          </div>
          {row[`${player}_nickname`] && <span className="status small-print">{entry?.label}</span>}
          <span className="types">{types.map((t) => <TypeBadge key={t} type={t} small />)}</span>
          {stats?.legendary && <span className="small-print">★ Legendary</span>}
        </div>
      </div>

      {dexOpen && <PokemonDetail id={dexOpen} onSelect={setDexOpen} onClose={() => setDexOpen(null)} />}

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

      <div className="stats-head">
        <span className="mini-label">Stats</span>
        <div className="tabs" role="group" aria-label="Stat colours">
          <button type="button" aria-pressed={statStyle === 'game'} onClick={() => setStatStyle('game')}>Game style</button>
          <button type="button" aria-pressed={statStyle === 'pokedb'} onClick={() => setStatStyle('pokedb')}>PokémonDB style</button>
        </div>
      </div>
      {!build.nature && <span className="status small-print">Pick a nature to see how each style marks it.</span>}
      {eff ? (
        <table className={`stats stat-style-${statStyle}`}>
          <tbody>
            {STAT_KEYS.map((k) => (
              <tr key={k} className={k === natUp ? 'nat-up' : k === natDown ? 'nat-down' : ''} title={k === natUp ? 'Raised by its nature (+10%)' : k === natDown ? 'Lowered by its nature (−10%)' : undefined}>
                <th>{statStyle === 'pokedb'
                  ? <>{k === natUp ? '+' : k === natDown ? '−' : ''}{STAT_LABELS[k]}</>
                  : <>{STAT_LABELS[k]}{k === natUp && ' ▲'}{k === natDown && ' ▼'}</>}</th>
                <td className="stat-value">{eff[k]}{itemBoost[k] && <img className="stat-item" src={itemSprite(build.item)} alt="" title={`Boosted by ${itemLabel(build.item)}`} width="18" height="18" />}</td>
                <td className="stat-bar"><span style={{ width: `${Math.min(100, (eff[k] / 255) * 100)}%`, background: statStyle === 'pokedb' ? valueColor(eff[k]) : undefined }} /></td>
              </tr>
            ))}
            <tr className="total"><th>Total</th><td className="stat-value">{eff.bst}</td><td className="small-print">{eff.bst !== stats.bst && `base ${stats.bst}`}</td></tr>
          </tbody>
        </table>
      ) : <p className="status small-print">Loading stats…</p>}

      <div className="build-part">
        <span className="mini-label">Moves{starting && ' · starting moves (level 1), change them freely'}</span>
        <div className="move-blocks">
          {[0, 1, 2, 3].map((i) => {
            const m = moves[i]
            if (m) {
              return (
                <div key={i} className="move-block" style={{ '--type-color': TYPE_COLORS[m.type] }}>
                  <strong>{displayName(m.name)}</strong>
                  <span className="small-print">{displayName(m.type)} · {m.power ? `${m.power} ${m.category}` : 'status'}</span>
                  <button type="button" className="move-forget" onClick={() => saveBuild({ moves: moves.filter((x) => x.id !== m.id) })} aria-label={`Forget ${displayName(m.name)}`}>×</button>
                </div>
              )
            }
            if (i === moves.length && adding) {
              return (
                <div key={i} className="move-block empty">
                  <input autoFocus list={listId} placeholder={moveOptions ? 'Type a move' : 'Loading…'} aria-label="Add a move" value={moveText}
                    disabled={!moveOptions} onChange={(e) => addMove(e.target.value)} onBlur={() => { setAdding(false); setMoveText('') }}
                    onKeyDown={(e) => e.key === 'Escape' && e.currentTarget.blur()} />
                </div>
              )
            }
            return (
              <button key={i} type="button" className="move-block empty" disabled={i !== moves.length} onClick={() => setAdding(true)}>
                {i === moves.length ? '+ Move' : ''}
              </button>
            )
          })}
        </div>
        <datalist id={listId}>
          {(moveOptions?.list ?? []).map((m) => <option key={m.id} value={displayName(m.name)}>{moveOptions.canLearn.has(m.id) ? 'learns it' : ''}</option>)}
        </datalist>
      </div>

      <div className="build-part" ref={itemRef}>
        <span className="mini-label">Held item</span>
        <div className="item-row">
          <button type="button" className="item-box" onClick={openItems} aria-expanded={itemsOpen} title={build.item ? itemLabel(build.item) : 'Give an item'}>
            {build.item ? <img src={itemSprite(build.item)} alt={itemLabel(build.item)} width="32" height="32" /> : '+'}
          </button>
          <span>{build.item ? itemLabel(build.item) : <span className="status small-print">No item</span>}</span>
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
