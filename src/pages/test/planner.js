// Team planner maths. A "pair" is one area's linked catch:
//   { area, primaries: ['fire', 'water'], mons: [{ types: ['fire'], bst: 534, stats?, item?, itemPinned?, nature?, moves? }, ...] }
// stats = base stats; nature and held item are applied here. moves = [{ type, power }].
// chart[attacker][defender] = multiplier (missing = 1).
import { withBuild } from './items.js'

export const TEAM_SLOTS = 6
const statsOf = (m) => withBuild(m.stats, m)
// Attacking types: the damaging moves it knows, or its own types while no moves are filled in.
const attackTypes = (m) => {
  const hits = (m.moves ?? []).filter((x) => x.power).map((x) => x.type)
  return hits.length ? hits : m.types
}

/** Soul Link rule: a primary type may appear in only one pair on the team. */
export function fits(team, pair) {
  const used = new Set(team.flatMap((p) => p.primaries))
  return !pair.primaries.some((t) => used.has(t))
}
export const isValid = (team) => team.every((p, i) => fits(team.slice(0, i), p))

const multiplier = (chart, attacker, types) => types.reduce((m, d) => m * (chart[attacker]?.[d] ?? 1), 1)

/**
 * How good a team is: average base stat total, attack coverage (types its damaging moves hit 2×,
 * own types for Pokémon without moves), defensive coverage (attacking types someone on the team
 * resists, from its own typing) and weak spots (types more of the team is weak to than resists).
 */
export function scoreTeam(team, chart) {
  const mons = team.flatMap((p) => p.mons)
  if (mons.length === 0) return { score: 0, bst: 0, coverage: 0, resisted: 0, weakSpots: [] }
  const types = Object.keys(chart)
  const total = (m) => (m.stats ? statsOf(m).bst : m.bst)
  const withBst = mons.filter(total)
  const bst = withBst.length ? withBst.reduce((s, m) => s + total(m), 0) / withBst.length : 0
  const own = new Set(mons.flatMap(attackTypes))
  const coverage = types.filter((d) => [...own].some((t) => (chart[t]?.[d] ?? 1) >= 2)).length
  const resisted = types.filter((t) => mons.some((m) => multiplier(chart, t, m.types) < 1)).length
  const weakSpots = types.map((t) => {
    const ms = mons.map((m) => multiplier(chart, t, m.types))
    return { type: t, weak: ms.filter((x) => x > 1).length, resist: ms.filter((x) => x < 1).length }
  }).map((w) => ({ ...w, net: w.weak - w.resist })).filter((w) => w.net >= 2).sort((a, b) => b.net - a.net)
  const penalty = weakSpots.reduce((s, w) => s + (w.net - 1), 0)
  return { score: bst / 10 + coverage * 3 + resisted * 2 - penalty * 4, bst: Math.round(bst), coverage, resisted, weakSpots }
}

/** Fill the free slots at random with pairs that keep the rules. */
export function randomTeam(pool, pinned, rand = Math.random, size = TEAM_SLOTS) {
  const team = [...pinned]
  const rest = pool.filter((p) => !team.includes(p)).map((p) => [rand(), p]).sort((a, b) => a[0] - b[0]).map(([, p]) => p)
  for (const p of rest) if (team.length < size && fits(team, p)) team.push(p)
  return team
}

const avg = (team, f) => {
  const mons = team.flatMap((p) => p.mons).filter((m) => m.stats)
  return mons.length ? mons.reduce((s, m) => s + f(statsOf(m)), 0) / mons.length : 0
}

/**
 * Hand out the items that aren't pinned, so they help this team most for the strategy:
 * every unpinned item from all living Pokémon goes, greedily, to the team member it helps most.
 * Returns the team with items set, and the swaps ({ item, from, to } as mon objects from the pool).
 */
