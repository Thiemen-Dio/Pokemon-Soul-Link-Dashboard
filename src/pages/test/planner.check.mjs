// Self-check for the team planner maths. Run: node src/pages/test/planner.check.mjs
import assert from 'node:assert/strict'
import { bestTeam, fits, isValid, randomTeam, scoreTeam } from './planner.js'

const chart = {
  fire: { grass: 2, water: 0.5, fire: 0.5 },
  water: { fire: 2, grass: 0.5, water: 0.5 },
  grass: { water: 2, fire: 0.5, grass: 0.5 },
  normal: {},
}
const pair = (area, a, b, bst = 400) => ({ area, primaries: [...new Set([a, b])], mons: [{ types: [a], bst }, { types: [b], bst }] })

const fireWater = pair('A', 'fire', 'water')
const fireFire = pair('B', 'fire', 'fire')
const grass = pair('C', 'grass', 'grass')
const normal = pair('D', 'normal', 'normal', 600)

// Rule: no primary type in two pairs (a pair may share a type with itself).
assert.equal(fits([fireWater], fireFire), false)
assert.equal(fits([fireWater], grass), true)
assert.equal(isValid([fireFire]), true)
assert.equal(isValid([fireWater, fireFire]), false)

// Score: coverage counts types hit 2×, bst is the average.
const s = scoreTeam([fireWater, grass], chart)
assert.equal(s.coverage, 3)
assert.equal(s.bst, 400)
assert.equal(scoreTeam([], chart).score, 0)

// Pinned pairs always stay; result never breaks the rule.
const pool = [fireWater, fireFire, grass, normal]
for (let i = 0; i < 20; i++) {
  const t = randomTeam(pool, [fireFire])
  assert.equal(t[0], fireFire)
  assert.ok(isValid(t))
}
const best = bestTeam(pool, [], chart, 3)
assert.ok(isValid(best))
assert.equal(best.length, 3)
assert.ok(best.includes(normal), 'high base stats should be picked')
assert.deepEqual(bestTeam(pool, [fireFire], chart, 3)[0], fireFire)
console.log('planner checks passed')
