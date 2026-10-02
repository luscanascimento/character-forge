import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { CatalogCategory, CatalogFilters, CatalogPage } from '../features/catalog/catalog'
import {
  CharacterStorageDataError,
  CharacterStorageUnavailableError,
} from '../features/characters/characterStorage'
import type { StoredCharacterV1 } from '../features/characters/characterSchemas'
import { createStoredCharacter } from '../test/characterFixture'
import CharacterBuilderPage from './CharacterBuilderPage'

type CharacterRepository = {
  get: (id: string) => Promise<StoredCharacterV1 | null>
  save: (document: unknown) => Promise<StoredCharacterV1>
}

type CatalogLoader = (
  category: CatalogCategory,
  filters: CatalogFilters,
  signal?: AbortSignal,
) => Promise<CatalogPage>

const catalogItems = {
  species: [
    { id: 'elf', name: 'Elf', category: 'species' as const },
    { id: 'human', name: 'Human', category: 'species' as const },
  ],
  backgrounds: [
    { id: 'acolyte', name: 'Acolyte', category: 'backgrounds' as const },
    { id: 'sage', name: 'Sage', category: 'backgrounds' as const },
  ],
}

function catalogPage(category: 'species' | 'backgrounds'): CatalogPage {
  return {
    items: catalogItems[category],
    page: 1,
    pageSize: 48,
    total: catalogItems[category].length,
    totalPages: 1,
    source: {
      provider: 'D&D 5e SRD API',
      ruleset: '2024',
      rulesVersion: 'SRD-5.2.1',
      fetchedAt: '2026-10-02T12:00:00Z',
    },
  }
}

function defaultCatalogLoader(): CatalogLoader {
  return vi.fn((category: CatalogCategory) => {
    if (category !== 'species' && category !== 'backgrounds') {
      return Promise.reject(new Error(`Unexpected category: ${category}`))
    }
    return Promise.resolve(catalogPage(category))
  })
}

function repository(overrides: Partial<CharacterRepository> = {}): CharacterRepository {
  return {
    get: vi.fn().mockResolvedValue(createStoredCharacter()),
    save: vi.fn(async (document: unknown) => document as StoredCharacterV1),
    ...overrides,
  }
}

function blankCharacter(): StoredCharacterV1 {
  const character = createStoredCharacter()
  return {
    ...character,
    character: {
      ...character.character,
      name: '',
      abilities: null,
    },
  }
}

function originlessCharacter(): StoredCharacterV1 {
  const character = createStoredCharacter()
  return {
    ...character,
    character: {
      ...character.character,
      species: null,
      background: null,
    },
  }
}

