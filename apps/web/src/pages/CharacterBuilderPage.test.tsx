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

  it('resumes a named character at the abilities step', async () => {
    const storage = repository()
    const character = createStoredCharacter()
    renderPage(storage)

    expect(
      await screen.findByRole('heading', { name: 'Shape their abilities' }),
    ).toBeInTheDocument()
    expect(storage.get).toHaveBeenCalledWith(character.id)
    expect(screen.getByRole('spinbutton', { name: /strength/i })).toHaveValue(8)

    const steps = within(screen.getByRole('navigation', { name: 'Character creation steps' }))
    expect(steps.getAllByRole('listitem')).toHaveLength(6)
    expect(steps.getByRole('button', { name: 'Name' })).not.toHaveAttribute('aria-current')
    expect(steps.getByRole('button', { name: 'Abilities' })).toHaveAttribute('aria-current', 'step')
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

    expect(
      await screen.findByRole('heading', { name: 'Shape their abilities' }),
    ).toBeInTheDocument()
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
    expect(await screen.findByText('Draft saved locally.')).toBeInTheDocument()
  })

  it('keeps the previous ability draft when explicit saving fails', async () => {
    const user = userEvent.setup()
    const storage = repository({ save: vi.fn().mockRejectedValue(new Error('quota exceeded')) })
    renderPage(storage)

    await screen.findByRole('heading', { name: 'Shape their abilities' })
    await user.click(screen.getByRole('button', { name: 'Save abilities' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('The previous draft remains intact')
    expect(screen.getByRole('spinbutton', { name: /strength/i })).toHaveValue(8)
  })
})
