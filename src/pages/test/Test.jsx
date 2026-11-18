// Test tab: prototypes for new pages and features. Read-only: it never writes run data.
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { chartForGeneration, defensiveMatchups, displayName, getTypeData, spriteUrl, TYPE_COLORS } from '../../api/pokeapi.js'
import { getEvolutionFamilies, getGames, getLearnset, getMoves, getTypeRoster, rosterTypesInGeneration } from '../../api/pokeapiGraphql.js'
import { getEncounters, getRuns } from '../../api/soullink.js'
import { gameLabel } from '../../api/games.js'
import TypeLink from '../../components/TypeLink.jsx'
import { PLAYERS, TEAM_SIZE, areaRows, findDupes, primaryType, typeConflicts } from '../../soullink/rules.js'
import { GIFTS, LEVEL_CAPS, catches, getAreaEncounters, getNextEvolutions, locationSlug, teamPrimaryTypes, timeAgo, versionOf } from './data.js'
import { STARTERS } from '../../components/starters.js'
import { DeathReport, RunSetup } from './MockForms.jsx'
import './test.css'

// Jump menu, grouped like the categories on the page.
const SECTIONS = [
  ['Home', [['home', 'Home & news']]],
  ['Before you play', [['next', 'Next up'], ['route', 'Route finder'], ['planner', 'Area planner'], ['whatif', 'What-if'], ['caps', 'Level caps'], ['prep', 'Boss prep']]],
  ['Team', [['coverage', 'Weaknesses'], ['free', 'Free types'], ['swaps', 'Swaps'], ['evo', 'Evolutions'], ['rules', 'Rule check']]],
  ['History', [['timeline', 'Timeline'], ['graveyard', 'Graveyard'], ['death', 'Death report'], ['dex', 'Run Pokédex'], ['players', 'Player vs player'], ['history', 'Where used'], ['stats', 'All-run stats'], ['badges', 'Achievements']]],
  ['Setup', [['setup', 'New run']]],
  ['Share & stream', [['overlay', 'Overlay'], ['share', 'Summary']]],
]

export default function Test() {
  const [runs, setRuns] = useState([])
  const [runId, setRunId] = useState(null)
  const [encounters, setEncounters] = useState([])
  const [roster, setRoster] = useState([])
  const [families, setFamilies] = useState({})
  const [error, setError] = useState('')

  useEffect(() => {
    getRuns().then((list) => {
      setRuns(list)
      // ?run=Name picks a run straight from the link.
      const wanted = new URLSearchParams(location.search).get('run')?.toLowerCase()
      setRunId((list.find((r) => r.name.toLowerCase() === wanted) ?? list.find((r) => r.status === 'active') ?? list.at(-1))?.id ?? null)
    }).catch((e) => setError(e.message))
    Promise.all([getTypeRoster(), getEvolutionFamilies()])
      .then(([r, f]) => { setRoster(r); setFamilies(f) })
      .catch(() => setError('Couldn’t load Pokémon data from PokeAPI.'))
  }, [])

  // Remember which run the encounters belong to, so the prototypes only start once they're in.
  const [loadedFor, setLoadedFor] = useState(null)
  useEffect(() => {
    if (runId) getEncounters(runId).then((list) => { setEncounters(list); setLoadedFor(runId) }).catch((e) => setError(e.message))
  }, [runId])

  const run = runs.find((r) => r.id === runId)
  const rosterById = useMemo(() => Object.fromEntries(roster.map((e) => [e.id, e])), [roster])

  return (
    <section className="test-page">
      <div className="page-head">
        <h2>Test lab</h2>
        <div className="run-picker" role="tablist" aria-label="Runs">
          {runs.map((r) => (
            <button key={r.id} role="tab" aria-selected={r.id === runId} className={r.id === runId ? 'run-chip active' : 'run-chip'} onClick={() => setRunId(r.id)}>
              {r.name}
            </button>
          ))}
        </div>
      </div>
      <p className="status">Prototypes to try out. Everything here only reads your runs; nothing is saved.</p>
      <nav className="test-jump" aria-label="Prototypes">
        {SECTIONS.map(([group, items]) => (
          <div key={group} className="jump-group">
            <span className="jump-label">{group}</span>
            {items.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}
          </div>
        ))}
      </nav>
      {error && <p className="status error">{error}</p>}
      {run && loadedFor !== run.id && <p className="status">Loading {run.name}…</p>}
      {run && loadedFor === run.id && (
        <Lab key={run.id} run={run} runs={runs} encounters={encounters} rosterById={rosterById} families={families} />
      )}
    </section>
  )
}

