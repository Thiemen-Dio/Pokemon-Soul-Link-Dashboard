// Held items the team planner understands: what they roughly do to base stats, and from which generation.
// shortcut: flat multipliers (Leftovers ≈ +10% HP, type boosters ≈ +10% attack), upgrade to damage maths if needed.
const ATK = { attack: 1.1, 'special-attack': 1.1 }
const TYPE_BOOSTERS = {
  charcoal: 'fire', 'mystic-water': 'water', 'miracle-seed': 'grass', magnet: 'electric', 'never-melt-ice': 'ice',
  'black-belt': 'fighting', 'poison-barb': 'poison', 'soft-sand': 'ground', 'sharp-beak': 'flying', 'twisted-spoon': 'psychic',
  'silver-powder': 'bug', 'hard-stone': 'rock', 'spell-tag': 'ghost', 'dragon-fang': 'dragon', 'black-glasses': 'dark',
  'metal-coat': 'steel', 'silk-scarf': 'normal',
}

export const HELD_ITEMS = {
  'choice-band': { gen: 3, boost: { attack: 1.5 } },
  'choice-specs': { gen: 4, boost: { 'special-attack': 1.5 } },
  'choice-scarf': { gen: 4, boost: { speed: 1.5 } },
  'life-orb': { gen: 4, boost: { attack: 1.3, 'special-attack': 1.3 } },
  'expert-belt': { gen: 4, boost: { attack: 1.2, 'special-attack': 1.2 } },
  'muscle-band': { gen: 4, boost: { attack: 1.1 } },
  'wise-glasses': { gen: 4, boost: { 'special-attack': 1.1 } },
  // shortcut: counted even on a fully evolved Pokémon, where it does nothing in game.
  eviolite: { gen: 5, boost: { defense: 1.5, 'special-defense': 1.5 } },
  'assault-vest': { gen: 6, boost: { 'special-defense': 1.5 } },
  leftovers: { gen: 2, boost: { hp: 1.1 } },
  'sitrus-berry': { gen: 3, boost: { hp: 1.1 } },
  'quick-claw': { gen: 2, boost: { speed: 1.1 } },
  'focus-sash': { gen: 4, boost: {} },
  'lucky-egg': { gen: 2, boost: {} },
  ...Object.fromEntries(Object.entries(TYPE_BOOSTERS).map(([k, type]) => [k, { gen: 2, boost: ATK, type }])),
}

export const STAT_KEYS = ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed']

export const itemLabel = (slug) => slug.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')
export const itemSprite = (slug) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${slug}.png`

// Natures (Gen 3+): [raised stat, lowered stat], ×1.1 and ×0.9. The five neutral ones change nothing.
export const NATURES = {
  hardy: [], lonely: ['attack', 'defense'], brave: ['attack', 'speed'], adamant: ['attack', 'special-attack'], naughty: ['attack', 'special-defense'],
  bold: ['defense', 'attack'], docile: [], relaxed: ['defense', 'speed'], impish: ['defense', 'special-attack'], lax: ['defense', 'special-defense'],
  timid: ['speed', 'attack'], hasty: ['speed', 'defense'], serious: [], jolly: ['speed', 'special-attack'], naive: ['speed', 'special-defense'],
  modest: ['special-attack', 'attack'], mild: ['special-attack', 'defense'], quiet: ['special-attack', 'speed'], bashful: [], rash: ['special-attack', 'special-defense'],
  calm: ['special-defense', 'attack'], gentle: ['special-defense', 'defense'], sassy: ['special-defense', 'speed'], careful: ['special-defense', 'special-attack'], quirky: [],
}

/** Base stats with the nature and held item applied (bst = their total). build = { item, nature }. */
export function withBuild(stats, build = {}) {
  if (!stats) return stats
  const boost = HELD_ITEMS[build.item]?.boost ?? {}
  const [up, down] = NATURES[build.nature] ?? []
  const out = { ...stats }
  for (const k of STAT_KEYS) out[k] = Math.round(stats[k] * (boost[k] ?? 1) * (k === up ? 1.1 : k === down ? 0.9 : 1))
  out.bst = STAT_KEYS.reduce((s, k) => s + out[k], 0)
  return out
}
