// Achievements: per run, and across every run. Worked out from the data, nothing stored.
import { TEAM_SIZE, primaryType } from '../../soullink/rules.js'
import { catches } from './data.js'

// [name, how, tier, have, goal]: done when have >= goal.
export function runAchievements(run, rows, rosterById) {
  const used = rows.filter((r) => r.status !== 'pending').length
  const pairs = rows.filter((r) => r.p1_pokemon_id && r.p2_pokemon_id).length
  const dead = rows.filter((r) => r.status === 'dead').length
  const team = rows.filter((r) => r.status === 'team').length
  const types = new Set(catches(rows).map((c) => primaryType(rosterById[c.id], run.generation)).filter(Boolean)).size
  return [
    ['First pair', 'Both of you caught something on one area', 'bronze', pairs, 1],
    ['Full squad', `${TEAM_SIZE} pairs on the team`, 'bronze', team, TEAM_SIZE],
    ['Halfway there', 'Half of all areas used', 'silver', used, Math.ceil(rows.length / 2)],
    ['Type rainbow', '10 different primary types caught', 'silver', types, 10],
    ['Collector', '25 pairs caught', 'silver', pairs, 25],
    ['Untouchable', '15 pairs and nobody fell', 'gold', dead === 0 ? pairs : 0, 15],
    ['Survivor', '20+ pairs with fewer than 5 deaths', 'gold', dead < 5 ? pairs : 0, 20],
    ['Graveyard keeper', '10 fallen pairs', 'bronze', dead, 10],
    ['Champions', 'Run beaten', 'legend', run.status === 'won' ? 1 : 0, 1],
  ]
}

export function overallAchievements(runs, byRun, rosterById, families) {
  const all = runs.flatMap((r, i) => (byRun[i] ?? []).map((e) => ({ ...e, run: r })))
  const pairs = all.filter((e) => e.p1_pokemon_id && e.p2_pokemon_id).length
  const dead = all.filter((e) => e.status === 'dead').length
  const species = new Set(catches(all).map((c) => rosterById[c.id]?.dex ?? c.id)).size
  const won = runs.filter((r) => r.status === 'won').length
  const gens = new Set(runs.map((r) => r.generation)).size
  // Most-used evolution line: in how many different runs it was caught.
  const linesPerRun = {}
  runs.forEach((r, i) => {
    for (const f of new Set(catches(byRun[i] ?? []).map((c) => families[rosterById[c.id]?.dex] ?? c.id))) linesPerRun[f] = (linesPerRun[f] ?? 0) + 1
  })
  const favourite = Math.max(0, ...Object.values(linesPerRun))
  return [
    ['Here we go again', 'Start 3 runs', 'bronze', runs.length, 3],
    ['Generation tourists', 'Runs in 3 different generations', 'silver', gens, 3],
    ['Old favourite', 'Same evolution line caught in 3 runs', 'silver', favourite, 3],
    ['Century of souls', '100 pairs caught over all runs', 'gold', pairs, 100],
    ['Pokédex dreamers', '150 different species caught', 'gold', species, 150],
    ['Heartbreak hotel', '50 fallen pairs over all runs', 'bronze', dead, 50],
    ['Hall of Fame', 'Beat a run', 'gold', won, 1],
    ['Dynasty', 'Beat 3 runs', 'legend', won, 3],
  ]
}

const TIER_LABEL = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', legend: 'Legendary' }

export default function Medals({ list }) {
  const got = list.filter(([, , , have, goal]) => have >= goal).length
  return (
    <>
      <p className="medal-count"><strong>{got}</strong> of {list.length} unlocked</p>
      <ul className="medals">
        {list.map(([name, how, tier, have, goal]) => {
          const done = have >= goal
          return (
            <li key={name} className={`medal ${tier}${done ? ' got' : ''}`}>
              <span className="medal-coin" aria-hidden="true">{done ? '★' : '?'}</span>
              <strong>{name}</strong>
              <span className="medal-how">{how}</span>
              <span className="medal-tier">{TIER_LABEL[tier]}</span>
              {!done && goal > 1 && (
                <span className="medal-progress" style={{ '--p': Math.min(1, have / goal) }} title={`${have} of ${goal}`}>
                  <span className="sr-only">{have} of {goal}</span>
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}
