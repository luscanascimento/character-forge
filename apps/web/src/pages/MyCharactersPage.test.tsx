import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import {
  CharacterStorageDataError,
  CharacterStorageUnavailableError,
} from '../features/characters/characterStorage'
import type { StoredCharacterV1 } from '../features/characters/characterSchemas'
import { createStoredCharacter } from '../test/characterFixture'
import MyCharactersPage from './MyCharactersPage'

type CharacterRepository = {
  list: () => Promise<StoredCharacterV1[]>
  save: (document: unknown) => Promise<StoredCharacterV1>
}

function renderPage(storage: CharacterRepository, createDraft?: () => StoredCharacterV1) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/characters']}>
        <Routes>
          <Route
            path="/characters"
            element={<MyCharactersPage storage={storage} createDraft={createDraft} />}
          />
          <Route path="/forge/:characterId" element={<p>Builder route</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function repository(overrides: Partial<CharacterRepository> = {}): CharacterRepository {
  return {
    list: vi.fn().mockResolvedValue([]),
    save: vi.fn(async (document: unknown) => document as StoredCharacterV1),
    ...overrides,
  }
}

describe('MyCharactersPage', () => {
  it('shows a loading state before local records arrive', () => {
    renderPage(repository({ list: () => new Promise(() => undefined) }))

    expect(screen.getByRole('status')).toHaveTextContent('Opening the ledger')
  })

  it('shows the empty state when no characters are stored', async () => {
    renderPage(repository())

    expect(await screen.findByRole('heading', { name: 'Your ledger is empty' })).toBeInTheDocument()
    expect(screen.getByText(/stored only in this browser/i)).toBeInTheDocument()
  })

  it('renders characters in storage order and links each one to its builder route', async () => {
    const older = createStoredCharacter()
    const newer = createStoredCharacter({
      id: '6736dcd0-fb67-4749-9d2a-399a671f53ac',
      updatedAt: '2026-09-30T12:00:00.000Z',
      character: { ...older.character, name: 'Bryn' },
    })
    renderPage(repository({ list: vi.fn().mockResolvedValue([newer, older]) }))

    await screen.findByRole('heading', { name: 'Bryn' })
    const cards = screen.getAllByRole('heading', { level: 3 })
    expect(cards.map((heading) => heading.textContent)).toEqual(['Bryn', 'Arannis'])
    expect(screen.getByRole('link', { name: 'Continue Bryn' })).toHaveAttribute(
      'href',
      `/forge/${newer.id}`,
    )
  })

  it('saves a new draft before navigating to its builder route', async () => {
    const user = userEvent.setup()
    const draft = createStoredCharacter({
      id: '7a28dfb1-c349-436b-a420-9c09de991368',
      character: {
        name: '',
        abilities: null,
        species: null,
        background: null,
        classProgressions: [{ class: null, level: 1 }],
        proficiencyChoices: [],
      },
    })
    const storage = repository()
    renderPage(storage, () => draft)

    await screen.findByRole('heading', { name: 'Your ledger is empty' })
    await user.click(screen.getByRole('button', { name: 'Forge a character' }))

    expect(storage.save).toHaveBeenCalledWith(draft)
    expect(await screen.findByText('Builder route')).toBeInTheDocument()
  })

  it('explains malformed data without deleting it', async () => {
    renderPage(
      repository({
        list: vi.fn().mockRejectedValue(new CharacterStorageDataError()),
      }),
    )

    expect(
      await screen.findByRole('heading', { name: 'A saved character needs attention' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/nothing was deleted or replaced/i)).toBeInTheDocument()
  })

  it('recovers when unavailable storage becomes readable', async () => {
    const user = userEvent.setup()
    const list = vi
      .fn()
      .mockRejectedValueOnce(new CharacterStorageUnavailableError())
      .mockResolvedValueOnce([])
    renderPage(repository({ list }))

    expect(
      await screen.findByRole('heading', { name: 'The local ledger is unavailable' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('heading', { name: 'Your ledger is empty' })).toBeInTheDocument()
    expect(list).toHaveBeenCalledTimes(2)
  })
})
