import { appMetaSchema, type AppMeta } from './appMeta'

export async function getAppMeta(signal?: AbortSignal): Promise<AppMeta> {
  const apiBaseUrl = import.meta.env.VITE_API_URL ?? ''
  const response = await fetch(`${apiBaseUrl}/api/meta`, {
    headers: { Accept: 'application/json' },
    signal,
  })

  if (!response.ok) {
    throw new Error(`Metadata request failed with status ${response.status}.`)
  }

  return appMetaSchema.parse(await response.json())
}
