import { classProgressionSchema, type ClassProgressionDocument } from './classProgression'

const apiBaseUrl = import.meta.env.VITE_API_URL ?? ''

export class ClassProgressionRequestError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`Class progression request failed with status ${status}.`)
    this.name = 'ClassProgressionRequestError'
    this.status = status
  }
}

export async function getClassProgression(
  classId: string,
  signal?: AbortSignal,
): Promise<ClassProgressionDocument> {
  const response = await fetch(
    `${apiBaseUrl}/api/classes/${encodeURIComponent(classId)}/progression`,
    {
      headers: { Accept: 'application/json' },
      signal,
    },
  )

  if (!response.ok) {
    throw new ClassProgressionRequestError(response.status)
  }

  return classProgressionSchema.parse(await response.json())
}
