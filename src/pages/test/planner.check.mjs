// Self-check for the team planner maths. Run: node src/pages/test/planner.check.mjs
import assert from 'node:assert/strict'
import { STRATEGIES, bestTeam, fits, isValid, randomTeam, scoreTeam, suggestItems, topTeams } from './planner.js'

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

// Strategies: each gives valid, different-leaning teams; pinned stays first.
const stats = (speed, bulk, legendary = false) => ({ hp: bulk, defense: bulk, 'special-defense': bulk, attack: 50, 'special-attack': 50, speed, bst: speed + 3 * bulk + 100, legendary })
const mk = (area, t, st) => ({ area, primaries: [t], mons: [{ types: [t], stats: st, bst: st.bst }, { types: [t], stats: st, bst: st.bst }] })
const fastOne = mk('F', 'fire', stats(150, 40))
const tankOne = mk('T', 'water', stats(30, 120))
const legend = mk('L', 'grass', stats(90, 90, true))
const pool2 = [fastOne, tankOne, legend, normal]
for (const k of Object.keys(STRATEGIES)) {
  const list = topTeams(pool2, [normal], chart, k, 5, Math.random, 2)
  assert.ok(list.length >= 1 && list.every((t) => isValid(t) && t[0] === normal), k)
  assert.equal(new Set(list.map((t) => t.map((p) => p.area).sort().join())).size, list.length, `${k} options are different`)
}
assert.ok(topTeams(pool2, [], chart, 'fast', 1, Math.random, 1)[0].includes(fastOne))
assert.ok(topTeams(pool2, [], chart, 'tank', 1, Math.random, 1)[0].includes(tankOne))
assert.ok(topTeams(pool2, [], chart, 'legends', 1, Math.random, 1)[0].includes(legend))

// Moves replace own types for coverage; items count in the stats.
const mover = { area: 'M', primaries: ['normal'], mons: [{ types: ['normal'], moves: [{ type: 'fire', power: 90 }, { type: 'water', power: 0 }] }] }
assert.equal(scoreTeam([mover], chart).coverage, 1, 'only the damaging fire move counts')
const slow = mk('S', 'water', stats(50, 80))
const scarfOnSlow = { ...slow, mons: slow.mons.map((m, i) => (i === 0 ? { ...m, item: 'choice-scarf' } : m)) }
assert.ok(STRATEGIES.fast.score([scarfOnSlow], chart) > STRATEGIES.fast.score([slow], chart))
// The unpinned scarf moves from a box Pokémon to the team; a pinned one stays put.
const boxed = { ...mk('B', 'grass', stats(60, 60)) }
boxed.mons = boxed.mons.map((m, i) => (i === 0 ? { ...m, item: 'choice-scarf' } : m))
const { team: withItems, swaps } = suggestItems([slow], [slow, boxed], chart, 'fast')
assert.equal(swaps.length, 1)
assert.equal(swaps[0].from, boxed.mons[0])
assert.ok(withItems[0].mons.some((m) => m.item === 'choice-scarf'))
boxed.mons[0].itemPinned = true
assert.equal(suggestItems([slow], [slow, boxed], chart, 'fast').swaps.length, 0)
console.log('planner checks passed')

// Defence range: own typing resisting attacks (water resists fire, water; grass resists water, grass).
const def = scoreTeam([pair('W', 'water', 'grass')], chart)
assert.equal(def.resisted, 3)
assert.ok(STRATEGIES.walls && STRATEGIES.range)
console.log('defence checks passed')

// Natures: Adamant +10% Attack −10% Sp. Atk; items stack on top.
const { withBuild } = await import('./items.js')
const base = { hp: 100, attack: 100, defense: 100, 'special-attack': 100, 'special-defense': 100, speed: 100 }
const adamant = withBuild(base, { nature: 'adamant', item: 'choice-band' })
assert.equal(adamant.attack, 165)
assert.equal(adamant['special-attack'], 90)
assert.equal(withBuild(base, { nature: 'hardy' }).speed, 100)
console.log('nature checks passed')
