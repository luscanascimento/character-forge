import { describe, expect, it } from 'vitest'
import { createStoredCharacterDraft, storedCharacterV1Schema } from './characterSchemas'

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
