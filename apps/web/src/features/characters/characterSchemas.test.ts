import { describe, expect, it } from 'vitest'
import {
  createStoredCharacterDraft,
  duplicateStoredCharacter,
  storedCharacterV1Schema,
} from './characterSchemas'

describe('createStoredCharacterDraft', () => {
  it('creates a versioned blank draft with stable identity and timestamps', () => {
    const document = createStoredCharacterDraft({
      id: '7a28dfb1-c349-436b-a420-9c09de991368',
      now: new Date('2026-10-01T14:30:00.000Z'),
    })

    expect(storedCharacterV1Schema.parse(document)).toEqual(document)
    expect(document).toMatchObject({
      schemaVersion: 1,
      id: '7a28dfb1-c349-436b-a420-9c09de991368',
      ruleset: '2024',
      rulesVersion: 'SRD-5.2.1',
      createdAt: '2026-10-01T14:30:00.000Z',
      updatedAt: '2026-10-01T14:30:00.000Z',
      character: {
        name: '',
        abilities: null,
        species: null,
        background: null,
        classProgressions: [{ class: null, level: 1 }],
        proficiencyChoices: [],
      },
    })
  })
})

describe('duplicateStoredCharacter', () => {
  it('copies a complete character under a fresh identity and timestamps', () => {
    const source = storedCharacterV1Schema.parse({
      ...createStoredCharacterDraft({
        id: '7a28dfb1-c349-436b-a420-9c09de991368',
        now: new Date('2026-10-01T14:30:00.000Z'),
      }),
      character: {
        name: 'Lyra',
        abilities: {
          strength: 8,
          dexterity: 14,
          constitution: 13,
          intelligence: 16,
          wisdom: 12,
          charisma: 10,
        },
        species: { id: 'elf', name: 'Elf' },
        background: { id: 'sage', name: 'Sage' },
        classProgressions: [{ class: { id: 'wizard', name: 'Wizard' }, level: 1 }],
        proficiencyChoices: [],
      },
    })

    const duplicate = duplicateStoredCharacter(source, {
      id: 'e9184ef1-f146-48d8-858a-05f83a9608f0',
      now: new Date('2026-10-03T18:00:00.000Z'),
    })

    expect(duplicate).toMatchObject({
      id: 'e9184ef1-f146-48d8-858a-05f83a9608f0',
      createdAt: '2026-10-03T18:00:00.000Z',
      updatedAt: '2026-10-03T18:00:00.000Z',
      character: { ...source.character, name: 'Lyra (Copy)' },
    })
    expect(source.character.name).toBe('Lyra')
  })

  it('gives an untitled source an intentional copied name', () => {
    const duplicate = duplicateStoredCharacter(createStoredCharacterDraft(), {
      id: 'e9184ef1-f146-48d8-858a-05f83a9608f0',
      now: new Date('2026-10-03T18:00:00.000Z'),
    })

    expect(duplicate.character.name).toBe('Untitled character (Copy)')
  })
})
