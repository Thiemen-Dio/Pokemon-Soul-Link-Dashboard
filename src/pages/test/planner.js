// Team planner maths. A "pair" is one area's linked catch:
//   { area, primaries: ['fire', 'water'], mons: [{ types: ['fire'], bst: 534 }, ...] }
// chart[attacker][defender] = multiplier (missing = 1).
export const TEAM_SLOTS = 6

/** Soul Link rule: a primary type may appear in only one pair on the team. */
export function fits(team, pair) {
  const used = new Set(team.flatMap((p) => p.primaries))
  return !pair.primaries.some((t) => used.has(t))
}
export const isValid = (team) => team.every((p, i) => fits(team.slice(0, i), p))

const multiplier = (chart, attacker, types) => types.reduce((m, d) => m * (chart[attacker]?.[d] ?? 1), 1)

/**
 * How good a team is: average base stat total, how many types its own types hit 2×
 * (range), and weak spots (attacking types more of the team is weak to than resists).
 */
export function scoreTeam(team, chart) {
  const mons = team.flatMap((p) => p.mons)
  if (mons.length === 0) return { score: 0, bst: 0, coverage: 0, weakSpots: [] }
  const types = Object.keys(chart)
  const withBst = mons.filter((m) => m.bst)
  const bst = withBst.length ? withBst.reduce((s, m) => s + m.bst, 0) / withBst.length : 0
  const own = new Set(mons.flatMap((m) => m.types))
  const coverage = types.filter((d) => [...own].some((t) => (chart[t]?.[d] ?? 1) >= 2)).length
  const weakSpots = types.map((t) => {
    const ms = mons.map((m) => multiplier(chart, t, m.types))
    return { type: t, weak: ms.filter((x) => x > 1).length, resist: ms.filter((x) => x < 1).length }
  }).map((w) => ({ ...w, net: w.weak - w.resist })).filter((w) => w.net >= 2).sort((a, b) => b.net - a.net)
  const penalty = weakSpots.reduce((s, w) => s + (w.net - 1), 0)
  return { score: bst / 10 + coverage * 3 - penalty * 4, bst: Math.round(bst), coverage, weakSpots }
}

/** Fill the free slots at random with pairs that keep the rules. */
export function randomTeam(pool, pinned, rand = Math.random, size = TEAM_SLOTS) {
  const team = [...pinned]
  const rest = pool.filter((p) => !team.includes(p)).map((p) => [rand(), p]).sort((a, b) => a[0] - b[0]).map(([, p]) => p)
  for (const p of rest) if (team.length < size && fits(team, p)) team.push(p)
  return team
}

/** Best team found: greedy fill, then swap pairs while the score improves. Pinned pairs stay. */
export function bestTeam(pool, pinned, chart, size = TEAM_SLOTS) {
  const score = (t) => scoreTeam(t, chart).score
  const team = [...pinned]
  while (team.length < size) {
    const options = pool.filter((p) => !team.includes(p) && fits(team, p))
    if (options.length === 0) break
    team.push(options.reduce((best, p) => (score([...team, p]) > score([...team, best]) ? p : best)))
  }
  for (let round = 0, improved = true; improved && round < 50; round++) {
    improved = false
    for (let i = pinned.length; i < team.length; i++) {
      for (const p of pool) {
        if (team.includes(p)) continue
        const next = team.map((x, j) => (j === i ? p : x))
        if (isValid(next) && score(next) > score(team) + 1e-9) { team[i] = p; improved = true }
      }
    }
  }
  return team
}
