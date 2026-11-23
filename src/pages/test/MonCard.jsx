// One caught Pokémon as it is now in the run: stats with its held item, moves, item (pinnable) and evolving.
// Moves and item are saved on the encounter (p1_build / p2_build); evolving changes the run's Pokémon.
import { useEffect, useMemo, useState } from 'react'
import { displayName, spriteUrl } from '../../api/pokeapi.js'
import { getGames, getLearnset, getMoves, rosterTypesInGeneration } from '../../api/pokeapiGraphql.js'
import TypeLink from '../../components/TypeLink.jsx'
import { getMonStats, getNextEvolutions } from './data.js'
import { HELD_ITEMS, STAT_KEYS, itemLabel, itemSlug, itemSprite, withItem } from './items.js'

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
      if (live) setState({ list, canLearn })
    })().catch(() => live && setState({ list: [], canLearn: new Set() }))
    return () => { live = false }
  }, [run.base_game, run.generation, id])
  return state
}

export default function MonCard({ run, row, player, names, rosterById, onSave, picked }) {
  const gen = run.generation
  const id = row[`${player}_pokemon_id`]
  const entry = rosterById[id]
  const build = row[`${player}_build`] ?? {}
  const moves = build.moves ?? []

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
  const options = useMoveOptions(run, id)
  const byLabel = useMemo(() => Object.fromEntries((options?.list ?? []).map((m) => [displayName(m.name).toLowerCase(), m])), [options])

  const [moveText, setMoveText] = useState('')
  const [itemText, setItemText] = useState(build.item ? itemLabel(build.item) : '')
  useEffect(() => setItemText(build.item ? itemLabel(build.item) : ''), [build.item])
  const [confirmEvo, setConfirmEvo] = useState(null)

  if (!id) return <div className="mon-card"><span className="mon-owner">{names[player]}</span><p className="status">Not caught yet.</p></div>

  const saveBuild = (changes) => onSave(row, { [`${player}_build`]: { ...build, ...changes } })
  function addMove(text) {
    setMoveText(text)
    const m = byLabel[text.trim().toLowerCase()]
    if (!m || moves.length >= 4 || moves.some((x) => x.id === m.id)) return
    setMoveText('')
    saveBuild({ moves: [...moves, { id: m.id, name: m.name, type: m.type, power: m.power, category: m.category }] })
  }
  function commitItem() {
    const slug = itemSlug(itemText)
    if (slug !== (build.item ?? '')) saveBuild({ item: slug || null, itemPinned: slug ? build.itemPinned : false })
  }
  const eff = withItem(stats, build.item)
  const listId = `moves-${player}-${row.area.replace(/\W+/g, '-')}`
  const known = HELD_ITEMS[build.item]

  return (
    <div className={picked ? 'mon-card picked' : 'mon-card'}>
      <div className="mon-card-head">
        <div className="anim-stage">
          <img src={animatedUrl(id)} alt={entry?.label ?? ''} onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = spriteUrl(id) }} />
        </div>
        <div>
          <span className="mon-owner">{names[player]} · {row.area} · {STATUS_TEXT[row.status]}</span>
          <strong className="mon-card-name">{row[`${player}_nickname`] || entry?.label}</strong>
          {row[`${player}_nickname`] && <span className="status small-print">{entry?.label}</span>}
          <span className="types">{entry && rosterTypesInGeneration(entry, gen).map((t) => <TypeLink key={t} type={t} small />)}</span>
          {stats?.legendary && <span className="small-print">★ Legendary</span>}
        </div>
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

      {eff ? (
        <table className="stats">
          <tbody>
            {STAT_KEYS.map((k) => (
              <tr key={k} className={eff[k] !== stats[k] ? 'boosted' : ''}>
                <th>{STAT_LABELS[k]}</th>
                <td className="stat-value">{eff[k]}</td>
                <td className="stat-bar"><span style={{ width: `${Math.min(100, (eff[k] / 255) * 100)}%` }} /></td>
              </tr>
            ))}
            <tr className="total"><th>Total</th><td className="stat-value">{eff.bst}</td><td className="small-print">{eff.bst !== stats.bst && `${stats.bst} + item`}</td></tr>
          </tbody>
        </table>
      ) : <p className="status small-print">Loading stats…</p>}

      <div className="build-part">
        <span className="mini-label">Held item</span>
        <div className="item-row">
          {build.item && <img src={itemSprite(build.item)} alt="" width="30" height="30" onError={(e) => { e.currentTarget.style.display = 'none' }} />}
          <input list={`held-items-${gen}`} placeholder="No item" aria-label="Held item" value={itemText}
            onChange={(e) => setItemText(e.target.value)} onBlur={commitItem} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
          {build.item && (
            <button type="button" className={build.itemPinned ? 'pin on' : 'pin'} aria-pressed={!!build.itemPinned} onClick={() => saveBuild({ itemPinned: !build.itemPinned })}
              title={build.itemPinned ? 'Unpin: the planner may suggest moving it' : 'Pin: this item stays on this Pokémon in suggestions'}>
              {build.itemPinned ? 'Pinned' : 'Pin'}
            </button>
          )}
        </div>
        <datalist id={`held-items-${gen}`}>
          {Object.entries(HELD_ITEMS).filter(([, it]) => it.gen <= gen).map(([k]) => <option key={k} value={itemLabel(k)} />)}
        </datalist>
        {build.item && !known && <span className="status small-print">The planner doesn’t know what this item does, so it doesn’t change the sums.</span>}
      </div>

      <div className="build-part">
        <span className="mini-label">Moves ({moves.length}/4)</span>
        <ul className="move-list">
          {moves.map((m) => (
            <li key={m.id}>
              <TypeLink type={m.type} small /> <strong>{displayName(m.name)}</strong>
              <span className="status small-print">{m.power ? `${m.power} power · ${m.category}` : 'status'}</span>
              <button type="button" className="unplace" onClick={() => saveBuild({ moves: moves.filter((x) => x.id !== m.id) })} aria-label={`Forget ${displayName(m.name)}`}>×</button>
            </li>
          ))}
        </ul>
        {moves.length < 4 && (
          <>
            <input list={listId} placeholder={options ? 'Add a move' : 'Loading moves…'} aria-label="Add a move" value={moveText} onChange={(e) => addMove(e.target.value)} disabled={!options} />
            <datalist id={listId}>
              {(options?.list ?? []).map((m) => <option key={m.id} value={displayName(m.name)}>{options.canLearn.has(m.id) ? 'learns it' : ''}</option>)}
            </datalist>
          </>
        )}
        <span className="status small-print">Damaging moves count for the planner’s coverage instead of the Pokémon’s own types.</span>
      </div>
    </div>
  )
}
