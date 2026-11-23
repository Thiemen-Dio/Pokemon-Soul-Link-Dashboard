// Team planner: both players' six side by side, built from every living pair.
// Planning only: the run itself doesn't change.
import { useEffect, useMemo, useRef, useState } from 'react'
import { spriteUrl } from '../../../api/pokeapi.js'
import { rosterTypesInGeneration } from '../../../api/pokeapiGraphql.js'
import TypeBadge from './TypeBadge.jsx'
import { PLAYERS, primaryType } from '../../../soullink/rules.js'
import { catches, getMonStats } from './data.js'
import { STRATEGIES, TEAM_SLOTS, bestOverall, seededRandom, fits, isValid, randomTeam, scoreTeam, suggestItems, topTeams } from './planner.js'
import MonCard, { useClickOutside } from './MonCard.jsx'
import { itemLabel, itemSprite } from './items.js'

const pad = (areas) => [...areas, ...Array(TEAM_SLOTS).fill(null)].slice(0, TEAM_SLOTS)

export default function TeamPlanner({ run, gen, names, rows, encounters, rosterById, families, chart, onSave }) {
  const alive = rows.filter((r) => (r.status === 'team' || r.status === 'box') && r.p1_pokemon_id && r.p2_pokemon_id)
  const idKey = [...new Set(alive.flatMap((r) => [r.p1_pokemon_id, r.p2_pokemon_id]))].sort((a, b) => a - b).join(',')
  const [stats, setStats] = useState({})
  useEffect(() => {
    getMonStats(idKey ? idKey.split(',').map(Number) : []).then(setStats).catch(() => setStats({}))
  }, [idKey])

  const pool = useMemo(() => alive.map((r) => ({
    area: r.area,
    row: r,
    status: r.status,
    primaries: [...new Set(PLAYERS.map((p) => primaryType(rosterById[r[`${p}_pokemon_id`]], gen)).filter(Boolean))],
    mons: PLAYERS.map((p) => {
      const id = r[`${p}_pokemon_id`]
      const entry = rosterById[id]
      return { id, player: p, nickname: r[`${p}_nickname`], label: entry?.label ?? `#${id}`, types: entry ? rosterTypesInGeneration(entry, gen) : [], stats: stats[id], bst: stats[id]?.bst, ...pickBuild(r[`${p}_build`]) }
    }),
  })), [rows, rosterById, gen, stats]) // eslint-disable-line react-hooks/exhaustive-deps
  const byArea = Object.fromEntries(pool.map((p) => [p.area, p]))
  // Teams can be worked out with or without held items.
  const [withItems, setWithItems] = useState(true)
  const noItems = (t) => t.map((p) => ({ ...p, mons: p.mons.map((m) => ({ ...m, item: null })) }))
  const calcPool = useMemo(() => (withItems ? pool : noItems(pool)), [pool, withItems])

  // Start from the run's real team.
  const [slots, setSlots] = useState(() => pad(alive.filter((r) => r.status === 'team').map((r) => r.area)))
  const [pins, setPins] = useState(() => new Set())
  const [picking, setPicking] = useState(null)
  // Hard lock on shared primary types: a pair that clashes with one above it is taken off the plan
  // (happens when the real team breaks the rule, or an evolution changes a type).
  const [lockedOut, setLockedOut] = useState([])
  const valid = []
  for (const a of slots) if (a && byArea[a] && fits(valid.map((x) => byArea[x]), byArea[a])) valid.push(a)
  const clashing = slots.filter((a) => a && byArea[a] && !valid.includes(a))
  useEffect(() => {
    if (clashing.length === 0) return
    setLockedOut(clashing.map((a) => ({ area: a, with: valid.find((v) => byArea[v].primaries.some((t) => byArea[a].primaries.includes(t))) })))
    setSlots(pad(valid))
  }, [clashing.join()]) // eslint-disable-line react-hooks/exhaustive-deps
  const team = valid.map((a) => byArea[a])
  const othersThan = (i) => slots.filter((a, j) => j !== i && a).map((a) => byArea[a]).filter(Boolean)
  const pinned = () => slots.filter((a) => a && pins.has(a)).map((a) => byArea[a]).filter(Boolean)

  const place = (i, area) => { setSlots((s) => s.map((x, j) => (j === i ? area : x))); setPicking(null) }
  // Taking a pair off moves the ones below it up.
  const clear = (i) => {
    setPins((p) => { const n = new Set(p); n.delete(slots[i]); return n })
    setSlots((s) => pad(s.filter((a, j) => j !== i && a)))
    setPicking(null)
    setViewing(null)
  }
  const [viewing, setViewing] = useState(null) // { area, player }: whose card is open
  const openRow = useRef(null)
  const closeCard = useMemo(() => () => setViewing(null), [])
  useClickOutside(openRow, closeCard, !!viewing)
  const togglePin = (area) => setPins((p) => { const n = new Set(p); n.has(area) ? n.delete(area) : n.add(area); return n })
  const fill = (t) => { setSlots(pad(t.map((p) => p.area))); setPicking(null); setLockedOut([]) }
  // Suggestions: a strategy gives a few different teams to flip through, best first.
  const [options, setOptions] = useState(null) // { strategy, list, i }
  // Each option also hands out the unpinned items where they help that team most.
  // 'best' = best all-round over every strategy; its items are handed out for the balanced score.
  const suggest = (strategy) => {
    // Same pairs, by area, from the pool the calculation uses.
    const kept = pinned().map((p) => calcPool.find((q) => q.area === p.area))
    const teams = strategy === 'best' ? bestOverall(calcPool, kept, chart, 5, seededRandom()) : topTeams(calcPool, kept, chart, strategy, 5, seededRandom())
    const list = teams.map((t) => (withItems ? suggestItems(t, calcPool, chart, strategy === 'best' ? 'balanced' : strategy) : { team: t, swaps: [] }))
    setOptions({ strategy, list, i: 0 })
    fill(list[0].team)
  }
  const flip = (step) => {
    const i = (options.i + step + options.list.length) % options.list.length
    setOptions({ ...options, i })
    fill(options.list[i].team)
  }

  if (pool.length === 0) return <p className="status">No living pairs yet. The planner fills up as you catch pairs.</p>
  // With a suggestion showing, its item swaps count in the numbers.
  const shownTeam = options && options.list[options.i].team.map((p) => p.area).join() === team.map((p) => p.area).join() ? options.list[options.i].team : team
  const swaps = shownTeam === team ? [] : options.list[options.i].swaps
  const score = chart ? scoreTeam(withItems ? shownTeam : noItems(shownTeam), chart) : null

  // Rule check, live for the plan.
  const caught = catches(encounters)
  const famCount = {}
  for (const c of caught) {
    const f = families[rosterById[c.id]?.dex] ?? c.id
    famCount[f] = (famCount[f] ?? 0) + 1
  }
  const dupes = Object.values(famCount).filter((n) => n > 1).length
  const checks = [
    ['At most 6 pairs', team.length <= TEAM_SLOTS, `${team.length} of ${TEAM_SLOTS}`],
    ['No shared primary types', isValid(team), 'Locked: a pair that shares a primary type can’t be added'],
    ['Dupes clause (whole run)', dupes === 0, dupes ? `${dupes} lines caught twice` : 'No dupes'],
    ['Partners share a fate', true, 'Pairs move together'],
  ]

  return (
    <div className="planner">
      <div className="planner-board">
        {lockedOut.length > 0 && (
          <p className="rule-warning">
            Taken off the plan (shares a primary type): {lockedOut.map((x) => `${x.area}${x.with ? ` (with ${x.with})` : ''}`).join(', ')}.
            <button type="button" className="unplace" onClick={() => setLockedOut([])} aria-label="Hide">×</button>
          </p>
        )}
        <div className="planner-head"><strong>{names.p1}</strong><span /><strong>{names.p2}</strong></div>
        {slots.map((area, i) => {
          const pair = byArea[area]
          const open = () => { setViewing(null); setPicking(picking === i ? null : i) }
          const view = (player) => { setPicking(null); setViewing(viewing?.area === area && viewing.player === player ? null : { area, player }) }
          return (
            <div key={i} ref={pair && viewing?.area === area ? openRow : undefined} className={picking === i ? 'planner-row picking' : 'planner-row'}>
              {pair ? (
                <>
                  <MonTile mon={pair.mons[0]} onClick={() => view('p1')} open={viewing?.area === area && viewing.player === 'p1'} />
                  <div className="planner-link">
                    <span className="planner-area">{pair.area}</span>
                    <button type="button" className={pins.has(area) ? 'pin on' : 'pin'} aria-pressed={pins.has(area)} onClick={() => togglePin(area)} title={pins.has(area) ? 'Unpin: Randomize and Best option may replace it' : 'Pin: keep this pair'}>
                      {pins.has(area) ? 'Pinned' : 'Pin'}
                    </button>
                    <button type="button" className="chip-button swap" onClick={open} title="Swap this pair for another">Swap</button>
                    <button type="button" className="unplace" onClick={() => clear(i)} aria-label={`Take ${pair.area} off the plan`}>×</button>
                  </div>
                  <MonTile mon={pair.mons[1]} onClick={() => view('p2')} open={viewing?.area === area && viewing.player === 'p2'} />
                </>
              ) : (
                <button type="button" className="planner-empty" onClick={open}>+ Add a pair</button>
              )}
              {pair && viewing?.area === area && (
                <div className="planner-card">
                  <MonCard run={run} chart={chart} row={pair.row} player={viewing.player} names={names} rosterById={rosterById} onSave={onSave} picked />
                </div>
              )}
              {picking === i && (
                <Picker pool={pool} slots={slots} others={othersThan(i)} onPick={(a) => place(i, a)} names={names} />
              )}
            </div>
          )
        })}
      </div>

      <aside className="planner-side">
        <div className="planner-actions">
          <button type="button" className="primary-button" disabled={!chart} onClick={() => suggest('best')} aria-pressed={options?.strategy === 'best'}>Best option</button>
          <button type="button" className="chip-button" onClick={() => { setOptions(null); fill(randomTeam(pool, pinned())) }}>Randomize</button>
        </div>
        <label className="items-switch">
          <input type="checkbox" checked={withItems} onChange={(e) => { setWithItems(e.target.checked); setOptions(null) }} />
          Count held items
        </label>
        <span className="mini-label">Or best at one thing</span>
        <div className="strategy-chips" role="group" aria-label="Suggest a team">
          {Object.entries(STRATEGIES).map(([k, st]) => (
            <button key={k} type="button" disabled={!chart} aria-pressed={options?.strategy === k} onClick={() => suggest(k)}>{st.label}</button>
          ))}
        </div>
        {options && (
          <div className="option-flip">
            <button type="button" className="chip-button" onClick={() => flip(-1)} aria-label="Previous option">‹</button>
            <span><strong>{options.strategy === 'best' ? 'Best option (all-round)' : STRATEGIES[options.strategy].label}</strong> <span className="status small-print">option {options.i + 1} of {options.list.length}</span></span>
            <button type="button" className="chip-button" onClick={() => flip(1)} aria-label="Next option">›</button>
          </div>
        )}
        {swaps.length > 0 && (
          <ul className="item-swaps">
            {swaps.map((w, k) => (
              <li key={k}>
                <img src={itemSprite(w.item)} alt="" width="24" height="24" />
                <span><strong>{itemLabel(w.item)}</strong>: {w.from.nickname || w.from.label} → {w.to.nickname || w.to.label}</span>
              </li>
            ))}
            <li className="status small-print">Suggested item moves for this option. Pin an item in a Pokémon’s card to keep it where it is.</li>
          </ul>
        )}
        <p className="status small-print">Pick what matters, then flip through the options. All keep pinned pairs and the Soul Link rules.</p>
        {score && (
          <dl className="planner-score">
            <div><dt>Avg. base stats</dt><dd>{score.bst || '—'}</dd></div>
            <div title="Types the team's damaging moves hit for double damage (own types for Pokémon without moves)"><dt>Attack range</dt><dd>{score.coverage}/{Object.keys(chart).length}</dd></div>
            <div title="Attacking types at least one team member resists, from its own typing"><dt>Defence range</dt><dd>{score.resisted}/{Object.keys(chart).length}</dd></div>
            <div><dt>Weak spots</dt><dd>{score.weakSpots.length}</dd></div>
          </dl>
        )}
        {score?.weakSpots.length > 0 && (
          <div className="weak-spots">
            {score.weakSpots.slice(0, 5).map((w) => (
              <span key={w.type}><TypeBadge type={w.type} small /> {w.weak} weak, {w.resist} resist</span>
            ))}
          </div>
        )}
        <ul className="checks">
          {checks.map(([label, ok, detail]) => (
            <li key={label} className={ok ? 'ok' : 'bad'}>
              <span className="check-mark" aria-hidden="true">{ok ? '✓' : '!'}</span>
              <span>{label}</span>
              <span className="status small-print">{detail}</span>
            </li>
          ))}
        </ul>
        <p className="status small-print">Attack range = types your damaging moves hit for double damage (own types count until moves are filled in). Defence range = attacking types someone on the team resists. Plan only: set the statuses in the run log to make it real.</p>
      </aside>
    </div>
  )
}