function Lab({ run, runs, encounters, rosterById, families }) {
  const gen = run.generation
  const names = { p1: run.player1_name, p2: run.player2_name }
  const rows = areaRows(run.base_game, encounters)
  const team = rows.filter((r) => r.status === 'team')
  const props = { run, gen, names, rows, team, encounters, rosterById, families }
  return (
    <>
      <Category id="cat-home" title="Home" note="What a front page could hold.">
        <Card id="home" title="Home & news" idea="A front page: the run you’re playing, what happened lately, and doors to the other pages.">
          <Home {...props} runs={runs} />
        </Card>
      </Category>

      <Category id="cat-play" title="Before you play" note="Planning the next stretch: Pokédex data meets the run.">
        <Card id="next" title="Next up" idea="One glance before you play: where to go next and what the next boss is.">
          <NextUp {...props} />
        </Card>
        <Card id="route" title="Route finder" idea="What can appear on an area in this game, with dupe chance, dupes and type clashes marked.">
          <RouteFinder {...props} />
        </Card>
        <Card id="planner" title="Area planner" idea="Every area you haven’t done yet, ranked by how many evolution lines there are still new to you.">
          <AreaPlanner {...props} />
        </Card>
        <Card id="whatif" title="What-if checker" idea="Type the two Pokémon you might catch on the next area: see if the pair is a dupe, clashes with the team, and where it would go.">
          <WhatIf {...props} />
        </Card>
        <Card id="caps" title="Level caps" idea="The bosses in order, with their ace’s level as the cap and how many of your team are weak to them. Vanilla numbers: hacks need their own list.">
          <LevelCaps {...props} />
        </Card>
        <Card id="prep" title="Boss prep" idea="For a chosen boss: the best super-effective moves each team member learns by level-up before the cap. Pokédex learnsets × run × caps.">
          <BossPrep {...props} />
        </Card>
      </Category>

      <Category id="cat-team" title="Team" note="Building and checking the six pairs.">
        <Card id="coverage" title="Team weaknesses & coverage" idea="How many of your team are weak to each attacking type, and which types your team’s own types hit hard. Gen-correct chart.">
          <Coverage {...props} />
        </Card>
        <Card id="free" title="Free primary types" idea="Which primary types are still open for the team (no shared types rule).">
          <FreeTypes {...props} />
        </Card>
        <Card id="swaps" title="Swap suggestions" idea="PC pairs that could join the team right now without a type clash.">
          <Swaps {...props} />
        </Card>
        <Card id="evo" title="Evolution watch" idea="What your living Pokémon evolve into next and how, limited to evolutions that exist in the run’s generation.">
          <EvolutionWatch {...props} />
        </Card>
        <Card id="rules" title="Rule check" idea="Your house rules as a live checklist.">
          <RuleCheck {...props} />
        </Card>
      </Category>

      <Category id="cat-history" title="History" note="Looking back, within a run and across runs.">
        <Card id="timeline" title="Run timeline" idea="Every area as a dot in game order, coloured by what happened there.">
          <Timeline {...props} />
        </Card>
        <Card id="graveyard" title="Graveyard" idea="A memorial for fallen pairs. Streamers love this one.">
          <Graveyard {...props} />
        </Card>
        <Card id="death" title="Death report (mock)" idea="How logging a death could look: cause, killer, level, last words. Feeds the graveyard and death stats.">
          <DeathReport {...props} />
        </Card>
        <Card id="dex" title="Run Pokédex" idea="This generation’s new Pokémon: coloured if caught in this run, a silhouette if not.">
          <RunDex {...props} />
        </Card>
        <Card id="players" title={`${names.p1} vs ${names.p2}`} idea="Friendly rivalry: what each player brought to the run.">
          <Players {...props} />
        </Card>
        <Card id="history" title="Where did we use it?" idea="Search any Pokémon and see every run and area its line was caught in, and how it ended. Could become a badge on Pokédex cards.">
          <History runs={runs} rosterById={rosterById} families={families} />
        </Card>
        <Card id="stats" title="All-run stats" idea="Compare runs: catches, deaths, survival rate, favourite types.">
          <AllRunStats runs={runs} rosterById={rosterById} />
        </Card>
        <Card id="badges" title="Achievements" idea="Milestones worked out from the run. Each one could also appear as a news item on the home page.">
          <Achievements {...props} />
        </Card>
      </Category>

      <Category id="cat-setup" title="Setup" note="Starting a run and choosing its house rules.">
        <Card id="setup" title="New run setup (mock)" idea="A form for starting a run with its own rule set, instead of rules being built into the app.">
          <RunSetup />
        </Card>
      </Category>

      <Category id="cat-share" title="Share & stream" note="For Discord, chat and OBS.">
        <Card id="overlay" title="Stream overlay" idea="A strip of linked pairs. The real one is at /overlay?run=Name (see-through, updates live).">
          <Overlay {...props} />
        </Card>
        <Card id="share" title="Share summary" idea="A short text about the run to paste in Discord, WhatsApp or stream chat.">
          <ShareSummary {...props} />
        </Card>
      </Category>
    </>
  )
}

function Category({ id, title, note, children }) {
  return (
    <section id={id} className="test-category">
      <h3 className="category-title">{title}</h3>
      <p className="status small-print">{note}</p>
      {children}
    </section>
  )
}

function Card({ id, title, idea, children }) {
  return (
    <article id={id} className="test-card">
      <header>
        <h3>{title}</h3>
        <p className="status small-print">{idea}</p>
      </header>
      {children}
    </article>
  )
}

const Mon = ({ id, size = 48 }) => (id ? <img className="pixel" src={spriteUrl(id)} alt="" width={size} height={size} loading="lazy" /> : null)
const monName = (id, rosterById) => rosterById[id]?.label ?? (id ? `#${id}` : '—')

// ---- Home & news ----

const NEWS_VERB = { team: 'joined the team', box: 'went to the PC', dead: 'fell', failed: 'failed', pending: 'got a first catch' }

/** When this browser last opened the Test tab for a run (per viewer, so no database needed). */
function useLastVisit(runId) {
  const key = `test-last-visit-${runId}`
  const [last] = useState(() => {
    try { return localStorage.getItem(key) } catch { return null }
  })
  useEffect(() => {
    try { localStorage.setItem(key, new Date().toISOString()) } catch { /* not remembered */ }
  }, [key])
  return last
}

