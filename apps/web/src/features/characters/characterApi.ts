import {
  characterEvaluationSchema,
  spellReplacementEvaluationSchema,
  toCharacterRequest,
  type CharacterEvaluation,
  type SpellReplacementEvaluation,
  type StoredCharacterV1,
} from './characterSchemas'

const apiBaseUrl = import.meta.env.VITE_API_URL ?? ''

export class CharacterValidationRequestError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`Character validation failed with status ${status}.`)
    this.name = 'CharacterValidationRequestError'
    this.status = status
  }
}

export type SpellReplacementTrigger = 'classLevelGained' | 'longRest'

export async function validateCharacter(
  document: StoredCharacterV1,
  signal?: AbortSignal,
): Promise<CharacterEvaluation> {
  const response = await fetch(`${apiBaseUrl}/api/characters/validate`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(toCharacterRequest(document)),
    signal,
  })

  if (!response.ok) {
    throw new CharacterValidationRequestError(response.status)
  }

  return characterEvaluationSchema.parse(await response.json())
}

export async function validateSpellReplacement(
  previous: StoredCharacterV1,
  current: StoredCharacterV1,
  trigger: SpellReplacementTrigger,
  signal?: AbortSignal,
): Promise<SpellReplacementEvaluation> {
  const response = await fetch(`${apiBaseUrl}/api/characters/validate-spell-replacement`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      previous: toCharacterRequest(previous),
      current: toCharacterRequest(current),
      trigger,
    }),
    signal,
  })

  if (!response.ok) {
    throw new CharacterValidationRequestError(response.status)
  }

  return spellReplacementEvaluationSchema.parse(await response.json())
}
