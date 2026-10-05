import { featureChoiceDocumentSchema, type FeatureChoiceDocument } from './featureRules'

const apiBaseUrl = import.meta.env.VITE_API_URL ?? ''

export class FeatureRulesRequestError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`Feature rules request failed with status ${status}.`)
    this.name = 'FeatureRulesRequestError'
    this.status = status
  }
}

export async function getFeatureChoices(
  classId: string,
  signal?: AbortSignal,
): Promise<FeatureChoiceDocument> {
  const response = await fetch(
    `${apiBaseUrl}/api/classes/${encodeURIComponent(classId)}/feature-choices`,
    { headers: { Accept: 'application/json' }, signal },
  )

  if (!response.ok) throw new FeatureRulesRequestError(response.status)
  return featureChoiceDocumentSchema.parse(await response.json())
}
