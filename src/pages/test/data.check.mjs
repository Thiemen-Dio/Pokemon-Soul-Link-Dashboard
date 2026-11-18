// Self-check for the Test tab helpers. Run: node src/pages/test/data.check.mjs
import assert from 'node:assert/strict'
const d = await import('./data.js')
assert.equal(d.locationSlug('Route 1', 5), 'unova-route-1')
assert.equal(d.locationSlug('Route 101', 3), 'hoenn-route-101')
assert.equal(d.locationSlug('Pinwheel Forest', 5), 'pinwheel-forest')
assert.equal(d.locationSlug("Mt. Pyre", 3), 'mt-pyre')
assert.equal(d.locationSlug('Victory Road', 5), 'unova-victory-road')
assert.equal(d.versionOf('black-white'), 'black')
assert.equal(d.versionOf('emerald'), 'emerald')
assert.equal(d.timeAgo(new Date(Date.now() - 3 * 3600e3).toISOString()), '3 hours ago')
assert.equal(d.timeAgo(new Date(Date.now() - 5 * 60e3).toISOString()), '5 min ago')
const list = [{ area: 'R1', status: 'team', p1_pokemon_id: 1, p2_pokemon_id: 4 }]
assert.equal(d.catches(list).length, 2)
console.log('all checks passed')
