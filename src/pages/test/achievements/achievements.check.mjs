// Self-check for the achievement maths. Run: node src/pages/test/achievements/achievements.check.mjs
import assert from 'node:assert/strict'
const a = await import('./achievements.js')

const roster = { 19: { id: 19, dex: 19, generation: 1, types: ['normal'], pastTypes: [] }, 10: { id: 10, dex: 10, generation: 1, types: ['bug'], pastTypes: [] }, 129: { id: 129, dex: 129, generation: 1, types: ['water'], pastTypes: [] } }
const run = { id: 'r', name: 'T', base_game: 'emerald', generation: 3, status: 'won', created_at: '2026-11-01T10:00:00Z', updated_at: '2026-11-10T10:00:00Z', randomized: true }
const e = (area, p1, p2, status, t) => ({ area, sort_order: 0, status, p1_pokemon_id: p1, p2_pokemon_id: p2, created_at: t, updated_at: t, p1_build: {}, p2_build: {} })
const encounters = [
  e('Starter', 10, 10, 'team', '2026-11-01T11:00:00Z'),
  e('Route 101', 19, 129, 'dead', '2026-11-02T03:00:00'),
  e('Route 102', 10, 19, 'box', '2026-11-03T12:00:00Z'),
]
const ctx = a.runContext({ run, encounters, rosterById: roster, families: {}, stats: {} })
const res = Object.fromEntries(a.evaluate(a.RUN_ACHIEVEMENTS, ctx).map((r) => [r.id, r]))
assert.equal(res['first-pair'].done, true)
assert.equal(res['first-pair'].at, '2026-11-01T11:00:00Z')
assert.equal(res.champions.done, true)
assert.equal(res.speedlink.done, true) // 9 days
assert.equal(res['ride-or-die'].done, true)
assert.equal(res.flawless.done, true) // 1 death
assert.equal(res['twin-souls'].done, true) // both caught a Caterpie on Starter
assert.equal(res.joey.done, true)
assert.equal(res.splash.done, true)
assert.equal(res['night-owl'].done, true) // 03:00 local
assert.equal(res['class-bug-catcher'].have, 3)
assert.equal(res['first-blood'].done, true)
assert.equal(res.collector.done, false)
assert.equal(res.collector.have, 3)
const riv = Object.fromEntries(a.rivalry(ctx).map((r) => [r.id, r]))
assert.deepEqual(riv['bug-catcher'].per, { p1: 2, p2: 1 })
assert.equal(riv['bug-catcher'].holder, 'p1')
const all = a.evaluate(a.ALL_ACHIEVEMENTS, { runs: [run], ctxs: [ctx], families: {} })
assert.equal(all.find((r) => r.id === 'win-1').done, true)
assert.equal(all.find((r) => r.id === 'rando-1').done, true)
const s = a.score(a.evaluate(a.RUN_ACHIEVEMENTS, ctx))
assert.ok(s.points > 0 && s.points <= s.max)
assert.ok(a.rankFor(s).name)
console.log('achievement checks passed')
const meta = a.withMeta([{ id: 'x', done: true, at: '2026-01-01', tier: 'bronze' }, { id: 'y', done: false, tier: 'bronze' }, { id: 'z', done: false, never: true, tier: 'bronze' }])
assert.equal(meta.find((m) => m.id === 'meta-half').done, true) // 1 of 2 possible
assert.equal(meta.find((m) => m.id === 'meta-all').done, false)
console.log('meta checks passed')
