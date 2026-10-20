import { describe, expect, it } from 'vitest'
import { createStoredCharacter } from '../../test/characterFixture'
import {
  CharacterImportError,
  CharacterImportSizeError,
  characterExportFilename,
  createCharacterExport,
  materializeImportedCharacter,
  maximumCharacterImportBytes,
  parseCharacterImport,
  serializeCharacterExport,
} from './characterTransfer'

describe('character transfer', () => {
  it('serializes a versioned portable envelope with the complete stored character', () => {
    const document = createStoredCharacter()
    const exportedAt = new Date('2026-10-19T14:00:00.000Z')

    const serialized = serializeCharacterExport(document, { now: exportedAt })
    const parsed = parseCharacterImport(serialized)

    expect(parsed).toEqual({
      format: 'character-forge-character',
      exportVersion: 1,
      exportedAt: exportedAt.toISOString(),
      character: document,
    })
  })

  it('rejects invalid JSON, unrelated documents, and oversized input', () => {
    expect(() => parseCharacterImport('{')).toThrowError(
      new CharacterImportError('The selected file is not valid JSON.'),
    )
    expect(() => parseCharacterImport(JSON.stringify({ format: 'something-else' }))).toThrow(
      /not a supported 2024 \/ SRD-5\.2\.1/i,
    )
    expect(() => parseCharacterImport('x'.repeat(maximumCharacterImportBytes + 1))).toThrow(
      CharacterImportSizeError,
    )
  })

  it('rejects exports for another schema or rules identity', () => {
    const document = createStoredCharacter()
    const exported = createCharacterExport(document)

    expect(() =>
      parseCharacterImport(
        JSON.stringify({
          ...exported,
          character: { ...exported.character, rulesVersion: 'SRD-9.9.9' },
        }),
      ),
    ).toThrow(CharacterImportError)
  })

  it('imports under a fresh local identity without changing character choices', () => {
    const source = createStoredCharacter()
    const timestamp = new Date('2026-10-19T15:30:00.000Z')
    const imported = materializeImportedCharacter(createCharacterExport(source), {
      id: 'bd36a978-4481-4ee3-98c8-d4a9eaac94f2',
      now: timestamp,
    })

    expect(imported.id).not.toBe(source.id)
    expect(imported.createdAt).toBe(timestamp.toISOString())
    expect(imported.updatedAt).toBe(timestamp.toISOString())
    expect(imported.character).toEqual(source.character)
  })

  it('creates filesystem-safe, recognizable export names', () => {
    const document = createStoredCharacter({
      character: { ...createStoredCharacter().character, name: '  Éowyn / Shield-Maiden!  ' },
    })

    expect(characterExportFilename(document)).toBe('eowyn-shield-maiden.character-forge.json')
  })
})
