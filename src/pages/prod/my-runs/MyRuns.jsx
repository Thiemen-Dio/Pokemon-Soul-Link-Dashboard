// My runs: /my-runs = the current run, a new run and every run; /my-runs/:name = one run.
// RunsOverview (news, history, all runs side by side, Hall of Fame) is shown on the Home page.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { chartForGeneration, defensiveMatchups, displayName, getTypeData, spriteUrl, TYPE_COLORS } from '../../../api/pokeapi.js'
import { getEvolutionFamilies, getGames, getLearnset, getMoves, getTypeRoster, rosterTypesInGeneration } from '../../../api/pokeapiGraphql.js'
import { getEncounters, getRuns, saveEncounter, subscribeToRun } from '../../../api/soullink.js'
import { gameLabel } from '../../../api/games.js'
import TypeBadge from './TypeBadge.jsx'
import { Run } from './RunLog.jsx'
import { PLAYERS, TEAM_SIZE, areaRows, primaryType, teamClash } from '../../../soullink/rules.js'
import { GIFTS, LEVEL_CAPS, catches, getAreaEncounters, getNextEvolutions, locationSlug, logAreas, logEncounters, logSetsFor, parseRandomizerLog, teamPrimaryTypes, timeAgo, versionOf } from './data.js'
import { STARTERS } from '../../../components/starters.js'
import Medals, { overallAchievements, runAchievements } from './Achievements.jsx'
import NewRunButton from './RunSetup.jsx'
import TeamPlanner from './TeamPlanner.jsx'
import MonCard from './MonCard.jsx'
import './my-runs.css'

const RUN_STATE = { active: 'In progress', won: 'Beaten', lost: 'Lost' }
const runLink = (r) => `/my-runs/${encodeURIComponent(r.name)}`

/** Pokémon data every page needs: roster (names, Gen types) and evolution families. */
function usePokemonData() {
  const [data, setData] = useState({ roster: [], families: {}, error: '' })
  useEffect(() => {
    Promise.all([getTypeRoster(), getEvolutionFamilies()])
      .then(([roster, families]) => setData({ roster, families, error: '' }))
      .catch(() => setData((d) => ({ ...d, error: 'Couldn’t load Pokémon data from PokeAPI.' })))
  }, [])
  const rosterById = useMemo(() => Object.fromEntries(data.roster.map((e) => [e.id, e])), [data.roster])
  return { ...data, rosterById }
}

/** Every run and its areas: { runs, byRun (encounters per run, same order), error }. */
function useAllRuns() {
  const [state, setState] = useState({ runs: null, byRun: null, error: '' })
  useEffect(() => {
    getRuns()
      .then(async (runs) => setState({ runs, byRun: await Promise.all(runs.map((r) => getEncounters(r.id))), error: '' }))
      .catch((e) => setState((s) => ({ ...s, error: e.message })))
  }, [])
  return state
}

// ================= My runs =================

