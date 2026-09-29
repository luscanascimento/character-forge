import {
  catalogItemSchema,
  catalogPageSchema,
  type CatalogCategory,
  type CatalogFilters,
  type CatalogItem,
  type CatalogPage,
} from './catalog'

const apiBaseUrl = import.meta.env.VITE_API_URL ?? ''

export class CatalogRequestError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'CatalogRequestError'
    this.status = status
  }
}

export async function getCatalogPage(
  category: CatalogCategory,
  filters: CatalogFilters,
  signal?: AbortSignal,
): Promise<CatalogPage> {
  const query = new URLSearchParams()
  setQuery(query, 'search', filters.search)
  setQuery(query, 'page', filters.page)
  setQuery(query, 'level', filters.level)
  setQuery(query, 'school', filters.school)
  setQuery(query, 'class', filters.characterClass)
  setQuery(query, 'sort', filters.sort)

  const response = await fetch(`${apiBaseUrl}/api/catalog/${category}?${query}`, {
    headers: { Accept: 'application/json' },
    signal,
  })

  if (!response.ok) {
    throw new CatalogRequestError('The archive could not be opened.', response.status)
  }

  return catalogPageSchema.parse(await response.json())
}

export async function getCatalogItem(
  category: CatalogCategory,
  id: string,
  signal?: AbortSignal,
): Promise<CatalogItem> {
  const response = await fetch(`${apiBaseUrl}/api/catalog/${category}/${encodeURIComponent(id)}`, {
    headers: { Accept: 'application/json' },
    signal,
  })

  if (!response.ok) {
    throw new CatalogRequestError(
      response.status === 404
        ? 'This entry has vanished from the archive.'
        : 'The archive could not be opened.',
      response.status,
    )
  }

  return catalogItemSchema.parse(await response.json())
}

function setQuery(query: URLSearchParams, key: string, value: string | number | undefined) {
  if (value !== undefined && value !== '') {
    query.set(key, String(value))
  }
}
