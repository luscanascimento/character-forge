import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
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

function repository(overrides: Partial<CharacterRepository> = {}): CharacterRepository {
  return {
    get: vi.fn().mockResolvedValue(createStoredCharacter()),
    save: vi.fn(async (document: unknown) => document as StoredCharacterV1),
    ...overrides,
  }
}

function renderPage(
  storage: CharacterRepository,
  now: () => Date = () => new Date('2026-10-01T15:00:00.000Z'),
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const character = createStoredCharacter()

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/forge/${character.id}`]}>
        <Routes>
          <Route
            path="/forge/:characterId"
            element={<CharacterBuilderPage storage={storage} now={now} />}
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

  it('loads the requested character into the first progressive step', async () => {
    const storage = repository()
    const character = createStoredCharacter()
    renderPage(storage)

    expect(await screen.findByRole('heading', { name: 'Name your hero' })).toBeInTheDocument()
    expect(storage.get).toHaveBeenCalledWith(character.id)
    expect(screen.getByRole('textbox', { name: 'Character name' })).toHaveValue('Arannis')

    const steps = within(screen.getByRole('navigation', { name: 'Character creation steps' }))
    expect(steps.getAllByRole('listitem')).toHaveLength(6)
    expect(steps.getByText('Name')).toHaveAttribute('aria-current', 'step')
    expect(steps.getByText('Abilities')).not.toHaveAttribute('aria-current')
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

    expect(await screen.findByRole('heading', { name: 'Name your hero' })).toBeInTheDocument()
    expect(get).toHaveBeenCalledTimes(2)
  })

  it('requires a name and explicitly saves a trimmed update with a new timestamp', async () => {
    const user = userEvent.setup()
    const storage = repository()
    renderPage(storage)

    const input = await screen.findByRole('textbox', { name: 'Character name' })
    await user.clear(input)
    await user.click(screen.getByRole('button', { name: 'Save draft' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Choose a name')
    expect(storage.save).not.toHaveBeenCalled()

    await user.type(input, '  Lyra  ')
    await user.click(screen.getByRole('button', { name: 'Save draft' }))

    await waitFor(() => expect(storage.save).toHaveBeenCalledTimes(1))
    expect(storage.save).toHaveBeenCalledWith(
      expect.objectContaining({
        updatedAt: '2026-10-01T15:00:00.000Z',
        character: expect.objectContaining({ name: 'Lyra' }),
      }),
    )
    expect(await screen.findByText('Draft saved locally.')).toBeInTheDocument()
    expect(input).toHaveValue('Lyra')
  })
})
