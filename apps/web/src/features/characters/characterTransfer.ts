import { ZodError, z } from 'zod'
import {
  activeRulesVersion,
  activeRuleset,
  currentCharacterSchemaVersion,
  storedCharacterV1Schema,
  type StoredCharacterV1,
} from './characterSchemas'
import { migrateStoredCharacter } from './characterStorage'

export const characterExportFormat = 'character-forge-character' as const
export const currentCharacterExportVersion = 1 as const
export const maximumCharacterImportBytes = 1024 * 1024

const characterExportV1Schema = z
  .object({
    format: z.literal(characterExportFormat),
    exportVersion: z.literal(currentCharacterExportVersion),
    exportedAt: z.string().datetime({ offset: true }),
    character: storedCharacterV1Schema,
  })
  .strict()

export type CharacterExportV1 = z.infer<typeof characterExportV1Schema>

export class CharacterImportError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'CharacterImportError'
  }
}

export class CharacterImportSizeError extends CharacterImportError {
  constructor() {
    super('The selected file is larger than the 1 MB character import limit.')
    this.name = 'CharacterImportSizeError'
  }
}

type ClockOptions = {
  now?: Date
}

type ImportOptions = ClockOptions & {
  id?: string
}

export function createCharacterExport(
  document: StoredCharacterV1,
  { now = new Date() }: ClockOptions = {},
): CharacterExportV1 {
  return characterExportV1Schema.parse({
    format: characterExportFormat,
    exportVersion: currentCharacterExportVersion,
    exportedAt: now.toISOString(),
    character: migrateStoredCharacter(document),
  })
}

export function serializeCharacterExport(
  document: StoredCharacterV1,
  options?: ClockOptions,
): string {
  return `${JSON.stringify(createCharacterExport(document, options), null, 2)}\n`
}

export function parseCharacterImport(text: string): CharacterExportV1 {
  if (new TextEncoder().encode(text).byteLength > maximumCharacterImportBytes) {
    throw new CharacterImportSizeError()
  }

  let input: unknown
  try {
    input = JSON.parse(text)
  } catch (error) {
    throw new CharacterImportError('The selected file is not valid JSON.', { cause: error })
  }

  try {
    return characterExportV1Schema.parse(input)
  } catch (error) {
    if (error instanceof ZodError) {
      throw new CharacterImportError(
        `This is not a supported ${activeRuleset} / ${activeRulesVersion} Character Forge export.`,
        { cause: error },
      )
    }
    throw error
  }
}

export function materializeImportedCharacter(
  exported: CharacterExportV1,
  { id = globalThis.crypto.randomUUID(), now = new Date() }: ImportOptions = {},
): StoredCharacterV1 {
  const timestamp = now.toISOString()

  return storedCharacterV1Schema.parse({
    ...exported.character,
    schemaVersion: currentCharacterSchemaVersion,
    id,
    ruleset: activeRuleset,
    rulesVersion: activeRulesVersion,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
}

export function characterExportFilename(document: StoredCharacterV1): string {
  const name = document.character.name
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64)

  return `${name || 'untitled-character'}.character-forge.json`
}

export function downloadCharacterExport(document: StoredCharacterV1): void {
  const blob = new Blob([serializeCharacterExport(document)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = window.document.createElement('a')
  anchor.href = url
  anchor.download = characterExportFilename(document)
  window.document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export async function readCharacterImportFile(file: File): Promise<CharacterExportV1> {
  if (file.size > maximumCharacterImportBytes) {
    throw new CharacterImportSizeError()
  }
  return parseCharacterImport(await file.text())
}