const pickBuild = (b) => ({ item: b?.item ?? null, itemPinned: !!b?.itemPinned, nature: b?.nature ?? null, moves: b?.moves ?? [] })

function MonTile({ mon, onClick, open }) {
  return (
    <button type="button" className={open ? 'planner-mon open' : 'planner-mon'} onClick={onClick} aria-expanded={open} title="Show this Pokémon’s card">
      <img className="pixel" src={spriteUrl(mon.id)} alt="" width="112" height="112" loading="lazy" />
      <span>
        <strong>{mon.nickname || mon.label}</strong>
        {mon.nickname && <span className="status small-print">{mon.label}</span>}
        <span className="types">{mon.types.map((t) => <TypeBadge key={t} type={t} small />)}</span>
        {mon.item && <img className="held-icon" src={itemSprite(mon.item)} alt={itemLabel(mon.item)} title={`${itemLabel(mon.item)}${mon.itemPinned ? ' (pinned)' : ''}`} width="24" height="24" />}
        {mon.stats && <span className="status small-print">BST {mon.stats.bst} · Spe {mon.stats.speed}{mon.stats.legendary && ' · ★ Legendary'}</span>}
      </span>
    </button>
  )
}

function Picker({ pool, slots, others, onPick, names }) {
  const free = pool.filter((p) => !slots.includes(p.area))
  if (free.length === 0) return <p className="planner-picker status">Every living pair is already in the plan.</p>
  return (
    <ul className="planner-picker">
      {free.map((p) => {
        const ok = fits(others, p)
        const clash = ok ? null : others.find((o) => o.primaries.some((t) => p.primaries.includes(t)))
        return (
          <li key={p.area}>
            <button type="button" disabled={!ok} onClick={() => onPick(p.area)} title={ok ? `Add ${p.area}` : `Shares a primary type with ${clash?.area}`}>
              {p.mons.map((m) => <img key={m.player} className="pixel" src={spriteUrl(m.id)} alt="" width="40" height="40" loading="lazy" />)}
              <span>
                <strong>{p.mons.map((m) => m.nickname || m.label).join(' & ')}</strong>
                <span className="status small-print">{p.area} · {p.status === 'team' ? 'on the team' : 'in the PC'}{!ok && ` · clashes with ${clash?.area}`}</span>
              </span>
            </button>
          </li>
        )
      })}
      <li className="status small-print">
        {free.every((p) => !fits(others, p)) && 'Every pair left shares a primary type with the plan: take one off to make room. '}
        {names.p1}’s and {names.p2}’s catches from one area always move together.
      </li>
    </ul>
  )
}