function Home({ runs, encounters, rosterById, names, run }) {
  const lastVisit = useLastVisit(run.id)
  const news = [...encounters].filter((e) => e.p1_pokemon_id || e.p2_pokemon_id).sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 6)
  const rows = areaRows(run.base_game, encounters)
  const used = rows.filter((r) => r.status !== 'pending').length
  const team = rows.filter((r) => r.status === 'team')
  const next = rows.find((r) => r.status === 'pending')
  const cap = LEVEL_CAPS[run.base_game]?.[0]
  return (
    <>
    <div className="home-hero">
      <div>
        <span className="status small-print">{run.status === 'active' ? 'Playing now' : run.status === 'won' ? 'Beaten' : 'Lost'} · {gameLabel(run.base_game)}</span>
        <strong className="hero-name">{run.name}</strong>
        <div className="hero-progress" style={{ '--p': rows.length ? used / rows.length : 0 }} title={`${used} of ${rows.length} areas`} />
        <span className="status small-print">{used} of {rows.length} areas · next: {next?.area ?? 'none left'}{cap ? ` · next cap ${cap[2]} (${cap[0]})` : ''}</span>
      </div>
      <div className="hero-team">
        {team.length === 0 && <span className="status small-print">No team yet</span>}
        {team.map((r) => (
          <span key={r.area} className="overlay-pair" title={r.area}>
            <Mon id={r.p1_pokemon_id} size={48} /><span className="overlay-link" /><Mon id={r.p2_pokemon_id} size={48} />
          </span>
        ))}
      </div>
    </div>
    <div className="home-grid">
      <div>
        <h4 className="mini-title">Latest in {run.name}</h4>
        {news.length === 0 ? (
          <p className="status">No catches yet. News shows up here as soon as someone catches something.</p>
        ) : (
          <ul className="news">
            {news.map((e) => (
              <li key={e.id} className={lastVisit && e.updated_at > lastVisit ? 'is-new' : ''}>
                <span className="news-mons"><Mon id={e.p1_pokemon_id} size={40} /><Mon id={e.p2_pokemon_id} size={40} /></span>
                <span>
                  <strong>{e.area}</strong>: {PLAYERS.map((p) => e[`${p}_nickname`] || monName(e[`${p}_pokemon_id`], rosterById)).join(' & ')} {NEWS_VERB[e.status]}
                  {e.status === 'dead' && e.died_at && ` (${e.died_at})`}
                </span>
                <span className="status small-print">{timeAgo(e.updated_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h4 className="mini-title">Runs</h4>
        <ul className="door-list">
          {runs.map((r) => (
            <li key={r.id}><span className={`run-state ${r.status}`}>{r.status === 'won' ? 'Beaten' : r.status === 'lost' ? 'Lost' : 'In progress'}</span> {r.name} <span className="status small-print">{gameLabel(r.base_game)}</span></li>
          ))}
        </ul>
        <h4 className="mini-title">Go to</h4>
        <div className="doors">
          <Link to="/" className="door"><strong>Dashboard</strong><span>Log catches for {names.p1} & {names.p2}</span></Link>
          <Link to="/pokedex" className="door"><strong>Pokédex</strong><span>Look up any Pokémon</span></Link>
          <Link to="/pokedex/types" className="door"><strong>Type chart</strong><span>Gen-correct matchups</span></Link>
          <Link to="/pokedex/moves" className="door"><strong>Moves</strong><span>Who learns what</span></Link>
          <a href={`/overlay?run=${encodeURIComponent(run.name)}`} className="door" target="_blank" rel="noreferrer"><strong>Stream overlay</strong><span>Team strip for OBS</span></a>
          <a href="#graveyard" className="door"><strong>Graveyard</strong><span>{rows.filter((r) => r.status === 'dead').length} fallen pairs</span></a>
        </div>
      </div>
    </div>
    </>
  )
}

// ---- Next up ----

function NextUp({ rows, run, team }) {
  const next = rows.find((r) => r.status === 'pending')
  const caps = LEVEL_CAPS[run.base_game]
  return (
    <div className="next-up">
      <div className="next-tile"><span className="status small-print">Next area</span><strong>{next?.area ?? 'All done'}</strong></div>
      <div className="next-tile"><span className="status small-print">Next boss (first in list)</span><strong>{caps ? `${caps[0][0]} · cap ${caps[0][2]}` : 'No list for this game'}</strong></div>
      <div className="next-tile"><span className="status small-print">Team</span><strong>{team.length}/{TEAM_SIZE} pairs</strong></div>
      <p className="status small-print">Idea: store “bosses beaten” on the run so the boss tile moves on by itself.</p>
    </div>
  )
}

// ---- Route finder ----

function RouteFinder({ run, gen, rows, encounters, rosterById, families, names }) {
  const [area, setArea] = useState(rows.find((r) => r.status === 'pending' && r.area !== 'Starter')?.area ?? rows[0]?.area)
  const [state, setState] = useState({ status: 'idle', mons: [] })
  const location = area ? locationSlug(area, gen) : null
  const version = versionOf(run.base_game)

  useEffect(() => {
    if (!location) return
    // PokeAPI has no "starter" location: offer the generation's three starters instead.
    if (location === 'starter') return setState({ status: 'ready', mons: (STARTERS[gen] ?? []).map((id) => ({ id, dex: id, min: 5, max: 5, methods: { gift: 100 } })) })
    if (GIFTS[area]) {
      const [id, level] = GIFTS[area]
      return setState({ status: 'ready', mons: [{ id, dex: id, min: level, max: level, methods: { gift: 100 } }] })
    }
    let live = true
    setState({ status: 'loading', mons: [] })
    getAreaEncounters(location, version)
      .then((mons) => live && setState({ status: 'ready', mons }))
      .catch((e) => live && setState({ status: 'error', mons: [], message: e.message }))
    return () => { live = false }
  }, [location, version, gen, area])

  const caught = catches(encounters)
  const familyOf = (dex) => families[dex] ?? -dex
  const usedFamilies = new Map(caught.map((c) => [familyOf(rosterById[c.id]?.dex ?? c.id), c]))
  const teamTypes = teamPrimaryTypes(encounters, rosterById, gen)

  // Optional max level hides post-game slots (PokeAPI mixes Lv 2 and Lv 35 on the same route).
  const [maxLevel, setMaxLevel] = useState('')
  const shown = maxLevel ? state.mons.filter((m) => m.min <= Number(maxLevel)) : state.mons

  // Dupe chance per encounter method: share of the slot odds that lands on an already-caught line.
  const odds = {}
  for (const m of shown) {
    const dupe = usedFamilies.has(familyOf(m.dex))
    for (const [method, pct] of Object.entries(m.methods)) {
      const o = (odds[method] ??= { total: 0, dupe: 0 })
      o.total += pct
      if (dupe) o.dupe += pct
    }
  }

  return (
    <>
      {run.randomized && <p className="rule-warning">This run is randomized, so the game’s normal encounter tables don’t apply. Shown for reference only.</p>}
      {Object.keys(odds).length > 0 && (
        <div className="odds">
          {Object.entries(odds).map(([method, o]) => (
            <span key={method}>{displayName(method)}: <strong>{Math.round((o.dupe / o.total) * 100)}%</strong> dupe chance</span>
          ))}
        </div>
      )}
      <div className="toolbar">
        <select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Area">
          {rows.map((r) => <option key={r.area} value={r.area}>{r.area}</option>)}
        </select>
        <input type="number" min="1" max="100" className="level-filter" placeholder="Max level" aria-label="Hide Pokémon above this level" value={maxLevel} onChange={(e) => setMaxLevel(e.target.value)} />
        <span className="status small-print">PokeAPI location “{location}” in {displayName(version)}</span>
      </div>
      {state.status === 'loading' && <p className="status">Loading encounters…</p>}
      {state.status === 'error' && <p className="status error">{state.message}</p>}
      {state.status === 'ready' && state.mons.length === 0 && <p className="status">PokeAPI has no wild encounters under this name. Gifts, starters and hack areas need a manual list.</p>}
      <ul className="route-mons">
        {shown.map((m) => {
          const entry = rosterById[m.id]
          const types = entry ? rosterTypesInGeneration(entry, gen) : []
          const dupe = usedFamilies.get(familyOf(m.dex))
          const clash = types[0] && teamTypes.has(types[0])
          return (
            <li key={m.id} className={dupe ? 'route-mon is-dupe' : 'route-mon'}>
              <Mon id={m.id} size={56} />
              <div>
                <strong>{rosterById[m.id]?.label ?? (m.name ? displayName(m.name) : `#${m.id}`)}</strong>
                <span className="status small-print">Lv {m.min === m.max ? m.min : `${m.min}–${m.max}`} · {Object.entries(m.methods).map(([k, v]) => `${displayName(k)} ${v}%`).join(', ')}</span>
                <span className="types">{types.map((t) => <TypeLink key={t} type={t} small />)}</span>
                {dupe && <span className="slot-warning">Dupe: {names[dupe.player]} has this line ({dupe.area})</span>}
                {!dupe && clash && <span className="clash-tag">Primary type already on the team</span>}
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}

// ---- Level caps ----

function LevelCaps({ run, team, gen, rosterById }) {
  const caps = LEVEL_CAPS[run.base_game]
  const [beaten, setBeaten] = useState(0)
  const chart = useChart(gen)
  const mons = teamMons(team, rosterById)
  if (!caps) return <p className="status">No boss list for {gameLabel(run.base_game)} yet.</p>
  return (
    <>
      <ol className="caps">
        {caps.map(([boss, type, level], i) => {
          // Boss danger: how many team members take super-effective hits from the boss's type.
          const weak = chart && mons.length ? matchupCounts(chart, mons, gen, type).weak : null
          return (
            <li key={boss} className={i < beaten ? 'done' : i === beaten ? 'current' : ''} style={{ '--type-color': TYPE_COLORS[type] }}>
              <button type="button" onClick={() => setBeaten(i + 1 === beaten ? i : i + 1)} title="Mark beaten (not saved)">
                <span className="cap-level">{level}</span>
                <span className="cap-boss">{boss}</span>
                <span className="cap-type">{displayName(type)}</span>
                {weak !== null && <span className={weak >= mons.length / 2 ? 'cap-risk high' : 'cap-risk'}>{weak}/{mons.length} weak</span>}
              </button>
            </li>
          )
        })}
      </ol>
      <p className="status small-print">Click a boss to mark it and everything before it as beaten (not saved). “Weak” counts team members hurt extra by the boss’s main type.</p>
    </>
  )
}

// ---- Team weaknesses ----

/** The type chart of one generation (null while loading). */
function useChart(gen) {
  const [chart, setChart] = useState(null)
  useEffect(() => { getTypeData().then((t) => setChart(chartForGeneration(t, gen))).catch(() => setChart({})) }, [gen])
  return chart
}
const teamMons = (team, rosterById) => team.flatMap((r) => PLAYERS.map((p) => rosterById[r[`${p}_pokemon_id`]])).filter(Boolean)
function matchupCounts(chart, mons, gen, attacker) {
  if (!chart[attacker]) return { weak: 0, resist: 0 }
  const ms = mons.map((m) => defensiveMatchups(chart, rosterTypesInGeneration(m, gen)).find((x) => x.type === attacker).multiplier)
  return { weak: ms.filter((x) => x > 1).length, resist: ms.filter((x) => x < 1).length }
}

function Coverage({ team, gen, rosterById }) {
  const chart = useChart(gen)
  const mons = teamMons(team, rosterById)
  if (!chart) return <p className="status">Loading the type chart…</p>
  if (mons.length === 0) return <p className="status">Nobody on the team yet. Weaknesses show up once a pair joins.</p>
  const rows = Object.keys(chart).map((attacker) => ({ attacker, ...matchupCounts(chart, mons, gen, attacker) }))
    .sort((a, b) => b.weak - a.weak || a.resist - b.resist)
  // Attack side: which defending types at least one team type (same-type moves) hits for 2×.
  const teamTypes = [...new Set(mons.flatMap((m) => rosterTypesInGeneration(m, gen)))]
  const defenders = Object.keys(chart)
  const hit = defenders.filter((d) => teamTypes.some((t) => chart[t]?.[d] === 2))
  return (
    <>
      <ul className="coverage">
        {rows.map((r) => (
          <li key={r.attacker}>
            <TypeLink type={r.attacker} small />
            <span className="bar weak" style={{ '--n': r.weak, '--of': mons.length }} title={`${r.weak} weak`} />
            <span className="bar resist" style={{ '--n': r.resist, '--of': mons.length }} title={`${r.resist} resist`} />
            <span className="status small-print">{r.weak} weak · {r.resist} resist</span>
          </li>
        ))}
      </ul>
      <h4 className="mini-title attack-title">Attack coverage with the team’s own types: {hit.length} of {defenders.length}</h4>
      <div className="free-types">
        {defenders.map((d) => (
          <span key={d} className={hit.includes(d) ? 'free-type' : 'free-type taken'} style={{ '--type-color': TYPE_COLORS[d] }}>{displayName(d)}</span>
        ))}
      </div>
      <p className="status small-print">Coloured = something on the team hits it super-effectively with a move of its own type. Crossed out = a gap.</p>
    </>
  )
}

// ---- Timeline ----

function Timeline({ rows }) {
  const done = rows.filter((r) => r.status !== 'pending').length
  return (
    <>
      <div className="timeline" role="list">
        {rows.map((r) => <span key={r.area} role="listitem" className={`dot s-${r.status}`} title={`${r.area}: ${r.status}`} />)}
      </div>
      <p className="status small-print">{done} of {rows.length} areas used · green team, blue PC, red dead, grey failed, hollow not yet.</p>
    </>
  )
}

// ---- Graveyard ----

function Graveyard({ rows, rosterById, names }) {
  const dead = rows.filter((r) => r.status === 'dead')
  if (dead.length === 0) return <p className="status">Nobody has fallen yet. Long may it last.</p>
  return (
    <ul className="graves">
      {dead.map((r) => (
        <li key={r.area}>
          <span className="grave-mons"><Mon id={r.p1_pokemon_id} /><Mon id={r.p2_pokemon_id} /></span>
          <strong>{PLAYERS.map((p) => r[`${p}_nickname`] || monName(r[`${p}_pokemon_id`], rosterById)).join(' & ')}</strong>
          <span className="status small-print">Caught on {r.area}{r.died_at ? ` · ${r.died_at}` : ''}</span>
          <span className="status small-print">{names.p1} & {names.p2}</span>
        </li>
      ))}
    </ul>
  )
}

// ---- Stream overlay ----

function Overlay({ team, rosterById, names, run }) {
  // Link builder for OBS: the options /overlay understands.
  const [opt, setOpt] = useState({ size: 'normal', names: 'on', theme: 'dark' })
  const params = new URLSearchParams({ run: run.name })
  if (opt.size !== 'normal') params.set('size', opt.size)
  if (opt.names === 'off') params.set('names', 'off')
  if (opt.theme === 'light') params.set('theme', 'light')
  const link = `${window.location.origin}/overlay?${params}`
  const pick = (k, values) => (
    <select value={opt[k]} onChange={(e) => setOpt((o) => ({ ...o, [k]: e.target.value }))} aria-label={k}>
      {values.map((v) => <option key={v} value={v}>{k}: {v}</option>)}
    </select>
  )
  return (
    <>
    <div className="toolbar">
      {pick('size', ['small', 'normal', 'large'])}
      {pick('names', ['on', 'off'])}
      {pick('theme', ['dark', 'light'])}
      <a className="chip-button" href={link} target="_blank" rel="noreferrer">Open overlay</a>
    </div>
    <p className="status small-print">OBS → Sources → + → Browser → URL: <code>{link}</code></p>
    <div className="overlay-stage">
      <div className="overlay-strip">
        <span className="overlay-run">{run.name}</span>
        {team.length === 0 && <span className="overlay-empty">No team yet</span>}
        {team.map((r) => (
          <span key={r.area} className="overlay-pair" title={r.area}>
            <Mon id={r.p1_pokemon_id} size={56} />
            <span className="overlay-link" />
            <Mon id={r.p2_pokemon_id} size={56} />
          </span>
        ))}
        <span className="overlay-names">{names.p1} ↔ {names.p2}</span>
      </div>
    </div>
    </>
  )
}

// ---- Rule check ----

function RuleCheck({ encounters, rosterById, families, gen, team }) {
  const conflicts = Object.keys(typeConflicts(encounters, rosterById, gen)).length
  const caught = catches(encounters)
  const famCount = {}
  for (const c of caught) {
    const f = families[rosterById[c.id]?.dex] ?? c.id
    famCount[f] = (famCount[f] ?? 0) + 1
  }
  const dupes = Object.values(famCount).filter((n) => n > 1).length
  const checks = [
    ['Team has at most 6 pairs', team.length <= TEAM_SIZE, `${team.length} pairs`],
    ['No shared primary types on the team', conflicts === 0, conflicts ? `${conflicts} pairs clash` : 'All different'],
    ['Dupes clause: one catch per evolution line', dupes === 0, dupes ? `${dupes} lines caught twice` : 'No dupes'],
    ['Both partners of a pair share a fate', true, 'Built in: one status per pair'],
  ]
  return (
    <ul className="checks">
      {checks.map(([label, ok, detail]) => (
        <li key={label} className={ok ? 'ok' : 'bad'}>
          <span className="check-mark" aria-hidden="true">{ok ? '✓' : '!'}</span>
          <span>{label}</span>
          <span className="status small-print">{detail}</span>
        </li>
      ))}
    </ul>
  )
}

// ---- Free primary types ----

function FreeTypes({ encounters, rosterById, gen }) {
  const used = teamPrimaryTypes(encounters, rosterById, gen)
  // Types that didn't exist yet in this generation are left out (Dark/Steel < II, Fairy < VI).
  const exists = (t) => !((t === 'dark' || t === 'steel') && gen < 2) && !(t === 'fairy' && gen < 6)
  const types = Object.keys(TYPE_COLORS).filter(exists)
  return (
    <>
      <div className="free-types">
        {types.map((t) => (
          <span key={t} className={used.has(t) ? 'free-type taken' : 'free-type'} style={{ '--type-color': TYPE_COLORS[t] }}>
            {displayName(t)}
          </span>
        ))}
      </div>
      <p className="status small-print">{types.length - used.size} of {types.length} primary types still free. Crossed out = already a team pair’s primary type.</p>
    </>
  )
}

// ---- All-run stats ----

function AllRunStats({ runs, rosterById }) {
  const [byRun, setByRun] = useState(null)
  useEffect(() => {
    Promise.all(runs.map((r) => getEncounters(r.id))).then((lists) => setByRun(lists)).catch(() => setByRun([]))
  }, [runs])
  if (!byRun) return <p className="status">Loading every run…</p>
  return (
    <div className="table-wrap">
      <table className="moves">
        <thead>
          <tr><th>Run</th><th className="num">Areas used</th><th className="num">Pairs caught</th><th className="num">Deaths</th><th className="num">Survival</th><th>Most caught primary type</th></tr>
        </thead>
        <tbody>
          {runs.map((r, i) => {
            const list = byRun[i] ?? []
            const caught = list.filter((e) => e.p1_pokemon_id && e.p2_pokemon_id)
            const dead = list.filter((e) => e.status === 'dead').length
            const typeCount = {}
            for (const c of catches(list)) {
              const t = rosterById[c.id] && rosterTypesInGeneration(rosterById[c.id], r.generation)[0]
              if (t) typeCount[t] = (typeCount[t] ?? 0) + 1
            }
            const [topType, topN] = Object.entries(typeCount).sort((a, b) => b[1] - a[1])[0] ?? []
            return (
              <tr key={r.id}>
                <td><strong>{r.name}</strong></td>
                <td className="num">{list.filter((e) => e.status !== 'pending').length}</td>
                <td className="num">{caught.length}</td>
                <td className="num">{dead}</td>
                <td className="num">{caught.length ? `${Math.round(((caught.length - dead) / caught.length) * 100)}%` : '—'}</td>
                <td>{topType ? <><TypeLink type={topType} small /> <span className="status small-print">×{topN}</span></> : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ---- Run Pokédex ----

function RunDex({ gen, encounters, rosterById }) {
  const caught = new Set(catches(encounters).map((c) => rosterById[c.id]?.dex ?? c.id))
  // Species introduced in this generation (base forms only: regional forms share a dex number).
  const species = Object.values(rosterById).filter((e) => e.generation === gen && e.id === e.dex)
  const have = species.filter((s) => caught.has(s.dex)).length
  return (
    <>
      <p className="status">{have} of {species.length} Gen {gen} species caught in this run{caught.size > have ? `, plus ${caught.size - have} from other generations` : ''}.</p>
      <ul className="run-dex">
        {species.map((s) => (
          <li key={s.id} className={caught.has(s.dex) ? 'got' : ''} title={s.label}>
            <img src={spriteUrl(s.id)} alt={s.label} width="48" height="48" loading="lazy" className="pixel" />
          </li>
        ))}
      </ul>
    </>
  )
}

// ---- Evolution watch ----

function EvolutionWatch({ rows, gen, rosterById, names }) {
  const alive = rows.filter((r) => r.status === 'team' || r.status === 'box')
  const mons = alive.flatMap((r) => PLAYERS.filter((p) => r[`${p}_pokemon_id`]).map((p) => ({ area: r.area, status: r.status, player: p, nickname: r[`${p}_nickname`], entry: rosterById[r[`${p}_pokemon_id`]] }))).filter((m) => m.entry)
  const key = [...new Set(mons.map((m) => m.entry.dex))].sort((a, b) => a - b).join(',')
  const [evos, setEvos] = useState(null)
  useEffect(() => {
    getNextEvolutions(key ? key.split(',').map(Number) : []).then(setEvos).catch(() => setEvos({}))
  }, [key])
  if (!evos) return <p className="status">Looking up evolutions…</p>
  // Only evolutions that existed in the run's generation (no Espeon in a Gen 1 run).
  const list = mons.map((m) => ({ ...m, next: (evos[m.entry.dex] ?? []).filter((e) => e.generation <= gen) })).filter((m) => m.next.length)
    .sort((a, b) => (b.status === 'team') - (a.status === 'team'))
  if (list.length === 0) return <p className="status">No team or PC Pokémon with an evolution left.</p>
  return (
    <ul className="evo-watch">
      {list.map((m) => (
        <li key={`${m.area}-${m.player}`} className={m.status === 'team' ? 'on-team' : ''}>
          <Mon id={m.entry.id} size={40} />
          <span><strong>{m.nickname || m.entry.label}</strong> <span className="status small-print">{names[m.player]} · {m.area}</span></span>
          <span className="evo-next">{m.next.map((e) => <span key={e.id}><Mon id={e.id} size={40} />{displayName(e.name)} <em>{e.how}</em></span>)}</span>
        </li>
      ))}
    </ul>
  )
}

// ---- Player vs player ----

function Players({ encounters, rosterById, gen, names }) {
  const all = catches(encounters)
  return (
    <div className="players">
      {PLAYERS.map((p) => {
        const mine = all.filter((c) => c.player === p)
        const types = {}
        for (const c of mine) {
          const t = primaryType(rosterById[c.id], gen)
          if (t) types[t] = (types[t] ?? 0) + 1
        }
        const top = Object.entries(types).sort((a, b) => b[1] - a[1])
        const nicknamed = mine.filter((c) => c.nickname).length
        return (
          <div key={p} className="player-col">
            <h4>{names[p]}</h4>
            <dl className="facts">
              <div><dt>Catches</dt><dd>{mine.length}</dd></div>
              <div><dt>Different primary types</dt><dd>{top.length}</dd></div>
              <div><dt>Nicknamed</dt><dd>{mine.length ? Math.round((nicknamed / mine.length) * 100) : 0}%</dd></div>
            </dl>
            <div className="type-spread">
              {top.map(([t, n]) => <span key={t} style={{ '--type-color': TYPE_COLORS[t], flexGrow: n }} title={`${displayName(t)}: ${n}`} />)}
            </div>
            <p className="status small-print">Favourite: {top.slice(0, 3).map(([t, n]) => `${displayName(t)} ×${n}`).join(', ') || '—'}</p>
          </div>
        )
      })}
    </div>
  )
}

// ---- Share summary ----

function ShareSummary({ run, rows, team, rosterById, names }) {
  const [copied, setCopied] = useState(false)
  const dead = rows.filter((r) => r.status === 'dead').length
  const used = rows.filter((r) => r.status !== 'pending').length
  const pair = (r) => PLAYERS.map((p) => r[`${p}_nickname`] || monName(r[`${p}_pokemon_id`], rosterById)).join(' & ')
  const text = [
    `${run.name} (${gameLabel(run.base_game)}) · ${names.p1} & ${names.p2}`,
    `Areas used: ${used}/${rows.length} · Deaths: ${dead}`,
    `Team: ${team.map(pair).join(', ') || 'nobody yet'}`,
  ].join('\n')
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard blocked: the text can still be selected by hand */ }
  }
  return (
    <div className="share">
      <pre>{text}</pre>
      <button type="button" className="chip-button" onClick={copy}>{copied ? 'Copied' : 'Copy text'}</button>
    </div>
  )
}

// ---- What-if checker ----

function WhatIf({ gen, rows, encounters, rosterById, families, names }) {
  const options = useMemo(() => Object.values(rosterById).filter((e) => e.generation <= gen), [rosterById, gen])
  const byLabel = useMemo(() => Object.fromEntries(options.map((e) => [e.label.toLowerCase(), e])), [options])
  const [text, setText] = useState({ p1: '', p2: '' })
  const picks = { p1: byLabel[text.p1.trim().toLowerCase()], p2: byLabel[text.p2.trim().toLowerCase()] }
  const area = rows.find((r) => r.status === 'pending')?.area ?? 'next area'

  let verdict = null
  if (picks.p1 && picks.p2) {
    const fake = { id: 'what-if', area: `__what-if__${area}`, status: 'pending', p1_pokemon_id: picks.p1.id, p2_pokemon_id: picks.p2.id }
    const problems = []
    for (const p of PLAYERS) {
      const d = findDupes(encounters, picks[p].id, rosterById, families, { area: fake.area, player: p })
      if (d.length) problems.push(`${names[p]}’s ${picks[p].label} is a dupe (${d.map((x) => `${names[x.player]}, ${x.area}`).join('; ')})`)
    }
    const teamCount = encounters.filter((e) => e.status === 'team').length
    const clash = typeConflicts([...encounters, { ...fake, status: 'team' }], rosterById, gen)['what-if']
    const place = teamCount >= TEAM_SIZE ? 'the PC (team is full)' : clash ? `the PC, or swap: shares ${clash.join(', ')} with a team pair` : 'the team'
    verdict = { ok: problems.length === 0, problems, place }
  }

  return (
    <>
      <datalist id="whatif-mons">{options.map((e) => <option key={e.id} value={e.label} />)}</datalist>
      <div className="whatif toolbar">
        {PLAYERS.map((p) => (
          <input key={p} list="whatif-mons" placeholder={`${names[p]}’s Pokémon`} aria-label={`${names[p]}’s Pokémon`} value={text[p]} onChange={(e) => setText((t) => ({ ...t, [p]: e.target.value }))} />
        ))}
      </div>
      {verdict ? (
        <div className={verdict.ok ? 'verdict ok' : 'verdict bad'}>
          <strong>{verdict.ok ? `Allowed on ${area}` : 'Not allowed'}</strong>
          {verdict.problems.map((p) => <span key={p} className="slot-warning">{p}</span>)}
          {verdict.ok && <span>This pair would go to {verdict.place}.</span>}
        </div>
      ) : (
        <p className="status small-print">Pick two Pokémon to see the verdict. Nothing is saved.</p>
      )}
    </>
  )
}

// ---- Where did we use it? ----

const FATE = { team: 'on the team', box: 'in the PC', dead: 'died', failed: 'failed', pending: 'waiting for partner' }

function History({ runs, rosterById, families }) {
  const [byRun, setByRun] = useState(null)
  const [text, setText] = useState('')
  useEffect(() => {
    Promise.all(runs.map((r) => getEncounters(r.id))).then(setByRun).catch(() => setByRun([]))
  }, [runs])
  const options = useMemo(() => Object.values(rosterById), [rosterById])
  const pick = options.find((e) => e.label.toLowerCase() === text.trim().toLowerCase())
  const family = pick ? families[pick.dex] ?? -pick.dex : null
  const hits = pick && byRun
    ? runs.flatMap((r, i) => catches(byRun[i] ?? []).filter((c) => {
        const e = rosterById[c.id]
        return e && (families[e.dex] ?? -e.dex) === family
      }).map((c) => ({ ...c, run: r })))
    : []
  return (
    <>
      <datalist id="history-mons">{options.map((e) => <option key={e.id} value={e.label} />)}</datalist>
      <div className="toolbar">
        <input list="history-mons" placeholder="Search a Pokémon (whole evolution line counts)" aria-label="Pokémon" value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      {!byRun && <p className="status">Loading every run…</p>}
      {pick && byRun && hits.length === 0 && <p className="status">Never caught in any run. A fresh pick!</p>}
      {hits.length > 0 && (
        <ul className="news">
          {hits.map((h) => (
            <li key={`${h.run.id}-${h.area}-${h.player}`}>
              <Mon id={h.id} size={40} />
              <span><strong>{h.nickname || monName(h.id, rosterById)}</strong> · {h.run[h.player === 'p1' ? 'player1_name' : 'player2_name']} · {h.area}</span>
              <span className="status small-print">{h.run.name}: {FATE[h.status]}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

// ---- Swap suggestions ----

function Swaps({ rows, encounters, rosterById, gen, names }) {
  const teamTypes = teamPrimaryTypes(encounters, rosterById, gen)
  const teamFull = rows.filter((r) => r.status === 'team').length >= TEAM_SIZE
  const box = rows.filter((r) => r.status === 'box' && r.p1_pokemon_id && r.p2_pokemon_id).map((r) => {
    const types = [...new Set(PLAYERS.map((p) => primaryType(rosterById[r[`${p}_pokemon_id`]], gen)).filter(Boolean))]
    return { r, types, clash: types.filter((t) => teamTypes.has(t)) }
  })
  const fits = box.filter((b) => b.clash.length === 0)
  if (box.length === 0) return <p className="status">No complete pairs in the PC.</p>
  return (
    <>
      <p className="status">{fits.length} of {box.length} PC pairs could join without a type clash{teamFull ? ' (team is full: swap one out first)' : ''}.</p>
      <ul className="route-mons">
        {fits.map(({ r, types }) => (
          <li key={r.area} className="route-mon">
            <Mon id={r.p1_pokemon_id} size={48} /><Mon id={r.p2_pokemon_id} size={48} />
            <div>
              <strong>{PLAYERS.map((p) => r[`${p}_nickname`] || monName(r[`${p}_pokemon_id`], rosterById)).join(' & ')}</strong>
              <span className="status small-print">{r.area} · {names.p1} & {names.p2}</span>
              <span className="types">{types.map((t) => <TypeLink key={t} type={t} small />)}</span>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

// ---- Boss prep ----

function BossPrep({ run, team, gen, rosterById, names }) {
  const caps = LEVEL_CAPS[run.base_game]
  const chart = useChart(gen)
  const [bossIndex, setBossIndex] = useState(0)
  const [data, setData] = useState(null) // { moves: {id: move}, learnsets: {monId: {moveId: ways}} }
  const mons = team.flatMap((r) => PLAYERS.map((p) => ({ p, area: r.area, nickname: r[`${p}_nickname`], entry: rosterById[r[`${p}_pokemon_id`]] }))).filter((m) => m.entry)
  const ids = mons.map((m) => m.entry.id).join(',')

  useEffect(() => {
    if (!caps || !ids) return
    let live = true
    ;(async () => {
      const game = (await getGames()).find((g) => g.name === run.base_game)
      const [moves, ...sets] = await Promise.all([getMoves(), ...ids.split(',').map((id) => getLearnset(Number(id), game?.id ?? null))])
      if (live) setData({ moves: Object.fromEntries(moves.map((m) => [m.id, m])), learnsets: Object.fromEntries(ids.split(',').map((id, i) => [id, sets[i]])) })
    })().catch(() => live && setData({ moves: {}, learnsets: {} }))
    return () => { live = false }
  }, [caps, ids, run.base_game])

  if (!caps) return <p className="status">No boss list for {gameLabel(run.base_game)} yet.</p>
  if (mons.length === 0) return <p className="status">Nobody on the team yet.</p>
  const [boss, bossType, cap] = caps[bossIndex]
  return (
    <>
      <div className="toolbar">
        <select value={bossIndex} onChange={(e) => setBossIndex(Number(e.target.value))} aria-label="Boss">
          {caps.map(([b, t, l], i) => <option key={b} value={i}>{b} ({displayName(t)}, cap {l})</option>)}
        </select>
      </div>
      {!data || !chart ? <p className="status">Loading learnsets…</p> : (
        <ul className="evo-watch">
          {mons.map((m) => {
            // Level-up moves learned by the cap that hit the boss's main type super-effectively.
            const good = Object.entries(data.learnsets[m.entry.id] ?? {}).flatMap(([moveId, ways]) => {
              const move = data.moves[moveId]
              const lv = ways.find((w) => w.method === 'level-up' && w.level !== null && w.level <= cap)
              return move && lv && move.power && chart[move.type]?.[bossType] === 2 ? [{ ...move, level: lv.level }] : []
            }).sort((a, b) => b.power - a.power).slice(0, 3)
            return (
              <li key={`${m.area}-${m.p}`}>
                <Mon id={m.entry.id} size={40} />
                <span><strong>{m.nickname || m.entry.label}</strong> <span className="status small-print">{names[m.p]}</span></span>
                <span className="evo-next">
                  {good.length === 0 ? <em>No super-effective level-up move by Lv {cap}</em> : good.map((g) => (
                    <span key={g.id}><TypeLink type={g.type} small /> {displayName(g.name)} <em>{g.power} power · Lv {g.level || 'evo'}</em></span>
                  ))}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      <p className="status small-print">Against {boss}’s {displayName(bossType)} type. Uses today’s move types, so older-gen changes (like Bite once being Normal) aren’t accounted for. TMs not included.</p>
    </>
  )
}

// ---- Area planner ----

function AreaPlanner({ run, gen, rows, encounters, rosterById, families }) {
  const pending = rows.filter((r) => r.status === 'pending' && r.area !== 'Starter' && !GIFTS[r.area])
  const [result, setResult] = useState(null)
  const version = versionOf(run.base_game)
  const key = pending.map((r) => r.area).join('|')
  useEffect(() => {
    let live = true
    const list = key ? key.split('|') : []
    Promise.all(list.map((a) => getAreaEncounters(locationSlug(a, gen), version).catch(() => [])))
      .then((all) => live && setResult(list.map((area, i) => ({ area, mons: all[i] }))))
    return () => { live = false }
  }, [key, gen, version])
  if (pending.length === 0) return <p className="status">No areas left to plan.</p>
  if (!result) return <p className="status">Checking {pending.length} areas…</p>
  const familyOf = (dex) => families[dex] ?? -dex
  const used = new Set(catches(encounters).map((c) => familyOf(rosterById[c.id]?.dex ?? c.id)))
  const scored = result.map(({ area, mons }) => {
    const lines = new Set(mons.map((m) => familyOf(m.dex)))
    const fresh = [...lines].filter((f) => !used.has(f)).length
    return { area, total: lines.size, fresh, mons }
  }).sort((a, b) => b.fresh - a.fresh)
  return (
    <>
      {run.randomized && <p className="rule-warning">Randomized run: based on the normal game’s tables, so only a rough guide.</p>}
      <div className="table-wrap">
        <table className="moves">
          <thead><tr><th>Area</th><th className="num">Lines here</th><th className="num">Still new</th><th>Possible</th></tr></thead>
          <tbody>
            {scored.map((s) => (
              <tr key={s.area}>
                <td><strong>{s.area}</strong></td>
                <td className="num">{s.total || '—'}</td>
                <td className="num">{s.total ? s.fresh : '—'}</td>
                <td><span className="planner-mons">{s.mons.slice(0, 8).map((m) => <Mon key={m.id} id={m.id} size={32} />)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="status small-print">“Still new” = evolution lines neither of you has caught yet. Areas with more new lines are less likely to give a dupe.</p>
    </>
  )
}

// ---- Achievements ----

function Achievements({ run, rows, team }) {
  const used = rows.filter((r) => r.status !== 'pending').length
  const pairs = rows.filter((r) => r.p1_pokemon_id && r.p2_pokemon_id).length
  const dead = rows.filter((r) => r.status === 'dead').length
  const list = [
    ['First pair', 'Both of you caught something on one area', pairs >= 1],
    ['Full team', `${TEAM_SIZE} pairs on the team`, team.length >= TEAM_SIZE],
    ['Halfway', 'Half of all areas used', used >= rows.length / 2],
    ['Collector', '25 pairs caught', pairs >= 25],
    ['Survivor', 'Fewer than 5 deaths with 20+ pairs', pairs >= 20 && dead < 5],
    ['Graveyard keeper', '10 fallen pairs', dead >= 10],
    ['Champions', 'Run beaten', run.status === 'won'],
  ]
  return (
    <ul className="badges">
      {list.map(([name, how, got]) => (
        <li key={name} className={got ? 'got' : ''}>
          <span className="badge-icon" aria-hidden="true">{got ? '★' : '☆'}</span>
          <strong>{name}</strong>
          <span className="status small-print">{how}</span>
        </li>
      ))}
    </ul>
  )
}
