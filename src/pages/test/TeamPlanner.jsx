// Team planner: both players' six side by side, built from every living pair.
// Planning only: the run itself doesn't change.
import { useEffect, useMemo, useState } from 'react'
import { spriteUrl } from '../../api/pokeapi.js'
import { rosterTypesInGeneration } from '../../api/pokeapiGraphql.js'
import TypeLink from '../../components/TypeLink.jsx'
import { PLAYERS, primaryType } from '../../soullink/rules.js'
import { catches, getBaseStatTotals } from './data.js'
import { TEAM_SLOTS, bestTeam, fits, isValid, randomTeam, scoreTeam } from './planner.js'

const pad = (areas) => [...areas, ...Array(TEAM_SLOTS).fill(null)].slice(0, TEAM_SLOTS)

export default function TeamPlanner({ gen, names, rows, encounters, rosterById, families, chart }) {
  const alive = rows.filter((r) => (r.status === 'team' || r.status === 'box') && r.p1_pokemon_id && r.p2_pokemon_id)
  const idKey = [...new Set(alive.flatMap((r) => [r.p1_pokemon_id, r.p2_pokemon_id]))].sort((a, b) => a - b).join(',')
  const [bst, setBst] = useState({})
  useEffect(() => {
    getBaseStatTotals(idKey ? idKey.split(',').map(Number) : []).then(setBst).catch(() => setBst({}))
  }, [idKey])

  const pool = useMemo(() => alive.map((r) => ({
    area: r.area,
    status: r.status,
    primaries: [...new Set(PLAYERS.map((p) => primaryType(rosterById[r[`${p}_pokemon_id`]], gen)).filter(Boolean))],
    mons: PLAYERS.map((p) => {
      const id = r[`${p}_pokemon_id`]
      const entry = rosterById[id]
      return { id, player: p, nickname: r[`${p}_nickname`], label: entry?.label ?? `#${id}`, types: entry ? rosterTypesInGeneration(entry, gen) : [], bst: bst[id] }
    }),
  })), [rows, rosterById, gen, bst]) // eslint-disable-line react-hooks/exhaustive-deps
  const byArea = Object.fromEntries(pool.map((p) => [p.area, p]))

  // Start from the run's real team.
  const [slots, setSlots] = useState(() => pad(alive.filter((r) => r.status === 'team').map((r) => r.area)))
  const [pins, setPins] = useState(() => new Set())
  const [picking, setPicking] = useState(null)
  const team = slots.map((a) => byArea[a]).filter(Boolean)
  const othersThan = (i) => slots.filter((a, j) => j !== i && a).map((a) => byArea[a]).filter(Boolean)
  const pinned = () => slots.filter((a) => a && pins.has(a)).map((a) => byArea[a]).filter(Boolean)

  const place = (i, area) => { setSlots((s) => s.map((x, j) => (j === i ? area : x))); setPicking(null) }
  const clear = (i) => { setPins((p) => { const n = new Set(p); n.delete(slots[i]); return n }); place(i, null) }
  const togglePin = (area) => setPins((p) => { const n = new Set(p); n.has(area) ? n.delete(area) : n.add(area); return n })
  const fill = (t) => { setSlots(pad(t.map((p) => p.area))); setPicking(null) }

  if (pool.length === 0) return <p className="status">No living pairs yet. The planner fills up as you catch pairs.</p>
  const score = chart ? scoreTeam(team, chart) : null

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
    ['No shared primary types', isValid(team), isValid(team) ? 'All different' : 'Two pairs share a primary type'],
    ['Dupes clause (whole run)', dupes === 0, dupes ? `${dupes} lines caught twice` : 'No dupes'],
    ['Partners share a fate', true, 'Pairs move together'],
  ]

  return (
    <div className="planner">
      <div className="planner-board">
        <div className="planner-head"><strong>{names.p1}</strong><span /><strong>{names.p2}</strong></div>
        {slots.map((area, i) => {
          const pair = byArea[area]
          const open = () => setPicking(picking === i ? null : i)
          return (
            <div key={i} className={picking === i ? 'planner-row picking' : 'planner-row'}>
              {pair ? (
                <>
                  <MonCard mon={pair.mons[0]} onClick={open} />
                  <div className="planner-link">
                    <span className="planner-area">{pair.area}</span>
                    <button type="button" className={pins.has(area) ? 'pin on' : 'pin'} aria-pressed={pins.has(area)} onClick={() => togglePin(area)} title={pins.has(area) ? 'Unpin: Randomize and Best option may replace it' : 'Pin: keep this pair'}>
                      {pins.has(area) ? 'Pinned' : 'Pin'}
                    </button>
                    <button type="button" className="unplace" onClick={() => clear(i)} aria-label={`Take ${pair.area} off the plan`}>×</button>
                  </div>
                  <MonCard mon={pair.mons[1]} onClick={open} />
                </>
              ) : (
                <button type="button" className="planner-empty" onClick={open}>+ Add a pair</button>
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
          <button type="button" className="chip-button" onClick={() => fill(randomTeam(pool, pinned()))}>Randomize</button>
          <button type="button" className="primary-button" disabled={!chart} onClick={() => fill(bestTeam(pool, pinned(), chart))}>Best option</button>
        </div>
        <p className="status small-print">Both keep pinned pairs and the Soul Link rules. Best option weighs base stats, range and weak spots.</p>
        {score && (
          <dl className="planner-score">
            <div><dt>Avg. base stats</dt><dd>{score.bst || '—'}</dd></div>
            <div><dt>Range</dt><dd>{score.coverage}/{Object.keys(chart).length}</dd></div>
            <div><dt>Weak spots</dt><dd>{score.weakSpots.length}</dd></div>
          </dl>
        )}
        {score?.weakSpots.length > 0 && (
          <div className="weak-spots">
            {score.weakSpots.slice(0, 5).map((w) => (
              <span key={w.type}><TypeLink type={w.type} small /> {w.weak} weak, {w.resist} resist</span>
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
        <p className="status small-print">Range = types your team’s own types hit for double damage. Plan only: set the statuses in the run log to make it real.</p>
      </aside>
    </div>
  )
}

function MonCard({ mon, onClick }) {
  return (
    <button type="button" className="planner-mon" onClick={onClick} title="Swap this pair">
      <img className="pixel" src={spriteUrl(mon.id)} alt="" width="56" height="56" loading="lazy" />
      <span>
        <strong>{mon.nickname || mon.label}</strong>
        {mon.nickname && <span className="status small-print">{mon.label}</span>}
        <span className="types">{mon.types.map((t) => <TypeLink key={t} type={t} small />)}</span>
        {mon.bst && <span className="status small-print">BST {mon.bst}</span>}
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
