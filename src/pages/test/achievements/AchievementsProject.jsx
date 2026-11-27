// Test · Achievements project: one run's achievements or your whole career, Steam style.
// Trainer Card header (score + rank colour), showcase (almost there, rarest, latest), Rivals (who holds each
// trainer class title), then the full list with filters. "NEW" marks what unlocked since your last visit.
import { useEffect, useMemo, useState } from 'react'
import { spriteUrl } from '../../../api/pokeapi.js'
import { getEvolutionFamilies, getTypeRoster } from '../../../api/pokeapiGraphql.js'
import { getEncounters, getRuns } from '../../../api/soullink.js'
import { gameLabel } from '../../../api/games.js'
import { catches, getMonStats } from '../run/data.js'
import { ALL_ACHIEVEMENTS, CATEGORIES, RUN_ACHIEVEMENTS, TIERS, evaluate, rankFor, rivalry, runContext, score, withMeta } from './achievements.js'
import './achievements.css'

const itemIcon = (slug) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${slug}.png`
const dateText = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
const SEEN_KEY = 'test-achievements-seen'

function useData() {
  const [state, setState] = useState({ status: 'loading' })
  useEffect(() => {
    let live = true
    ;(async () => {
      const [runs, roster, families] = await Promise.all([getRuns(), getTypeRoster(), getEvolutionFamilies()])
      const byRun = await Promise.all(runs.map((r) => getEncounters(r.id)))
      const ids = [...new Set(byRun.flatMap((list) => catches(list).map((c) => c.id)))]
      const stats = await getMonStats(ids).catch(() => ({}))
      const rosterById = Object.fromEntries(roster.map((e) => [e.id, e]))
      if (live) setState({ status: 'ready', runs, byRun, rosterById, families, stats })
    })().catch((e) => live && setState({ status: 'error', message: e.message }))
    return () => { live = false }
  }, [])
  return state
}

function Icon({ a, size = 56 }) {
  const locked = !a.done
  if (a.hidden && locked) return <span className="ach-icon secret" style={{ width: size, height: size }} aria-hidden="true">?</span>
  const src = a.icon?.mon ? spriteUrl(a.icon.mon) : itemIcon(a.icon?.item ?? 'poke-ball')
  return (
    <span className={`ach-icon tier-${a.tier}${locked ? ' locked' : ''}`} style={{ width: size, height: size }} aria-hidden="true">
      <img src={src} alt="" width={a.icon?.mon ? size : size * 0.6} height={a.icon?.mon ? size : size * 0.6} loading="lazy" />
    </span>
  )
}

function TrainerCard({ title, subtitle, results, names, extra }) {
  const s = score(results)
  const rank = rankFor(s)
  const tiers = Object.keys(TIERS).map((t) => [t, results.filter((r) => r.tier === t && r.done).length, results.filter((r) => r.tier === t).length])
  const pct = s.total ? Math.round((s.got / s.total) * 100) : 0
  return (
    <header className="trainer-card" style={{ '--rank': rank.color }}>
      <div className="tc-main">
        <span className="tc-rank">{rank.name}</span>
        <h3>{title}</h3>
        <p>{subtitle}</p>
        <p className="tc-names">{names.p1} ↔ {names.p2}</p>
      </div>
      <div className="tc-score">
        <strong>{s.points}</strong><span>/ {s.max} pts</span>
        <div className="tc-bar" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100"><span style={{ width: `${pct}%` }} /></div>
        <span className="tc-count">{s.got} of {s.total} unlocked · {pct}%</span>
      </div>
      <ul className="tc-tiers">
        {tiers.map(([t, got, all]) => <li key={t} className={`tier-${t}`}><span className="tier-dot" />{TIERS[t].label}<strong>{got}/{all}</strong></li>)}
      </ul>
      {extra}
    </header>
  )
}

function Showcase({ results, rarity }) {
  const almost = results.filter((r) => !r.done && !r.hidden && !r.never && r.progress > 0).sort((a, b) => b.progress - a.progress).slice(0, 4)
  const rarest = results.filter((r) => r.done && rarity[r.id] !== undefined).sort((a, b) => rarity[a.id] - rarity[b.id]).slice(0, 4)
  const latest = results.filter((r) => r.done && r.at).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 4)
  const box = (title, list, note) => (
    <section className="showcase-box">
      <h4>{title}</h4>
      {list.length === 0 ? <p className="status small-print">Nothing yet.</p> : (
        <ul>
          {list.map((a) => (
            <li key={a.id} title={a.desc}>
              <Icon a={a} size={40} />
              <span><strong>{a.name}</strong><span className="small-print">{note(a)}</span></span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
  return (
    <div className="showcase">
      {box('Almost there', almost, (a) => `${a.have}/${a.goal}`)}
      {box('Rarest unlocked', rarest, (a) => `${Math.round(rarity[a.id] * 100)}% of runs`)}
      {box('Latest unlocked', latest, (a) => dateText(a.at))}
    </div>
  )
}

function Rivals({ ctxs, names }) {
  // Titles over the chosen runs: who caught more of each class's types.
  const rows = ctxs.map(rivalry)
  const merged = rows[0]?.map((r, i) => {
    const per = { p1: 0, p2: 0 }
    for (const run of rows) { per.p1 += run[i].per.p1; per.p2 += run[i].per.p2 }
    return { ...r, per, holder: per.p1 === per.p2 ? null : per.p1 > per.p2 ? 'p1' : 'p2' }
  }) ?? []
  const titles = { p1: merged.filter((r) => r.holder === 'p1').length, p2: merged.filter((r) => r.holder === 'p2').length }
  const lead = titles.p1 === titles.p2 ? 'Dead even.' : `${names[titles.p1 > titles.p2 ? 'p1' : 'p2']} leads.`
  return (
    <section className="dash-card rivals">
      <header className="rivals-head">
        <h3>Rivals</h3>
        <p className="rivals-score"><span>{names.p1} <strong>{titles.p1}</strong></span><span className="vs">VS</span><span><strong>{titles.p2}</strong> {names.p2}</span></p>
        <p className="status small-print">Each trainer class title goes to whoever caught more of its types. {lead}</p>
      </header>
      <ul className="rival-grid">
        {merged.map((r) => {
          const total = r.per.p1 + r.per.p2
          return (
            <li key={r.id} className={r.holder ? `held-${r.holder}` : total ? 'held-none' : 'held-none empty'}>
              <img src={spriteUrl(r.mon)} alt="" width="48" height="48" loading="lazy" />
              <strong>{r.name}</strong>
              <span className="rival-bar" style={{ '--a': total ? r.per.p1 / total : 0.5 }}><span /></span>
              <span className="small-print rival-nums"><span>{r.per.p1}</span><span>{r.holder ? `👑 ${names[r.holder]}` : total ? 'tied' : 'nobody yet'}</span><span>{r.per.p2}</span></span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function AchievementList({ results, rarity, seen }) {
  const [cat, setCat] = useState('all')
  const [show, setShow] = useState('all')
  const [sort, setSort] = useState('default')
  const [spoilers, setSpoilers] = useState(false)
  const cats = Object.entries(CATEGORIES).filter(([k]) => results.some((r) => r.cat === k))
  let list = results.filter((r) => (cat === 'all' || r.cat === cat) && (show === 'all' || (show === 'got' ? r.done : !r.done)))
  if (sort === 'rare') list = [...list].sort((a, b) => (rarity[a.id] ?? 2) - (rarity[b.id] ?? 2))
  if (sort === 'close') list = [...list].sort((a, b) => b.done - a.done || b.progress - a.progress)
  if (sort === 'tier') list = [...list].sort((a, b) => TIERS[b.tier].points - TIERS[a.tier].points)
  const hiddenLeft = results.filter((r) => r.hidden && !r.done).length
  return (
    <section className="dash-card ach-list-card">
      <div className="ach-filters">
        <div className="tabs" role="group" aria-label="Category">
          <button type="button" aria-pressed={cat === 'all'} onClick={() => setCat('all')}>All</button>
          {cats.map(([k, label]) => <button key={k} type="button" aria-pressed={cat === k} onClick={() => setCat(k)}>{label}</button>)}
        </div>
        <div className="tabs" role="group" aria-label="Show">
          {[['all', 'All'], ['got', 'Unlocked'], ['locked', 'Locked']].map(([k, label]) => <button key={k} type="button" aria-pressed={show === k} onClick={() => setShow(k)}>{label}</button>)}
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
          <option value="default">Sort: by category</option>
          <option value="close">Sort: closest first</option>
          <option value="rare">Sort: rarest first</option>
          <option value="tier">Sort: highest tier</option>
        </select>
        {hiddenLeft > 0 && <label className="small-print"><input type="checkbox" checked={spoilers} onChange={(e) => setSpoilers(e.target.checked)} /> Show {hiddenLeft} hidden ones (spoilers)</label>}
      </div>
      <ul className="ach-list">
        {list.map((a) => {
          const secret = a.hidden && !a.done && !spoilers
          const isNew = a.done && seen && !seen.has(a.id)
          return (
            <li key={a.id} className={`ach tier-${a.tier}${a.done ? ' got' : ''}${isNew ? ' new' : ''}`}>
              <Icon a={secret ? a : { ...a, hidden: false }} />
              <div className="ach-body">
                <strong>{secret ? 'Hidden achievement' : a.name}{isNew && <span className="new-tag">NEW</span>}</strong>
                <span className="ach-desc">{secret ? 'Keep playing to find this one.' : a.desc}</span>
                {!a.done && !secret && a.goal > 1 && !a.never && (
                  <span className="ach-progress"><span className="ach-bar"><span style={{ width: `${a.progress * 100}%` }} /></span><span className="small-print">{a.have}/{a.goal}</span></span>
                )}
                {a.never && <span className="small-print status">Not possible in this game.</span>}
                {!secret && a.mons?.length > 0 && (
                  <span className="earned-by" title="Earned by">
                    {a.mons.slice(0, 8).map((id, i) => <img key={`${id}-${i}`} src={spriteUrl(id)} alt="" width="32" height="32" loading="lazy" />)}
                    {a.mons.length > 8 && <span className="small-print">+{a.mons.length - 8}</span>}
                  </span>
                )}
              </div>
              <div className="ach-side">
                <span className={`tier-chip tier-${a.tier}`}>{TIERS[a.tier].label} · {TIERS[a.tier].points}</span>
                {a.done && <span className="small-print">{a.at ? `Unlocked ${dateText(a.at)}` : 'Unlocked'}</span>}
                {rarity[a.id] !== undefined && <span className="small-print rarity" title="Share of all runs that unlocked it">{Math.round(rarity[a.id] * 100)}% of runs</span>}
              </div>
            </li>
          )
        })}
      </ul>
      {list.length === 0 && <p className="status">Nothing here with these filters.</p>}
    </section>
  )
}

/** Every unlock over all runs in date order, grouped by month: a feed like Steam's recent achievements. */
function History({ runs, perRun, career }) {
  const events = [
    ...perRun.flatMap((list, i) => list.filter((r) => r.done && r.at).map((r) => ({ ...r, run: runs[i].name }))),
    ...career.filter((r) => r.done && r.at && (r.cat === 'career' || r.id.startsWith('meta'))).map((r) => ({ ...r, run: 'Career' })),
  ].sort((a, b) => b.at.localeCompare(a.at))
  const months = Object.entries(Object.groupBy(events, (e) => new Date(e.at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })))
  if (events.length === 0) return null
  return (
    <section className="dash-card ach-history">
      <h3>Unlock history</h3>
      {months.map(([month, list]) => (
        <div key={month} className="history-month">
          <h4>{month} <span className="status small-print">{list.length} unlocked</span></h4>
          <ol>
            {list.map((e) => (
              <li key={`${e.run}-${e.id}`} className={`tier-${e.tier}`}>
                <Icon a={e} size={36} />
                <span><strong>{e.name}</strong> <span className="small-print status">{e.run} · {dateText(e.at)}</span></span>
                <span className={`tier-chip tier-${e.tier}`}>{TIERS[e.tier].label}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </section>
  )
}

export default function AchievementsProject() {
  const data = useData()
  const [scope, setScope] = useState(null) // run id, or 'all'
  // Achievements already seen on this device: anything newer gets a NEW tag (once).
  // First visit (nothing stored yet): no NEW tags at all.
  const [seen] = useState(() => { try { const s = localStorage.getItem(SEEN_KEY); return s ? new Set(JSON.parse(s)) : null } catch { return null } })

  const computed = useMemo(() => {
    if (data.status !== 'ready') return null
    const { runs, byRun, rosterById, families, stats } = data
    const ctxs = runs.map((run, i) => runContext({ run, encounters: byRun[i], rosterById, families, stats }))
    const perRun = ctxs.map((c) => evaluate(RUN_ACHIEVEMENTS, c))
    // Rarity: in how many runs each in-run achievement is unlocked (like Steam's global %).
    const rarity = Object.fromEntries(RUN_ACHIEVEMENTS.map((a, i) => [a.id, perRun.filter((list) => list[i].done).length / Math.max(1, runs.length)]))
    // Career view: the career list, plus every in-run achievement you unlocked in at least one run.
    const ever = RUN_ACHIEVEMENTS.map((a, i) => {
      const done = perRun.map((list) => list[i]).filter((r) => r.done)
      const best = perRun.map((list) => list[i]).sort((x, y) => y.progress - x.progress)[0] ?? evaluate([a], ctxs[0] ?? {})[0]
      return done.length ? { ...done.sort((x, y) => (x.at ?? 'z').localeCompare(y.at ?? 'z'))[0], done: true } : best
    })
    const career = [...evaluate(ALL_ACHIEVEMENTS, { runs, ctxs, families }), ...ever]
    return { ctxs, perRun, rarity, career }
  }, [data])

  // Remember what's unlocked now, so next visit only the newer ones say NEW.
  useEffect(() => {
    if (!computed) return
    const ids = new Set(computed.career.filter((r) => r.done).map((r) => r.id))
    try { localStorage.setItem(SEEN_KEY, JSON.stringify([...ids])) } catch { /* NEW tags just won't clear */ }
  }, [computed])

  if (data.status === 'loading') return <p className="status">Counting medals…</p>
  if (data.status === 'error') return <p className="status error">{data.message}</p>
  const { runs } = data
  if (runs.length === 0) return <p className="status">No runs yet.</p>
  const activeId = scope ?? (runs.find((r) => r.status === 'active') ?? runs.at(-1)).id
  const isAll = activeId === 'all'
  const index = runs.findIndex((r) => r.id === activeId)
  const run = runs[index]
  const results = withMeta(isAll ? computed.career : computed.perRun[index], isAll ? 'your career' : 'this run')
  const names = { p1: (run ?? runs.at(-1)).player1_name, p2: (run ?? runs.at(-1)).player2_name }
  const ctx = isAll ? null : computed.ctxs[index]

  return (
    <section className="dash-page ach-page">
      <div className="page-head">
        <h2>Test · Achievements</h2>
        <div className="tabs" role="group" aria-label="Whose achievements">
          {[...runs].reverse().map((r) => <button key={r.id} type="button" aria-pressed={activeId === r.id} onClick={() => setScope(r.id)}>{r.name}</button>)}
          <button type="button" aria-pressed={isAll} onClick={() => setScope('all')}>All time</button>
        </div>
      </div>
      <p className="status small-print">Worked out from the run data, nothing is saved. Hidden ones stay secret until you unlock them.</p>

      <TrainerCard
        title={isAll ? 'Career' : run.name}
        subtitle={isAll ? `${runs.length} runs · ${computed.ctxs.reduce((s, c) => s + c.pairs.length, 0)} pairs · ${computed.ctxs.reduce((s, c) => s + c.dead.length, 0)} fallen` : `${gameLabel(run.base_game)} · ${ctx.pairs.length} pairs · ${ctx.dead.length} fallen · ${run.status === 'won' ? 'beaten' : run.status === 'lost' ? 'lost' : 'in progress'}`}
        results={results}
        names={names}
      />
      <Showcase results={results} rarity={computed.rarity} />
      <Rivals ctxs={isAll ? computed.ctxs : [ctx]} names={names} />
      <AchievementList key={activeId} results={results} rarity={computed.rarity} seen={seen} />
      {isAll && <History runs={runs} perRun={computed.perRun} career={results} />}
    </section>
  )
}
