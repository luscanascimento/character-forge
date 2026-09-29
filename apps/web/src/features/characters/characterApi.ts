import {
  characterEvaluationSchema,
  toCharacterRequest,
  type CharacterEvaluation,
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