export function suggestItems(team, pool, chart, strategy) {
  const score = (t) => STRATEGIES[strategy].score(t, chart)
  const bag = pool.flatMap((p) => p.mons.filter((m) => m.item && !m.itemPinned).map((m) => ({ item: m.item, from: m })))
  let t = team.map((p) => ({ ...p, mons: p.mons.map((m) => (m.itemPinned ? m : { ...m, item: null, original: m })) }))
  const swaps = []
  for (const b of bag) {
    let best = null
    t.forEach((p, i) => p.mons.forEach((m, j) => {
      if (m.item) return
      const next = t.map((q, x) => (x !== i ? q : { ...q, mons: q.mons.map((n, y) => (y === j ? { ...n, item: b.item } : n)) }))
      const s = score(next)
      if (!best || s > best.s) best = { s, next, to: m.original ?? m }
    }))
    if (!best) break
    t = best.next
    if (best.to !== b.from) swaps.push({ item: b.item, from: b.from, to: best.to })
  }
  return { team: t, swaps }
}

/**
 * Ways to call a team "best". Each one leans on one thing, with the balanced score as tie-breaker,
 * so "fastest" still avoids a team of six glass cannons weak to the same type.
 * Mons may carry stats: { hp, attack, defense, 'special-attack', 'special-defense', speed, bst, legendary }.
 */
export const STRATEGIES = {
  balanced: { label: 'Balanced', score: (t, c) => scoreTeam(t, c).score },
  safe: { label: 'Fewest weaknesses', score: (t, c) => { const s = scoreTeam(t, c); return -s.weakSpots.reduce((n, w) => n + w.net, 0) * 20 + s.score / 10 } },
  strong: { label: 'Highest base stats', score: (t, c) => scoreTeam(t, c).bst + scoreTeam(t, c).score / 100 },
  legends: { label: 'Legendaries', score: (t, c) => t.flatMap((p) => p.mons).filter((m) => m.stats?.legendary).length * 100 + scoreTeam(t, c).score },
  range: { label: 'Best attack coverage', score: (t, c) => scoreTeam(t, c).coverage * 20 + scoreTeam(t, c).score / 10 },
  walls: { label: 'Best defensive coverage', score: (t, c) => scoreTeam(t, c).resisted * 20 + scoreTeam(t, c).score / 10 },
  tank: { label: 'Super tanky', score: (t, c) => avg(t, (s) => s.hp + s.defense + s['special-defense']) + scoreTeam(t, c).score / 10 },
  fast: { label: 'Super fast', score: (t, c) => avg(t, (s) => s.speed) + scoreTeam(t, c).score / 10 },
  hitter: { label: 'Hardest hitters', score: (t, c) => avg(t, (s) => Math.max(s.attack, s['special-attack'])) + scoreTeam(t, c).score / 10 },
}

/** Best team found: greedy fill, then swap pairs while the score improves. Pinned pairs stay. */
export function bestTeam(pool, pinned, chart, size = TEAM_SLOTS, score = (t) => scoreTeam(t, chart).score) {
  const team = [...pinned]
  while (team.length < size) {
    const options = pool.filter((p) => !team.includes(p) && fits(team, p))
    if (options.length === 0) break
    team.push(options.reduce((best, p) => (score([...team, p]) > score([...team, best]) ? p : best)))
  }
  return improve(team, pool, pinned.length, score)
}

/**
 * The top few different teams for a strategy, best first: the greedy pick plus
 * hill-climbs from random starts. Gives real alternatives to flip through.
 */
export function topTeams(pool, pinned, chart, strategy, n = 5, rand = Math.random, size = TEAM_SLOTS) {
  const score = (t) => STRATEGIES[strategy].score(t, chart)
  const found = new Map()
  const add = (t) => found.set(t.map((p) => p.area).sort().join('|'), t)
  add(bestTeam(pool, pinned, chart, size, score))
  for (let i = 0; i < 30; i++) add(improve(randomTeam(pool, pinned, rand, size), pool, pinned.length, score))
  return [...found.values()].sort((a, b) => score(b) - score(a)).slice(0, n)
}

function improve(start, pool, keep, score) {
  const team = [...start]
  for (let round = 0, improved = true; improved && round < 50; round++) {
    improved = false
    for (let i = keep; i < team.length; i++) {
      for (const p of pool) {
        if (team.includes(p)) continue
        const next = team.map((x, j) => (j === i ? p : x))
        if (isValid(next) && score(next) > score(team) + 1e-9) { team[i] = p; improved = true }
      }
    }
  }
  return team
}
