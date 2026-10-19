export type SubclassDirectoryEntry = {
  id: string
  name: string
}

const subclassDirectory = {
  barbarian: [
    { id: 'path-of-the-berserker', name: 'Path of the Berserker' },
    { id: 'path-of-the-wild-heart', name: 'Path of the Wild Heart' },
    { id: 'path-of-the-world-tree', name: 'Path of the World Tree' },
    { id: 'path-of-the-zealot', name: 'Path of the Zealot' },
  ],
  bard: [
    { id: 'college-of-dance', name: 'College of Dance' },
    { id: 'college-of-glamour', name: 'College of Glamour' },
    { id: 'college-of-lore', name: 'College of Lore' },
    { id: 'college-of-valor', name: 'College of Valor' },
  ],
  cleric: [
    { id: 'life-domain', name: 'Life Domain' },
    { id: 'light-domain', name: 'Light Domain' },
    { id: 'trickery-domain', name: 'Trickery Domain' },
    { id: 'war-domain', name: 'War Domain' },
  ],
  druid: [
    { id: 'circle-of-the-land', name: 'Circle of the Land' },
    { id: 'circle-of-the-moon', name: 'Circle of the Moon' },
    { id: 'circle-of-the-sea', name: 'Circle of the Sea' },
    { id: 'circle-of-the-stars', name: 'Circle of the Stars' },
  ],
  fighter: [
    { id: 'battle-master', name: 'Battle Master' },
    { id: 'champion', name: 'Champion' },
    { id: 'eldritch-knight', name: 'Eldritch Knight' },
    { id: 'psi-warrior', name: 'Psi Warrior' },
  ],
  monk: [
    { id: 'warrior-of-mercy', name: 'Warrior of Mercy' },
    { id: 'warrior-of-the-open-hand', name: 'Warrior of the Open Hand' },
    { id: 'warrior-of-the-elements', name: 'Warrior of the Elements' },
    { id: 'warrior-of-shadow', name: 'Warrior of Shadow' },
  ],
  paladin: [
    { id: 'oath-of-devotion', name: 'Oath of Devotion' },
    { id: 'oath-of-glory', name: 'Oath of Glory' },
    { id: 'oath-of-the-ancients', name: 'Oath of the Ancients' },
    { id: 'oath-of-vengeance', name: 'Oath of Vengeance' },
  ],
  ranger: [
    { id: 'beast-master', name: 'Beast Master' },
    { id: 'fey-wanderer', name: 'Fey Wanderer' },
    { id: 'gloom-stalker', name: 'Gloom Stalker' },
    { id: 'hunter', name: 'Hunter' },
  ],
  rogue: [
    { id: 'arcane-trickster', name: 'Arcane Trickster' },
    { id: 'assassin', name: 'Assassin' },
    { id: 'soulknife', name: 'Soulknife' },
    { id: 'thief', name: 'Thief' },
  ],
  sorcerer: [
    { id: 'aberrant-sorcery', name: 'Aberrant Sorcery' },
    { id: 'clockwork-sorcery', name: 'Clockwork Sorcery' },
    { id: 'draconic-sorcery', name: 'Draconic Sorcery' },
    { id: 'wild-magic-sorcery', name: 'Wild Magic Sorcery' },
  ],
  warlock: [
    { id: 'archfey-patron', name: 'Archfey Patron' },
    { id: 'celestial-patron', name: 'Celestial Patron' },
    { id: 'fiend-patron', name: 'Fiend Patron' },
    { id: 'great-old-one-patron', name: 'Great Old One Patron' },
  ],
  wizard: [
    { id: 'abjurer', name: 'Abjurer' },
    { id: 'diviner', name: 'Diviner' },
    { id: 'evoker', name: 'Evoker' },
    { id: 'illusionist', name: 'Illusionist' },
  ],
} as const satisfies Record<string, readonly SubclassDirectoryEntry[]>

export function getSubclassDirectory(classId: string): readonly SubclassDirectoryEntry[] {
  return subclassDirectory[classId as keyof typeof subclassDirectory] ?? []
}

export const subclassDirectoryClassIds = Object.keys(subclassDirectory)
