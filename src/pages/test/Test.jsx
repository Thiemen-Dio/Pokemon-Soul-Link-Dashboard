// Test playground: try new ideas here before they go to prod (src/pages/prod).
// Same database as prod: anything that saves here (a card's moves, item, evolving) changes the real runs.
// Now on the bench: the PC box (PcBox.jsx) with its Pokémon card (MonCard.jsx).
import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { chartForGeneration, getTypeData } from '../../api/pokeapi.js'
import { getTypeRoster } from '../../api/pokeapiGraphql.js'
import { getEncounters, getRuns, saveEncounter } from '../../api/soullink.js'
import { gameLabel } from '../../api/games.js'
import { areaRows, teamClash } from '../../soullink/rules.js'
import PcBox from './PcBox.jsx'
import './test.css'

export default function Test() {
  const [runs, setRuns] = useState(null)
  const [runId, setRunId] = useState(null)
  const [encounters, setEncounters] = useState(null)
  const [roster, setRoster] = useState([])
  const [chart, setChart] = useState(null)
  const [error, setError] = useState('')

  // Runs, newest first; start on the run in progress.
  useEffect(() => {
    getRuns().then((list) => {
      const sorted = [...list].reverse()
      setRuns(sorted)
      setRunId((sorted.find((r) => r.status === 'active') ?? sorted[0])?.id ?? null)
    }).catch((e) => setError(e.message))
    getTypeRoster().then(setRoster).catch(() => setError('Couldn’t load Pokémon data from PokeAPI.'))
  }, [])
  const run = runs?.find((r) => r.id === runId)
  const gen = run?.generation

  useEffect(() => {
    if (!runId) return
    setEncounters(null)
    getEncounters(runId).then(setEncounters).catch((e) => setError(e.message))
  }, [runId])
  useEffect(() => {
    if (gen) getTypeData().then((t) => setChart(chartForGeneration(t, gen))).catch(() => setChart({}))
  }, [gen])

  const rosterById = useMemo(() => Object.fromEntries(roster.map((e) => [e.id, e])), [roster])

  // Save fields on one area (a Pokémon's build, an evolution). Same team rule as prod: a type clash goes to the PC.
  async function saveRow(r, changes) {
    const clash = teamClash(encounters, { ...r, ...changes }, rosterById, gen)
    if (clash) changes = { ...changes, status: 'box' }
    try {
      const saved = await saveEncounter(run.id, r.area, r.sort_order, changes)
      setEncounters((list) => [...list.filter((e) => e.area !== saved.area), saved])
      setError(clash ? `${r.area} went to the PC: it now shares ${clash.type} with ${clash.area} on the team.` : '')
    } catch (e) {
      setError(`Couldn’t save ${r.area}: ${e.message}`)
    }
  }

  return (
    <section className="dash-page test-box">
      <div className="page-head">
        <h2>Test · PC box</h2>
        {runs && (
          <label className="run-status">
            Run
            <select value={runId ?? ''} onChange={(e) => setRunId(e.target.value)}>
              {runs.map((r) => <option key={r.id} value={r.id}>{r.name} · {gameLabel(r.base_game)}</option>)}
            </select>
          </label>
        )}
      </div>
      <p className="status small-print">A copy of the PC box to change freely. Saving here changes the real run.</p>
      {error && <p className="status error">{error}</p>}
      {!run || !encounters ? <p className="status">Loading…</p> : (
        <div className="dash-card">
          <PcBox run={run} rows={areaRows(run.base_game, encounters)} rosterById={rosterById}
            names={{ p1: run.player1_name, p2: run.player2_name }} chart={chart} onSave={saveRow} />
        </div>
      )}
    </section>
  )
}

/** Old /test/run/... links go back to the Test page. */
export function TestRun() {
  return <Navigate to="/test" replace />
}