function renderPage(
  storage: CharacterRepository,
  now: () => Date = () => new Date('2026-10-01T15:00:00.000Z'),
  catalogLoader: CatalogLoader = defaultCatalogLoader(),
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const character = createStoredCharacter()

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/forge/${character.id}`]}>
        <Routes>
          <Route
            path="/forge/:characterId"
            element={
              <CharacterBuilderPage storage={storage} now={now} catalogLoader={catalogLoader} />
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('CharacterBuilderPage', () => {
  it('shows a loading state while the local draft is read', () => {
    renderPage(repository({ get: () => new Promise(() => undefined) }))

    expect(screen.getByRole('status')).toHaveTextContent('Opening your draft')
  })

  it('resumes a character with abilities at the origins step', async () => {
    const storage = repository()
    const character = createStoredCharacter()
    const loader = defaultCatalogLoader()
    renderPage(storage, undefined, loader)

    expect(await screen.findByRole('heading', { name: 'Choose their origins' })).toBeInTheDocument()
    expect(storage.get).toHaveBeenCalledWith(character.id)
    expect(await screen.findByRole('radio', { name: 'Elf' })).toBeChecked()

    const steps = within(screen.getByRole('navigation', { name: 'Character creation steps' }))
    expect(steps.getAllByRole('listitem')).toHaveLength(6)
    expect(steps.getByRole('button', { name: 'Name' })).not.toHaveAttribute('aria-current')
    expect(steps.getByRole('button', { name: 'Origins' })).toHaveAttribute('aria-current', 'step')
    expect(loader).toHaveBeenCalledWith('species', { page: 1, pageSize: 48 }, expect.anything())
  })

  it('shows a safe missing-character state', async () => {
    renderPage(repository({ get: vi.fn().mockResolvedValue(null) }))

    expect(await screen.findByRole('heading', { name: 'Character not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Return to my characters' })).toHaveAttribute(
      'href',
      '/characters',
    )
  })

  it('explains malformed records without changing them', async () => {
    const storage = repository({
      get: vi.fn().mockRejectedValue(new CharacterStorageDataError()),
    })
    renderPage(storage)

    expect(
      await screen.findByRole('heading', { name: 'This draft needs attention' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/not changed or removed/i)).toBeInTheDocument()
    expect(storage.save).not.toHaveBeenCalled()
  })

  it('retries when local storage becomes available', async () => {
    const user = userEvent.setup()
    const get = vi
      .fn()
      .mockRejectedValueOnce(new CharacterStorageUnavailableError())
      .mockResolvedValueOnce(createStoredCharacter())
    renderPage(repository({ get }))

    expect(
      await screen.findByRole('heading', { name: 'The forge cannot reach this draft' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('heading', { name: 'Choose their origins' })).toBeInTheDocument()
    expect(get).toHaveBeenCalledTimes(2)
  })

  it('requires a name and explicitly saves a trimmed update with a new timestamp', async () => {
    const user = userEvent.setup()
    const storage = repository({ get: vi.fn().mockResolvedValue(blankCharacter()) })
    renderPage(storage)

    const input = await screen.findByRole('textbox', { name: 'Character name' })
    await user.click(screen.getByRole('button', { name: 'Save and continue' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Choose a name')
    expect(storage.save).not.toHaveBeenCalled()

    await user.type(input, '  Lyra  ')
    await user.click(screen.getByRole('button', { name: 'Save and continue' }))

    await waitFor(() => expect(storage.save).toHaveBeenCalledTimes(1))
    expect(storage.save).toHaveBeenCalledWith(
      expect.objectContaining({
        updatedAt: '2026-10-01T15:00:00.000Z',
        character: expect.objectContaining({ name: 'Lyra' }),
      }),
    )
    expect(
      await screen.findByRole('heading', { name: 'Shape their abilities' }),
    ).toBeInTheDocument()
  })

  it('previews bounded modifiers and reports incomplete or out-of-range scores', async () => {
    const user = userEvent.setup()
    const storage = repository()
    renderPage(storage)

    await user.click(await screen.findByRole('button', { name: 'Abilities' }))
    const strength = await screen.findByRole('spinbutton', { name: /strength/i })
    expect(strength).toHaveAccessibleDescription('Modifier -1')

    await user.clear(strength)
    await user.type(strength, '31')
    const dexterity = screen.getByRole('spinbutton', { name: /dexterity/i })
    await user.clear(dexterity)
    await user.click(screen.getByRole('button', { name: 'Save abilities' }))

    expect(screen.getByText('Use 1–30.')).toBeInTheDocument()
    expect(screen.getByText('Enter a score.')).toBeInTheDocument()
    expect(storage.save).not.toHaveBeenCalled()
  })

  it('persists all six integer scores and their updated timestamp', async () => {
    const user = userEvent.setup()
    const storage = repository()
    renderPage(storage)

    await user.click(await screen.findByRole('button', { name: 'Abilities' }))
    const strength = await screen.findByRole('spinbutton', { name: /strength/i })
    await user.clear(strength)
    await user.type(strength, '15')
    expect(strength).toHaveAccessibleDescription('Modifier +2')
    await user.click(screen.getByRole('button', { name: 'Save abilities' }))

    await waitFor(() => expect(storage.save).toHaveBeenCalledTimes(1))
    expect(storage.save).toHaveBeenCalledWith(
      expect.objectContaining({
        updatedAt: '2026-10-01T15:00:00.000Z',
        character: expect.objectContaining({
          abilities: {
            strength: 15,
            dexterity: 14,
            constitution: 13,
            intelligence: 12,
            wisdom: 10,
            charisma: 16,
          },
        }),
      }),
    )
    expect(await screen.findByRole('heading', { name: 'Choose their origins' })).toBeInTheDocument()
  })

  it('keeps the previous ability draft when explicit saving fails', async () => {
    const user = userEvent.setup()
    const storage = repository({ save: vi.fn().mockRejectedValue(new Error('quota exceeded')) })
    renderPage(storage)

    await user.click(await screen.findByRole('button', { name: 'Abilities' }))
    await screen.findByRole('heading', { name: 'Shape their abilities' })
    await user.click(screen.getByRole('button', { name: 'Save abilities' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('The previous draft remains intact')
    expect(screen.getByRole('spinbutton', { name: /strength/i })).toHaveValue(8)
  })

  it('persists canonical species and background references from catalog choices', async () => {
    const user = userEvent.setup()
    const storage = repository()
    renderPage(storage)

    await user.click(await screen.findByRole('radio', { name: 'Human' }))
    await user.click(screen.getByRole('radio', { name: 'Sage' }))
    await user.click(screen.getByRole('button', { name: 'Save origins' }))

    await waitFor(() => expect(storage.save).toHaveBeenCalledTimes(1))
    expect(storage.save).toHaveBeenCalledWith(
      expect.objectContaining({
        character: expect.objectContaining({
          species: { id: 'human', name: 'Human' },
          background: { id: 'sage', name: 'Sage' },
        }),
      }),
    )
    expect(await screen.findByText('Draft saved locally.')).toBeInTheDocument()
  })

  it('requires both origin selections before saving', async () => {
    const user = userEvent.setup()
    const storage = repository({ get: vi.fn().mockResolvedValue(originlessCharacter()) })
    renderPage(storage)

    await screen.findByRole('radio', { name: 'Elf' })
    await user.click(screen.getByRole('button', { name: 'Save origins' }))

    expect(screen.getByText('Choose an available species.')).toBeInTheDocument()
    expect(screen.getByText('Choose an available background.')).toBeInTheDocument()
    expect(storage.save).not.toHaveBeenCalled()
  })

  it('recovers both origin lists after a provider failure', async () => {
    const user = userEvent.setup()
    const attempts = new Map<CatalogCategory, number>()
    const loader = vi.fn((category: CatalogCategory) => {
      if (category !== 'species' && category !== 'backgrounds') {
        return Promise.reject(new Error('unexpected category'))
      }
      const attempt = (attempts.get(category) ?? 0) + 1
      attempts.set(category, attempt)
      return attempt === 1
        ? Promise.reject(new Error('provider unavailable'))
        : Promise.resolve(catalogPage(category))
    })
    renderPage(repository(), undefined, loader)

    expect(await screen.findByText('The origins archive is unavailable')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('radio', { name: 'Human' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Sage' })).toBeInTheDocument()
  })
})
