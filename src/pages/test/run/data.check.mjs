// Self-check for the Test tab helpers. Run: node src/pages/test/run/data.check.mjs
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

// Randomizer log: one Pokémon per line, "Lv4" or "Lvs 2-4", Route 1 ≠ Route 10.
const log = `--Trainers Pokemon--
x
--Wild Pokemon--
Set #1 - Route 1 Grass/Cave (rate=20)
Lillipup Lv4             HP 45  ATK 60
Nidoran♀ Lvs 2-4         HP 55  ATK 47

Set #2 - Route 10 Grass/Cave (rate=20)
Mr. Mime Lv30            HP 40

--In-Game Trades--
Patrat Lv9`
const sets = d.parseRandomizerLog(log)
assert.equal(sets.length, 2)
assert.deepEqual(sets[0].mons[1], { name: 'Nidoran♀', min: 2, max: 4 })
assert.equal(d.logSetsFor('Route 1', sets).length, 1)
const roster = [{ id: 506, dex: 506, name: 'lillipup' }, { id: 29, dex: 29, name: 'nidoran-f' }, { id: 122, dex: 122, name: 'mr-mime' }]
assert.deepEqual(d.logEncounters('Route 1', sets, roster).map((m) => m.id).sort(), [29, 506])
assert.equal(d.logEncounters('Route 10', sets, roster)[0].where, 'Grass/Cave')
console.log('log checks passed')

// Evolution fixes in a log, and run settings.
const evoLog = `--Removing Impossible Evolutions--
Kadabra         -> Alakazam        at level 37
Slowpoke        -> Slowking        using a WATER STONE
--Random 2-Evolution Starters--
Set starter 1 to Machop`
assert.deepEqual(d.parseLogEvolutions(evoLog), [
  { from: 'kadabra', to: 'alakazam', how: 'Lv 37', level: 37 },
  { from: 'slowpoke', to: 'slowking', how: 'Water Stone', level: null },
])
assert.deepEqual(d.runSettings({ generation: 3, rules: null }), { monGen: 3, movesGen: 3, sharedNames: true, bosses: true })
assert.equal(d.nickname({ p1_nickname: 'Bob', p2_nickname: 'Al' }, 'p2', { sharedNames: true }), 'Bob')
assert.equal(d.nickname({ p1_nickname: 'Bob', p2_nickname: 'Al' }, 'p2', { sharedNames: false }), 'Al')
console.log('log + settings checks passed')