export default function MyRuns() {
  const { runs, byRun, error } = useAllRuns()
  if (error) return <p className="status error">{error}</p>
  if (!runs || !byRun) return <p className="status">Loading runs…</p>
  const active = runs.find((r) => r.status === 'active') ?? runs.at(-1)
  const activeIndex = runs.indexOf(active)

  return (
    <section className="dash-page">
      <div className="page-head">
        <h2>My runs</h2>
        <NewRunButton />
      </div>
      {active && <HomeHero run={active} encounters={byRun[activeIndex]} />}

      <h3 className="category-title">Your runs</h3>
      <ul className="run-cards">
        {runs.map((r, i) => {
          const rows = areaRows(r.base_game, byRun[i])
          return (
            <li key={r.id}>
              <Link to={runLink(r)} className="run-card">
                <span className={`run-state ${r.status}`}>{RUN_STATE[r.status]}</span>
                <strong>{r.name}</strong>
                <span className="status small-print">{gameLabel(r.base_game)}{r.randomized ? ' · Randomized' : ''} · {r.player1_name} & {r.player2_name}</span>
                <span className="run-card-team">
                  {rows.filter((x) => x.status === 'team').map((x) => <Mon key={x.area} id={x.p1_pokemon_id} size={32} />)}
                </span>
                <Timeline rows={rows} small />
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** Home page: every run in progress, last updated first, one at a time with ‹ › to step through. */
export function CurrentRuns() {
  const { runs, byRun, error } = useAllRuns()
  const [at, setAt] = useState(0)
  if (error) return <p className="status error">{error}</p>
  if (!runs || !byRun) return <p className="status">Loading runs…</p>
  const lastUpdate = (r, i) => [r.updated_at ?? r.created_at, ...byRun[i].map((e) => e.updated_at)].filter(Boolean).sort().at(-1) ?? ''
  const live = runs.map((r, i) => ({ run: r, encounters: byRun[i], last: lastUpdate(r, i) }))
    .filter((x) => x.run.status === 'active')
    .sort((a, b) => b.last.localeCompare(a.last))
  if (live.length === 0) return <p className="status">No run in progress. Start one under <Link to="/my-runs">My runs</Link>.</p>
  const i = Math.min(at, live.length - 1)
  return (
    <div className="current-runs">
      <HomeHero run={live[i].run} encounters={live[i].encounters} />
      {live.length > 1 && (
        <div className="slide-nav" aria-label="Runs in progress">
          {live.map((x, n) => (
            <button key={x.run.id} type="button" className={n === i ? 'on' : ''} onClick={() => setAt(n)}
              aria-label={x.run.name} aria-current={n === i} title={`${x.run.name} · updated ${timeAgo(x.last)}`} />
          ))}
        </div>
      )}
    </div>
  )
}

// ================= Overview of all runs (on the Home page) =================

export function RunsOverview() {
  const { rosterById, families, error: dataError } = usePokemonData()
  const { runs, byRun, error } = useAllRuns()
  const lastVisit = useLastVisit('home')
  if (error) return <p className="status error">{error}</p>
  if (!runs || !byRun) return <p className="status">Loading runs…</p>
  const news = runs.flatMap((r, i) => byRun[i].filter((e) => e.p1_pokemon_id || e.p2_pokemon_id).map((e) => ({ ...e, run: r })))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 8)

  return (
    <section className="dash-page">
      {dataError && <p className="status error">{dataError}</p>}
      <div className="home-grid">
        <div>
          <h3 className="category-title">Latest news</h3>
          {news.length === 0 ? <p className="status">No catches yet. News shows up as soon as someone catches something.</p> : (
            <ul className="news">
              {news.map((e) => (
                <li key={e.id} className={lastVisit && e.updated_at > lastVisit ? 'is-new' : ''}>
                  <span className="news-mons"><Mon id={e.p1_pokemon_id} size={40} /><Mon id={e.p2_pokemon_id} size={40} /></span>
                  <span>
                    <strong>{e.area}</strong>: {PLAYERS.map((p) => e[`${p}_nickname`] || monName(e[`${p}_pokemon_id`], rosterById)).join(' & ')} {NEWS_VERB[e.status]}
                    <span className="status small-print"> · {e.run.name}</span>
                  </span>
                  <span className="status small-print">{timeAgo(e.updated_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="category-title">Go to</h3>
          <div className="doors">
            <Link to="/pokedex" className="door"><strong>Pokédex</strong><span>Look up any Pokémon</span></Link>
            <Link to="/pokedex/types" className="door"><strong>Type chart</strong><span>Gen-correct matchups</span></Link>
            <Link to="/pokedex/moves" className="door"><strong>Moves</strong><span>Who learns what</span></Link>
            <Link to="/my-runs" className="door"><strong>My runs</strong><span>The current run and every run</span></Link>
          </div>
        </div>
      </div>

      <Card id="history" title="In which runs did we use…?" idea="Search any Pokémon: every run and area its evolution line was caught in, and how it ended.">
        <History runs={runs} byRun={byRun} rosterById={rosterById} families={families} />
      </Card>
      <Card id="stats" title="All runs side by side" idea="Catches, deaths, survival rate and favourite type per run.">
        <AllRunStats runs={runs} byRun={byRun} rosterById={rosterById} />
      </Card>
      <Card id="hall" title="Hall of Fame" idea="Achievements over every run you’ve ever played.">
        <Medals list={overallAchievements(runs, byRun, rosterById, families)} />
      </Card>
    </section>
  )
}

const NEWS_VERB = { team: 'joined the team', box: 'went to the PC', dead: 'fell', failed: 'failed', pending: 'got a first catch' }

/** When this browser last opened a page (per viewer, so no database needed). */
function useLastVisit(id) {
  const key = `dash-last-visit-${id}`
  const [last] = useState(() => {
    try { return localStorage.getItem(key) } catch { return null }
  })
  useEffect(() => {
    try { localStorage.setItem(key, new Date().toISOString()) } catch { /* not remembered */ }
  }, [key])
  return last
}

function HomeHero({ run, encounters }) {
  const rows = areaRows(run.base_game, encounters)
  const used = rows.filter((r) => r.status !== 'pending').length
  const team = rows.filter((r) => r.status === 'team')
  const next = rows.find((r) => r.status === 'pending')
  const boss = LEVEL_CAPS[run.base_game]?.[readBeaten(run.id)]
  return (
    <Link to={runLink(run)} className="home-hero">
      <div>
        <span className="status small-print">{run.status === 'active' ? 'Playing now' : RUN_STATE[run.status]} · {gameLabel(run.base_game)}</span>
        <strong className="hero-name">{run.name}</strong>
        <div className="hero-progress" style={{ '--p': rows.length ? used / rows.length : 0 }} title={`${used} of ${rows.length} areas`} />
        <span className="status small-print">{used} of {rows.length} areas · next: {next?.area ?? 'none left'}{boss ? ` · next boss ${boss[0]} (cap ${boss[2]})` : ''}</span>
      </div>
      <div className="hero-team">
        {team.length === 0 && <span className="status small-print">No team yet</span>}
        {team.map((r) => (
          <span key={r.area} className="overlay-pair" title={r.area}>
            <Mon id={r.p1_pokemon_id} size={48} /><span className="overlay-link" /><Mon id={r.p2_pokemon_id} size={48} />
          </span>
        ))}
      </div>
    </Link>
  )
}

// ================= One run =================

// Jump menu, grouped like the categories on the page.
const SECTIONS = [
  ['Now', [['planner', 'Team planner'], ['log', 'Run log'], ['box', 'PC box']]],
  ['Team', [['caps', 'Level caps'], ['prep', 'Boss prep'], ['coverage', 'Weaknesses'], ['evo', 'Evolutions']]],
  ['Story', [['graveyard', 'Graveyard'], ['dex', 'Run Pokédex'], ['players', 'Favourite types'], ['badges', 'Achievements'], ['timeline', 'Timeline']]],
  ['Scouting', [['randolog', 'Randomizer log'], ['route', 'Route finder'], ['areas', 'Area planner']]],
  ['Share', [['overlay', 'Overlay'], ['share', 'Summary']]],
]

export function RunPage() {
  const { runName } = useParams()
  const { roster, rosterById, families, error: dataError } = usePokemonData()
  const [runs, setRuns] = useState(null)
  const [encounters, setEncounters] = useState(null)
  const [error, setError] = useState('')
  const loadRuns = useCallback(() => getRuns().then(setRuns), [])
  useEffect(() => { loadRuns().catch((e) => setError(e.message)) }, [loadRuns])
  const run = runs?.find((r) => r.name.toLowerCase() === runName.toLowerCase())

  // This run's areas, reloaded whenever either player changes something.
  const runId = run?.id
  useEffect(() => {
    if (!runId) return
    setEncounters(null)
    const load = () => getEncounters(runId).then(setEncounters).catch((e) => setError(e.message))
    load()
    return subscribeToRun(runId, () => { load(); loadRuns().catch(() => {}) })
  }, [runId, loadRuns])

  if (error) return <p className="status error">{error}</p>
  if (!runs) return <p className="status">Loading…</p>
  if (!run) return <p className="status">No run called “{runName}”. <Link to="/my-runs">All runs</Link></p>
  return (
    <section className="dash-page">
      <Link to="/my-runs" className="new-run-button back-run"><span className="new-run-plus" aria-hidden="true">←</span><strong>My runs</strong></Link>
      <nav className="dash-jump" aria-label="Sections">
        {SECTIONS.map(([group, items]) => (
          <div key={group} className="jump-group">
            <span className="jump-label">{group}</span>
            {items.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}
          </div>
        ))}
      </nav>
      {(dataError) && <p className="status error">{dataError}</p>}
      {!encounters ? <p className="status">Loading {run.name}…</p> : (
        <RunLab
          key={run.id}
          run={run}
          encounters={encounters}
          setEncounters={setEncounters}
          roster={roster}
          rosterById={rosterById}
          families={families}
          onError={setError}
          onRunChange={(r) => setRuns((list) => list.map((x) => (x.id === r.id ? r : x)))}
        />
      )}
    </section>
  )
}

// Bosses beaten, per run in this browser. shortcut: not shared between players, store on the run when it matters.
const readBeaten = (runId) => { try { return Number(localStorage.getItem(`dash-beaten-${runId}`) ?? localStorage.getItem(`test-beaten-${runId}`)) || 0 } catch { return 0 } }

function RunLab({ run, encounters, setEncounters, roster, rosterById, families, onError, onRunChange }) {
  const gen = run.generation
  const names = { p1: run.player1_name, p2: run.player2_name }
  const chart = useChart(gen)
  const [beaten, setBeatenState] = useState(() => readBeaten(run.id))
  const setBeaten = (n) => { setBeatenState(n); try { localStorage.setItem(`dash-beaten-${run.id}`, String(n)) } catch { /* not remembered */ } }
  // Uploaded randomizer log, per run in this browser. shortcut: not shared with the other player, move to the run row when it matters.
  const logKey = `dash-randolog-${run.id}`
  const [log, setLogState] = useState(() => { try { return JSON.parse(localStorage.getItem(logKey) ?? localStorage.getItem(`test-randolog-${run.id}`)) } catch { return null } })
  const setLog = (l) => {
    setLogState(l)
    try { if (l) localStorage.setItem(logKey, JSON.stringify(l)); else localStorage.removeItem(logKey) } catch { /* kept until reload */ }
  }
  // Games without a built-in area list (e.g. Ultra Sun / Ultra Moon) take their areas from the log.
  const areasFromLog = useMemo(() => (log ? logAreas(log.sets) : []), [log])
  const rows = areaRows(run.base_game, encounters, areasFromLog)
  const team = rows.filter((r) => r.status === 'team')
  const props = { run, gen, names, rows, team, encounters, roster, rosterById, families, chart, log }

  // Save fields on one area (favourite, a Pokémon's build, an evolution) and show it straight away.
  async function saveRow(r, changes) {
    // Hard lock: if an evolution makes a team pair share a primary type, it goes to the PC.
    const clash = teamClash(encounters, { ...r, ...changes }, rosterById, gen)
    if (clash) changes = { ...changes, status: 'box' }
    try {
      const saved = await saveEncounter(run.id, r.area, r.sort_order, changes)
      setEncounters((list) => [...list.filter((e) => e.area !== saved.area), saved])
      onError(clash ? `${r.area} went to the PC: it now shares ${clash.type} with ${clash.area} on the team.` : '')
    } catch (e) {
      onError(`Couldn’t save ${r.area}: ${e.message}`)
    }
  }
  const toggleFavorite = (r) => saveRow(r, { favorite: !r.favorite })

  return (
    <>
      <Category id="cat-now" title={run.name} note={`${gameLabel(run.base_game)} · Gen ${gen} types${run.randomized ? ' · Randomized' : ''} · ${names.p1} & ${names.p2}`}>
        <NextUp {...props} beaten={beaten} />
        <Card id="planner" title="Team planner" idea="Both sixes side by side. Click a slot to add a pair, pin the ones you want to keep, then pick what matters and flip through the options.">
          <TeamPlanner {...props} onSave={saveRow} />
        </Card>
        <details id="log" className="dash-card fold" open>
          <summary><h3>Run log</h3><span className="status small-print">Only the next area is open, with what can appear there. Click any other area to open it.</span></summary>
          <div className="soullink">
            <Run
              run={run} encounters={encounters} setEncounters={setEncounters} roster={roster} families={families} onError={onError} onRunChange={onRunChange}
              compact logAreas={areasFromLog}
              renderNext={(row, save) => <NextEncounters {...props} row={row} save={save} />}
            />
          </div>
        </details>
        <Card id="box" title="PC box" idea="Every caught pair as linked sprites. Click a Pokémon for both partners’ cards: stats, moves, item, evolving.">
          <PcBox {...props} onSave={saveRow} />
        </Card>
      </Category>

      <Category id="cat-team" title="Team" note="Getting ready for the next boss.">
        <Card id="caps" title="Level caps" idea="The bosses in order, with their ace’s level as the cap and how many of your team are weak to them. Vanilla numbers: hacks need their own list.">
          <LevelCaps {...props} beaten={beaten} setBeaten={setBeaten} />
        </Card>
        <Card id="prep" title="Boss prep" idea="For a chosen boss: the best super-effective moves each team member learns by level-up before the cap.">
          <BossPrep {...props} />
        </Card>
        <Card id="coverage" title="Team weaknesses & coverage" idea="How many of your team are weak to each attacking type, and which types your team’s own types hit hard.">
          <Coverage {...props} />
        </Card>
        <Card id="evo" title="Evolution watch" idea="What your living Pokémon evolve into next and how, limited to evolutions that exist in the run’s generation.">
          <EvolutionWatch {...props} />
        </Card>
      </Category>

      <Category id="cat-story" title="Story" note="What happened in this run.">
        <Card id="graveyard" title="Graveyard" idea="A memorial for fallen pairs. Star the ones you’ll never forget.">
          <Graveyard {...props} onFavorite={toggleFavorite} />
        </Card>
        <Card id="dex" title="Run Pokédex" idea="This generation’s new Pokémon: coloured if caught in this run, a silhouette if not.">
          <RunDex {...props} />
        </Card>
        <Card id="players" title="Favourite types" idea={`What ${names.p1} and ${names.p2} like to catch.`}>
          <Players {...props} />
        </Card>
        <Card id="badges" title="Achievements" idea="Milestones in this run. The ones over all runs are on the home page.">
          <Medals list={runAchievements(run, rows, rosterById)} />
        </Card>
        <Card id="timeline" title="Run timeline" idea="Every area as a dot in game order, coloured by what happened there.">
          <Timeline rows={rows} />
        </Card>
      </Category>

      <Category id="cat-scout" title="Scouting" note="Folded away for now: open when you need them.">
        <Card id="randolog" title="Randomizer log" idea="Upload the .log file from Universal Pokémon Randomizer ZX: the run log and route finder then show what each route really holds." folded={!run.randomized}>
          <RandomizerLog {...props} setLog={setLog} />
        </Card>
        <Card id="route" title="Route finder" idea="What can appear on an area in this game, with dupe chance, dupes and type clashes marked." folded>
          <RouteFinder {...props} />
        </Card>
        <Card id="areas" title="Area planner" idea="Every area you haven’t done yet, ranked by how many evolution lines there are still new to you." folded>
          <AreaPlanner {...props} />
        </Card>
      </Category>

      <Category id="cat-share" title="Share & stream" note="For Discord, chat and OBS.">
        <Card id="overlay" title="Stream overlay" idea="A strip of linked pairs for OBS, at /overlay?run=Name (see-through, updates live)." folded>
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
    <section id={id} className="dash-category">
      <h3 className="category-title">{title}</h3>
      <p className="status small-print">{note}</p>
      {children}
    </section>
  )
}

/** A prototype card. folded = minimised until opened, and its contents only load then. */
function Card({ id, title, idea, folded, children }) {
  const [open, setOpen] = useState(!folded)
  if (folded) {
    return (
      <details id={id} className="dash-card fold" onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary><h3>{title}</h3><span className="status small-print">{idea}</span></summary>
        {open && children}
      </details>
    )
  }
  return (
    <article id={id} className="dash-card">
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

// ---- Next up ----

function NextUp({ rows, run, team, chart, rosterById, gen, beaten }) {
  const next = rows.find((r) => r.status === 'pending')
  const caps = LEVEL_CAPS[run.base_game]
  const boss = caps?.[beaten]
  const mons = teamMons(team, rosterById)
  const weak = boss && chart && mons.length ? matchupCounts(chart, mons, gen, boss[1]).weak : null
  return (
    <div className="next-up">
      <div className="next-tile"><span className="status small-print">Next area</span><strong>{next?.area ?? 'All done'}</strong></div>
      <div className="next-tile boss" style={{ '--type-color': boss ? TYPE_COLORS[boss[1]] : undefined }}>
        <span className="status small-print">Next boss</span>
        <strong>{boss ? boss[0] : caps ? 'All bosses beaten' : 'No list for this game'}</strong>
        {boss && <span className="small-print">{displayName(boss[1])} · cap Lv {boss[2]}{weak !== null && ` · ${weak}/${mons.length} of your team weak`}</span>}
      </div>
      <div className="next-tile"><span className="status small-print">Team</span><strong>{team.length}/{TEAM_SIZE} pairs</strong></div>
    </div>
  )
}

// ---- Graveyard ----

function Graveyard({ rows, rosterById, names, onFavorite }) {
  // Favourites first, then in game order.
  const dead = rows.filter((r) => r.status === 'dead').sort((a, b) => (b.favorite === true) - (a.favorite === true))
  if (dead.length === 0) return <p className="status">Nobody has fallen yet. Long may it last.</p>
  return (
    <ul className="graves">
      {dead.map((r) => (
        <li key={r.area} className={r.favorite ? 'favorite' : ''}>
          <button type="button" className="grave-star" aria-pressed={!!r.favorite} onClick={() => onFavorite(r)} title={r.favorite ? 'Remove from favourites' : 'Favourite: never forget'}>
            {r.favorite ? '★' : '☆'}
          </button>
          <span className="grave-mons"><Mon id={r.p1_pokemon_id} /><Mon id={r.p2_pokemon_id} /></span>
          <strong>{PLAYERS.map((p) => r[`${p}_nickname`] || monName(r[`${p}_pokemon_id`], rosterById)).join(' & ')}</strong>
          <span className="status small-print">Caught on {r.area}</span>
          {r.died_at && <span className="small-print grave-how">{r.died_at}</span>}
          <span className="status small-print">{names.p1} & {names.p2}</span>
        </li>
      ))}
    </ul>
  )
}

// ---- Route finder ----

/**
 * What can appear on an area: from the uploaded randomizer log if it covers the area (source 'log'),
 * else the normal game's tables from PokeAPI (source 'game').
 */
function useAreaMons(run, area, roster, log) {
  const gen = run.generation
  const location = area ? locationSlug(area, gen) : null
  const version = versionOf(run.base_game)
  const fromLog = useMemo(() => (log && area ? logEncounters(area, log.sets, roster) : []), [log, area, roster])
  const [state, setState] = useState({ status: 'idle', mons: [] })
  useEffect(() => {
    if (!location) return
    if (fromLog.length) return setState({ status: 'ready', mons: fromLog, source: 'log' })
    // PokeAPI has no "starter" location: offer the generation's three starters instead.
    if (location === 'starter') return setState({ status: 'ready', source: 'game', mons: (STARTERS[gen] ?? []).map((id) => ({ id, dex: id, min: 5, max: 5, methods: { gift: 100 } })) })
    if (GIFTS[area]) {
      const [id, level] = GIFTS[area]
      return setState({ status: 'ready', source: 'game', mons: [{ id, dex: id, min: level, max: level, methods: { gift: 100 } }] })
    }
    let live = true
    setState({ status: 'loading', mons: [] })
    getAreaEncounters(location, version)
      .then((mons) => live && setState({ status: 'ready', mons, source: 'game' }))
      .catch((e) => live && setState({ status: 'error', mons: [], message: e.message }))
    return () => { live = false }
  }, [location, version, gen, area, fromLog])
  return { ...state, location, version }
}

/** "Lv 3–5 · Grass 40%" or, from a randomizer log, "Lv 3–5 · Grass/Cave". */
const encounterInfo = (m) => [
  m.min ? `Lv ${m.min === m.max ? m.min : `${m.min}–${m.max}`}` : null,
  m.where ?? (Object.entries(m.methods ?? {}).map(([k, v]) => `${displayName(k)} ${v}%`).join(', ') || null),
].filter(Boolean).join(' · ')

function RouteFinder({ run, gen, rows, encounters, roster, rosterById, families, names, log }) {
  const [area, setArea] = useState(rows.find((r) => r.status === 'pending' && r.area !== 'Starter')?.area ?? rows[0]?.area)
  const state = useAreaMons(run, area, roster, log)
  const { location, version } = state

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
      {run.randomized && state.source !== 'log' && <p className="rule-warning">This run is randomized, so the game’s normal encounter tables don’t apply. Upload the randomizer log above to see the real ones.</p>}
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
        <span className="status small-print">{state.source === 'log' ? `From ${log.file}` : `PokeAPI location “${location}” in ${displayName(version)}`}</span>
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
                <span className="status small-print">{encounterInfo(m)}</span>
                <span className="types">{types.map((t) => <TypeBadge key={t} type={t} small />)}</span>
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

// ---- Next encounter (inside the run log) ----

/** Under the open area: tap what you caught. Known routes list their Pokémon; randomized ones without a log get a search. */
function NextEncounters({ run, gen, row, save, roster, rosterById, families, encounters, names, log }) {
  const state = useAreaMons(run, row.area, roster, log)
  const known = !run.randomized || state.source === 'log'
  const [searching, setSearching] = useState(false)
  const [q, setQ] = useState('')
  const free = PLAYERS.filter((p) => !row[`${p}_pokemon_id`])
  if (free.length === 0) return null

  const search = !known || searching
  const text = q.trim().toLowerCase()
  const list = search
    ? roster.filter((e) => e.generation <= gen && (!text || e.label.toLowerCase().includes(text))).slice(0, 48)
    : state.mons
  const familyOf = (dex) => families[dex] ?? -dex
  const used = new Map(catches(encounters).map((c) => [familyOf(rosterById[c.id]?.dex ?? c.id), c]))

  return (
    <div className="next-encounters">
      <div className="toolbar">
        <strong>{search ? `Which Pokémon did you find on ${row.area}?` : `Can appear on ${row.area}`}</strong>
        {search && <input type="search" placeholder="Search a Pokémon" aria-label="Search a Pokémon" value={q} onChange={(e) => setQ(e.target.value)} />}
        {known && <button type="button" className="chip-button" onClick={() => setSearching((s) => !s)}>{searching ? 'Back to the route list' : 'Not listed? Search all'}</button>}
      </div>
      {!known && <p className="status small-print">Randomized run: search what you found. Upload the randomizer log (Scouting) to see each route’s real Pokémon here.</p>}
      {!search && state.source === 'log' && <p className="status small-print">From your randomizer log.</p>}
      {!search && state.status === 'loading' && <p className="status">Loading encounters…</p>}
      {!search && state.status === 'error' && <p className="status error">{state.message}</p>}
      {!search && state.status === 'ready' && list.length === 0 && <p className="status">No list for this area. Use “Search all”.</p>}
      <ul className="route-mons next-pick">
        {list.map((m) => {
          const entry = rosterById[m.id]
          const dupe = used.get(familyOf(entry?.dex ?? m.dex ?? m.id))
          return (
            <li key={m.id} className={dupe ? 'route-mon is-dupe' : 'route-mon'}>
              <Mon id={m.id} size={56} />
              <div>
                <strong>{entry?.label ?? (m.name ? displayName(m.name) : `#${m.id}`)}</strong>
                {!search && <span className="status small-print">{encounterInfo(m)}</span>}
                <span className="types">{entry && rosterTypesInGeneration(entry, gen).map((t) => <TypeBadge key={t} type={t} small />)}</span>
                {dupe && <span className="slot-warning">Dupe: {names[dupe.player]} has this line ({dupe.area})</span>}
              </div>
              <div className="pick-buttons">
                {free.map((p) => (
                  <button key={p} type="button" className="chip-button" onClick={() => save({ [`${p}_pokemon_id`]: m.id })} title={`${names[p]} caught this on ${row.area}`}>
                    {names[p]}
                  </button>
                ))}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ---- Randomizer log ----

function RandomizerLog({ log, setLog, rows }) {
  const [error, setError] = useState('')
  async function load(file) {
    const sets = parseRandomizerLog(await file.text())
    if (sets.length === 0) return setError('No “--Wild Pokemon--” section in this file. Is it a Universal Pokémon Randomizer ZX log, with wild Pokémon randomized?')
    setError('')
    setLog({ file: file.name, sets })
  }
  const missing = log ? rows.filter((r) => logSetsFor(r.area, log.sets).length === 0).map((r) => r.area) : []
  return (
    <>
      <div className="toolbar">
        <input type="file" accept=".log,.txt" aria-label="Randomizer log file" onChange={(e) => e.target.files[0] && load(e.target.files[0])} />
        {log && <button type="button" className="chip-button" onClick={() => setLog(null)}>Remove log</button>}
      </div>
      {error && <p className="status error">{error}</p>}
      {log && (
        <p className="status">
          {log.file}: {log.sets.length} encounter sets, {rows.length - missing.length} of {rows.length} areas matched.
          {missing.length > 0 && <span className="small-print"> No match (gifts, starters or different names): {missing.join(', ')}.</span>}
        </p>
      )}
      <p className="status small-print">The file stays in this browser: nothing is uploaded to the database, so the other player loads it on their own device.</p>
    </>
  )
}

// ---- PC box ----

const BOX_FILTERS = { all: ['All', null], alive: ['Alive', ['team', 'box']], team: ['Team', ['team']], box: ['PC', ['box']], dead: ['Dead', ['dead', 'failed']] }

/** Every caught pair as linked sprites, like a PC box. Click a pair for both Pokémon's cards. */
function PcBox({ run, rows, rosterById, names, chart, onSave }) {
  const [filter, setFilter] = useState('all')
  const [open, setOpen] = useState(null) // { area, player }
  const pairs = rows.filter((r) => (r.p1_pokemon_id || r.p2_pokemon_id) && (!BOX_FILTERS[filter][1] || BOX_FILTERS[filter][1].includes(r.status)))
  const sel = rows.find((r) => r.area === open?.area)
  const label = (r, p) => r[`${p}_nickname`] || rosterById[r[`${p}_pokemon_id`]]?.label || '—'
  return (
    <>
      <div className="tabs encounter-filter" role="group" aria-label="Show pairs">
        {Object.entries(BOX_FILTERS).map(([k, [text]]) => <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>{text}</button>)}
      </div>
      {pairs.length === 0 ? <p className="status">Nothing here yet.</p> : (
        <ul className="pc-box">
          {pairs.map((r) => (
            <li key={r.area} className={`s-${r.status}`}>
              <div className={open?.area === r.area ? 'pc-pair open' : 'pc-pair'}>
                {PLAYERS.map((p) => (
                  <button key={p} type="button" onClick={() => setOpen(open?.area === r.area && open.player === p ? null : { area: r.area, player: p })} title={`${label(r, p)} (${names[p]}) · ${r.area}`} aria-pressed={open?.area === r.area && open.player === p}>
                    {r[`${p}_pokemon_id`] ? <img className="pixel" src={spriteUrl(r[`${p}_pokemon_id`])} alt={label(r, p)} width="64" height="64" loading="lazy" /> : <span className="pc-empty">?</span>}
                  </button>
                ))}
              </div>
              <span className="small-print pc-area">{r.area}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="status small-print">Each tile is one linked pair ({names.p1} left, {names.p2} right). Green team, blue PC, red dead, grey failed.</p>
      {sel && (
        <div className="pair-cards">
          {(open.player === 'p1' ? PLAYERS : [...PLAYERS].reverse()).map((p) => (
            <MonCard key={p} run={run} chart={chart} row={sel} player={p} names={names} rosterById={rosterById} onSave={onSave} picked={p === open.player} />
          ))}
        </div>
      )}
    </>
  )
}

// ---- Level caps ----

function LevelCaps({ run, team, gen, rosterById, chart, beaten, setBeaten }) {
  const caps = LEVEL_CAPS[run.base_game]
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
              <button type="button" onClick={() => setBeaten(i + 1 === beaten ? i : i + 1)} title="Mark beaten">
                <span className="cap-level">{level}</span>
                <span className="cap-boss">{boss}</span>
                <span className="cap-type">{displayName(type)}</span>
                {weak !== null && <span className={weak >= mons.length / 2 ? 'cap-risk high' : 'cap-risk'}>{weak}/{mons.length} weak</span>}
              </button>
            </li>
          )
        })}
      </ol>
      <p className="status small-print">Click a boss to mark it and everything before it as beaten (remembered in this browser; Next up follows it). “Weak” counts team members hurt extra by the boss’s main type.</p>
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

function Coverage({ team, gen, rosterById, chart }) {
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
            <TypeBadge type={r.attacker} small />
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

function Timeline({ rows, small }) {
  const done = rows.filter((r) => r.status !== 'pending').length
  return (
    <>
      <div className="timeline" role="list">
        {rows.map((r) => <span key={r.area} role="listitem" className={`dot s-${r.status}`} title={`${r.area}: ${r.status}`} />)}
      </div>
      {!small && <p className="status small-print">{done} of {rows.length} areas used · green team, blue PC, red dead, grey failed, hollow not yet.</p>}
    </>
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

// ---- All-run stats ----

function AllRunStats({ runs, byRun, rosterById }) {
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
                <td>{topType ? <><TypeBadge type={topType} small /> <span className="status small-print">×{topN}</span></> : '—'}</td>
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
        return (
          <div key={p} className="player-col">
            <h4>{names[p]}</h4>
            <dl className="facts">
              <div><dt>Catches</dt><dd>{mine.length}</dd></div>
              <div><dt>Different primary types</dt><dd>{top.length}</dd></div>
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

// ---- Where did we use it? ----

const FATE = { team: 'on the team', box: 'in the PC', dead: 'died', failed: 'failed', pending: 'waiting for partner' }

function History({ runs, byRun, rosterById, families }) {
  const [text, setText] = useState('')
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

// ---- Boss prep ----

function BossPrep({ run, team, rosterById, names, chart }) {
  const caps = LEVEL_CAPS[run.base_game]
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
                    <span key={g.id}><TypeBadge type={g.type} small /> {displayName(g.name)} <em>{g.power} power · Lv {g.level || 'evo'}</em></span>
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

