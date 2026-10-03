import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { createStoredCharacter } from '../../test/characterFixture'
import {
  characterDatabaseName,
  characterStoreName,
  CharacterStorage,
  CharacterStorageConflictError,
  CharacterStorageDataError,
  CharacterStorageUnavailableError,
  migrateStoredCharacter,
  UnsupportedCharacterSchemaError,
} from './characterStorage'

describe('character storage', () => {
  let factory: IDBFactory
  let storage: CharacterStorage

  beforeEach(() => {
    factory = new IDBFactory()
    storage = new CharacterStorage(factory)
  })

  it('saves, lists, loads, and deletes versioned characters', async () => {
    const older = createStoredCharacter()
    const newer = createStoredCharacter({
      id: '6736dcd0-fb67-4749-9d2a-399a671f53ac',
      createdAt: '2026-09-29T13:00:00.000Z',
      updatedAt: '2026-09-29T13:00:00.000Z',
      character: { ...older.character, name: 'Bryn' },
    })

    await storage.save(older)
    await storage.save(newer)

    expect((await storage.get(older.id))?.character.name).toBe('Arannis')
    expect((await storage.list()).map((item) => item.character.name)).toEqual(['Bryn', 'Arannis'])

    await storage.delete(older.id)

    expect(await storage.get(older.id)).toBeNull()
  })

  it('rejects malformed records read from IndexedDB', async () => {
    const valid = createStoredCharacter()
    await storage.save(valid)
    await putRaw(factory, {
      schemaVersion: 1,
      id: valid.id,
      ruleset: '2014',
      rulesVersion: 'SRD-5.1',
    })

    await expect(storage.get(valid.id)).rejects.toBeInstanceOf(CharacterStorageDataError)
  })

  it('fails predictably when IndexedDB is unavailable', async () => {
    const unavailable = new CharacterStorage(null)

    await expect(unavailable.list()).rejects.toBeInstanceOf(CharacterStorageUnavailableError)
  })

  it('rejects an older write instead of overwriting a newer tab revision', async () => {
    const current = createStoredCharacter({ updatedAt: '2026-10-03T18:00:00.000Z' })
    const stale = createStoredCharacter({
      updatedAt: '2026-10-03T17:59:59.000Z',
      character: { ...current.character, name: 'Stale edit' },
    })
    await storage.save(current)

    await expect(storage.save(stale)).rejects.toBeInstanceOf(CharacterStorageConflictError)
    expect((await storage.get(current.id))?.character.name).toBe('Arannis')
  })

  it('rejects an expected revision mismatch even when the candidate timestamp is newer', async () => {
    const current = createStoredCharacter({ updatedAt: '2026-10-03T18:00:00.000Z' })
    const staleTabEdit = createStoredCharacter({
      updatedAt: '2026-10-03T18:01:00.000Z',
      character: { ...current.character, name: 'Stale tab edit' },
    })
    await storage.save(current)

    await expect(storage.save(staleTabEdit, '2026-10-03T17:59:00.000Z')).rejects.toBeInstanceOf(
      CharacterStorageConflictError,
    )
    expect((await storage.get(current.id))?.character.name).toBe('Arannis')
  })

  it('accepts schema version 1 through the migration seam', () => {
    const document = createStoredCharacter()

    expect(migrateStoredCharacter(document)).toEqual(document)
  })

  it('rejects unsupported future schema versions without guessing', () => {
    const document = { ...createStoredCharacter(), schemaVersion: 2 }

    expect(() => migrateStoredCharacter(document)).toThrow(UnsupportedCharacterSchemaError)
  })
})

async function putRaw(factory: IDBFactory, value: unknown): Promise<void> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open(characterDatabaseName, 1)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(characterStoreName, 'readwrite')
      transaction.objectStore(characterStoreName).put(value)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
  } finally {
    database.close()
  }
}
