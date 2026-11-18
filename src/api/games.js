// Readable names for PokeAPI version groups. Unknown ones fall back to a title-cased slug.
const GAME_LABELS = {
  'red-blue': 'Red / Blue',
  yellow: 'Yellow',
  'gold-silver': 'Gold / Silver',
  crystal: 'Crystal',
  'ruby-sapphire': 'Ruby / Sapphire',
  emerald: 'Emerald',
  'firered-leafgreen': 'FireRed / LeafGreen',
  'diamond-pearl': 'Diamond / Pearl',
  platinum: 'Platinum',
  'heartgold-soulsilver': 'HeartGold / SoulSilver',
  'black-white': 'Black / White',
  'black-2-white-2': 'Black 2 / White 2',
  'x-y': 'X / Y',
  'omega-ruby-alpha-sapphire': 'Omega Ruby / Alpha Sapphire',
  'sun-moon': 'Sun / Moon',
  'ultra-sun-ultra-moon': 'Ultra Sun / Ultra Moon',
  'lets-go-pikachu-lets-go-eevee': "Let's Go Pikachu / Eevee",
  'sword-shield': 'Sword / Shield',
  'the-isle-of-armor': 'Sword / Shield: Isle of Armor',
  'the-crown-tundra': 'Sword / Shield: Crown Tundra',
  'brilliant-diamond-shining-pearl': 'Brilliant Diamond / Shining Pearl',
  'legends-arceus': 'Legends: Arceus',
  'scarlet-violet': 'Scarlet / Violet',
  'the-teal-mask': 'Scarlet / Violet: Teal Mask',
  'the-indigo-disk': 'Scarlet / Violet: Indigo Disk',
  'legends-za': 'Legends: Z-A',
  'mega-dimension': 'Legends: Z-A: Mega Dimension',
  champions: 'Champions',
}

export function gameLabel(slug) {
  return (
    GAME_LABELS[slug] ??
    slug
      .split('-')
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(' ')
  )
}
