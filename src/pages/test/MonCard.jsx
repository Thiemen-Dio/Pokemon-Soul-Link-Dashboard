// One caught Pokémon as it is now in the run: ability, stats with its held item, four moves, item (pinnable),
// what it's weak to / resists, and evolving. Ability, moves and item are saved on the encounter
// (p1_build / p2_build); evolving changes the run's Pokémon.
import { useEffect, useMemo, useState } from 'react'
import { defensiveMatchups, displayName, spriteUrl, TYPE_COLORS } from '../../api/pokeapi.js'
import { getAbilities, getGames, getLearnset, getMoves, rosterTypesInGeneration } from '../../api/pokeapiGraphql.js'
import TypeLink from '../../components/TypeLink.jsx'
import { getMonStats, getNextEvolutions } from './data.js'
import { HELD_ITEMS, STAT_KEYS, itemLabel, itemSprite, withItem } from './items.js'

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
  const moves = build.moves ?? []
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
  const byLabel = useMemo(() => Object.fromEntries((moveOptions?.list ?? []).map((m) => [displayName(m.name).toLowerCase(), m])), [moveOptions])

  const [adding, setAdding] = useState(false) // the empty move block being typed in
  const [moveText, setMoveText] = useState('')
  const [itemsOpen, setItemsOpen] = useState(false)
  const [confirmEvo, setConfirmEvo] = useState(null)

  if (!id) return <div className="mon-card"><span className="mon-owner">{names[player]}</span><p className="status">Not caught yet.</p></div>

  const saveBuild = (changes) => onSave(row, { [`${player}_build`]: { ...build, ...changes } })
  function addMove(text) {
    setMoveText(text)
    const m = byLabel[text.trim().toLowerCase()]
    if (!m || moves.length >= 4 || moves.some((x) => x.id === m.id)) return
    setMoveText('')
    setAdding(false)
    saveBuild({ moves: [...moves, { id: m.id, name: m.name, type: m.type, power: m.power, category: m.category }] })
  }
  const pickItem = (slug) => { setItemsOpen(false); saveBuild({ item: slug, itemPinned: slug ? build.itemPinned : false }) }

  const eff = withItem(stats, build.item)
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
          <strong className="mon-card-name">{row[`${player}_nickname`] || entry?.label}</strong>
          {row[`${player}_nickname`] && <span className="status small-print">{entry?.label}</span>}
          <span className="types">{types.map((t) => <TypeLink key={t} type={t} small />)}</span>
          {stats?.legendary && <span className="small-print">★ Legendary</span>}
        </div>
      </div>

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
        <span className="mini-label">Moves</span>
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

      <div className="build-part">
        <span className="mini-label">Held item</span>
        <div className="item-row">
          <button type="button" className="item-box" onClick={() => setItemsOpen((o) => !o)} aria-expanded={itemsOpen} title={build.item ? itemLabel(build.item) : 'Give an item'}>
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
          <ul className="item-picker" onKeyDown={(e) => e.key === 'Escape' && setItemsOpen(false)}>
            {build.item && <li><button type="button" onClick={() => pickItem(null)}><span className="item-none">×</span>No item</button></li>}
            {Object.entries(HELD_ITEMS).filter(([, it]) => it.gen <= gen).map(([k]) => (
              <li key={k}>
                <button type="button" aria-pressed={build.item === k} onClick={() => pickItem(k)}>
                  <img src={itemSprite(k)} alt="" width="28" height="28" loading="lazy" />{itemLabel(k)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {matchups.length > 0 && (
        <div className="build-part">
          <span className="mini-label">Defence</span>
          <div className="def-row"><span className="small-print">Weak to</span>{weak.map((m) => <span key={m.type} className="def-chip"><TypeLink type={m.type} small />{m.multiplier === 4 && '×4'}</span>)}{weak.length === 0 && '—'}</div>
          <div className="def-row"><span className="small-print">Resists</span>{resist.map((m) => <span key={m.type} className="def-chip"><TypeLink type={m.type} small />{m.multiplier === 0 && '×0'}</span>)}{resist.length === 0 && '—'}</div>
        </div>
      )}
    </div>
  )
}
