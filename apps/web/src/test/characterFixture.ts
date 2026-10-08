import type { StoredCharacterV1 } from '../features/characters/characterSchemas'

export function createStoredCharacter(
  overrides: Partial<StoredCharacterV1> = {},
): StoredCharacterV1 {
  return {
    schemaVersion: 1,
    id: 'f33771b4-ae75-47b6-bad0-df2a80896a67',
    ruleset: '2024',
    rulesVersion: 'SRD-5.2.1',
    createdAt: '2026-09-29T12:00:00.000Z',
    updatedAt: '2026-09-29T12:00:00.000Z',
    character: {
      name: 'Arannis',
      abilities: {
        strength: 8,
        dexterity: 14,
        constitution: 13,
        intelligence: 12,
        wisdom: 10,
        charisma: 16,
      },
      species: { id: 'elf', name: 'Elf' },
      background: { id: 'acolyte', name: 'Acolyte' },
      classProgressions: [{ class: { id: 'wizard', name: 'Wizard' }, level: 1, subclass: null }],
      proficiencyChoices: [
        {
          choiceId: 'classes/wizard/proficiencies/0',
          selections: [
            { id: 'skill-arcana', name: 'Skill: Arcana' },
            { id: 'skill-history', name: 'Skill: History' },
          ],
        },
        {
          choiceId: 'species/elf/traits/keen-senses/proficiencies/0',
          selections: [{ id: 'skill-perception', name: 'Skill: Perception' }],
        },
      ],
      featureChoices: [],
      spells: { cantrips: [], spellbook: [], preparedSpells: [] },
    },
    ...overrides,
  }
}
