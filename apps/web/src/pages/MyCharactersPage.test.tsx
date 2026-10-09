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
import MyCharactersPage from './MyCharactersPage'

type CharacterRepository = {
  list: () => Promise<StoredCharacterV1[]>
  save: (document: unknown) => Promise<StoredCharacterV1>
  delete: (id: string) => Promise<void>
}

function renderPage(
  storage: CharacterRepository,
  createDraft?: () => StoredCharacterV1,
  duplicateDraft?: (source: StoredCharacterV1) => StoredCharacterV1,
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/characters']}>
        <Routes>
          <Route
            path="/characters"
            element={
              <MyCharactersPage
                storage={storage}
                createDraft={createDraft}
                duplicateDraft={duplicateDraft}
              />
            }
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
    delete: vi.fn().mockResolvedValue(undefined),
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
        classProgressions: [{ class: null, level: 1, subclass: null }],
        proficiencyChoices: [],
        featureChoices: [],
        spells: { cantrips: [], spellbook: [], preparedSpells: [] },
        equipment: { items: [] },
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

  it('duplicates a character under a new identity and keeps the source unchanged', async () => {
    const user = userEvent.setup()
    const source = createStoredCharacter()
    const duplicate = createStoredCharacter({
      id: 'e9184ef1-f146-48d8-858a-05f83a9608f0',
      createdAt: '2026-10-03T18:00:00.000Z',
      updatedAt: '2026-10-03T18:00:00.000Z',
      character: { ...source.character, name: 'Arannis (Copy)' },
    })
    const storage = repository({ list: vi.fn().mockResolvedValue([source]) })
    const duplicateDraft = vi.fn().mockReturnValue(duplicate)
    renderPage(storage, undefined, duplicateDraft)

    await user.click(await screen.findByRole('button', { name: 'Duplicate Arannis' }))

    await waitFor(() => expect(storage.save).toHaveBeenCalledWith(duplicate))
    expect(duplicateDraft).toHaveBeenCalledWith(source)
    expect(screen.getByRole('heading', { name: 'Arannis (Copy)' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Arannis' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Continue Arannis (Copy)' })).toHaveAttribute(
      'href',
      `/forge/${duplicate.id}`,
    )
  })

  it('keeps the source character when duplication fails', async () => {
    const user = userEvent.setup()
    const source = createStoredCharacter()
    const storage = repository({
      list: vi.fn().mockResolvedValue([source]),
      save: vi.fn().mockRejectedValue(new Error('quota exceeded')),
    })
    renderPage(storage)

    await user.click(await screen.findByRole('button', { name: 'Duplicate Arannis' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('could not be duplicated')
    expect(screen.getByRole('heading', { name: 'Arannis' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(1)
  })

  it('requires confirmation and allows deletion to be cancelled', async () => {
    const user = userEvent.setup()
    const source = createStoredCharacter()
    const storage = repository({ list: vi.fn().mockResolvedValue([source]) })
    renderPage(storage)

    await user.click(await screen.findByRole('button', { name: 'Delete Arannis' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Delete Arannis?' })
    expect(within(dialog).getByText(/cannot be undone/i)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Keep character' }))

    expect(storage.delete).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Arannis' })).toBeInTheDocument()
  })

  it('removes a confirmed character from storage and the roster cache', async () => {
    const user = userEvent.setup()
    const source = createStoredCharacter()
    const storage = repository({ list: vi.fn().mockResolvedValue([source]) })
    renderPage(storage)

    await user.click(await screen.findByRole('button', { name: 'Delete Arannis' }))
    await user.click(screen.getByRole('button', { name: 'Delete permanently' }))

    await waitFor(() => expect(storage.delete).toHaveBeenCalledWith(source.id))
    expect(await screen.findByRole('heading', { name: 'Your ledger is empty' })).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('keeps the character and confirmation open when deletion fails', async () => {
    const user = userEvent.setup()
    const source = createStoredCharacter()
    const storage = repository({
      list: vi.fn().mockResolvedValue([source]),
      delete: vi.fn().mockRejectedValue(new Error('transaction failed')),
    })
    renderPage(storage)

    await user.click(await screen.findByRole('button', { name: 'Delete Arannis' }))
    await user.click(screen.getByRole('button', { name: 'Delete permanently' }))

    const dialog = await screen.findByRole('alertdialog', { name: 'Delete Arannis?' })
    expect(within(dialog).getByRole('alert')).toHaveTextContent('remains in your roster')
    expect(screen.getByRole('heading', { name: 'Arannis' })).toBeInTheDocument()
  })
})
