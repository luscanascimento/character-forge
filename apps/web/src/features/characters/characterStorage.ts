import { ZodError } from 'zod'
import {
  currentCharacterSchemaVersion,
  storedCharacterV1Schema,
  type StoredCharacterV1,
} from './characterSchemas'

export const characterDatabaseName = 'character-forge'
export const characterStoreName = 'characters'
const databaseVersion = 1

export class CharacterStorageUnavailableError extends Error {
  constructor(message = 'Character storage is unavailable.', options?: ErrorOptions) {
    super(message, options)
    this.name = 'CharacterStorageUnavailableError'
  }
}

export class CharacterStorageDataError extends Error {
  constructor(message = 'Stored character data is invalid.', options?: ErrorOptions) {
    super(message, options)
    this.name = 'CharacterStorageDataError'
  }
}

export class CharacterStorageConflictError extends Error {
  constructor(message = 'A newer character draft is already stored in this browser.') {
    super(message)
    this.name = 'CharacterStorageConflictError'
  }
}

export class UnsupportedCharacterSchemaError extends CharacterStorageDataError {
  constructor(version: unknown) {
    super(`Character schema version '${String(version)}' is not supported.`)
    this.name = 'UnsupportedCharacterSchemaError'
  }
}

export function migrateStoredCharacter(input: unknown): StoredCharacterV1 {
  if (!isRecord(input) || !('schemaVersion' in input)) {
    throw new CharacterStorageDataError('Stored character data has no schema version.')
  }

  if (input.schemaVersion !== currentCharacterSchemaVersion) {
    throw new UnsupportedCharacterSchemaError(input.schemaVersion)
  }

  try {
    return storedCharacterV1Schema.parse(input)
  } catch (error) {
    if (error instanceof ZodError) {
      throw new CharacterStorageDataError('Stored character version 1 data is malformed.', {
        cause: error,
      })
    }
    throw error
  }
}

export class CharacterStorage {
  readonly #factory: IDBFactory | null

  constructor(
    factory: IDBFactory | null = typeof globalThis.indexedDB === 'undefined'
      ? null
      : globalThis.indexedDB,
  ) {
    this.#factory = factory
  }

  async list(): Promise<StoredCharacterV1[]> {
    const records = await this.#withStore('readonly', (store) => requestResult(store.getAll()))
    return records
      .map(migrateStoredCharacter)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  }

  async get(id: string): Promise<StoredCharacterV1 | null> {
    const record = await this.#withStore('readonly', (store) => requestResult(store.get(id)))
    return record === undefined ? null : migrateStoredCharacter(record)
  }

  async save(input: unknown, expectedUpdatedAt?: string): Promise<StoredCharacterV1> {
    const document = migrateStoredCharacter(input)
    await this.#withStore('readwrite', async (store) => {
      const current = await requestResult(store.get(document.id))
      if (current !== undefined) {
        const stored = migrateStoredCharacter(current)
        if (
          (expectedUpdatedAt !== undefined && stored.updatedAt !== expectedUpdatedAt) ||
          stored.updatedAt > document.updatedAt
        ) {
          throw new CharacterStorageConflictError()
        }
      }
      await requestResult(store.put(document))
    })
    return document
  }

  async delete(id: string): Promise<void> {
    await this.#withStore('readwrite', (store) => requestResult(store.delete(id)))
  }

  async #withStore<T>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => Promise<T>,
  ): Promise<T> {
    const database = await this.#open()
    try {
      const transaction = database.transaction(characterStoreName, mode)
      const completion = transactionCompletion(transaction)
      void completion.catch(() => undefined)
      const result = await operation(transaction.objectStore(characterStoreName))
      await completion
      return result
    } finally {
      database.close()
    }
  }

  #open(): Promise<IDBDatabase> {
    if (this.#factory === null) {
      return Promise.reject(new CharacterStorageUnavailableError())
    }

    return new Promise((resolve, reject) => {
      let request: IDBOpenDBRequest
      let blocked = false
      try {
        request = this.#factory!.open(characterDatabaseName, databaseVersion)
      } catch (error) {
        reject(new CharacterStorageUnavailableError(undefined, { cause: error }))
        return
      }

      request.onupgradeneeded = () => {
        const database = request.result
        if (!database.objectStoreNames.contains(characterStoreName)) {
          const store = database.createObjectStore(characterStoreName, { keyPath: 'id' })
          store.createIndex('by-updated-at', 'updatedAt')
        }
      }
      request.onsuccess = () => {
        if (blocked) {
          request.result.close()
          return
        }
        resolve(request.result)
      }
      request.onerror = () =>
        reject(
          new CharacterStorageUnavailableError(undefined, {
            cause: request.error,
          }),
        )
      request.onblocked = () => {
        blocked = true
        reject(
          new CharacterStorageUnavailableError(
            'Character storage upgrade was blocked by another open tab.',
          ),
        )
      }
    })
  }
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(
        new CharacterStorageUnavailableError(undefined, {
          cause: request.error,
        }),
      )
  })
}

function transactionCompletion(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () =>
      reject(
        new CharacterStorageUnavailableError(undefined, {
          cause: transaction.error,
        }),
      )
    transaction.onabort = () =>
      reject(
        new CharacterStorageUnavailableError('Character storage transaction was aborted.', {
          cause: transaction.error,
        }),
      )
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
