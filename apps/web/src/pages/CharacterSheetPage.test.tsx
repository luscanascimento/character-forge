import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type {
  CharacterEvaluation,
  StoredCharacterV1,
} from '../features/characters/characterSchemas'
import { createStoredCharacter } from '../test/characterFixture'
import CharacterSheetPage from './CharacterSheetPage'

function validEvaluation(): CharacterEvaluation {
  return {
    validation: { isValid: true, violations: [] },
    derived: {
      baseAbilities: {
        strength: 8,
        dexterity: 14,
        constitution: 13,
        intelligence: 12,
        wisdom: 10,
        charisma: 16,
      },
      effectiveAbilities: {
        strength: 8,
        dexterity: 14,
        constitution: 13,
        intelligence: 12,
        wisdom: 10,
        charisma: 16,
      },
      abilityModifiers: {
        strength: -1,
        dexterity: 2,
        constitution: 1,
        intelligence: 1,
        wisdom: 0,
        charisma: 3,
      },
      proficiencyBonus: 2,
      armorClass: 12,
      walkingSpeed: 30,
      hasStealthDisadvantage: false,
      hitPointMaximum: 7,
      hitDie: 6,
      grantedProficiencies: [
        {
          proficiency: { id: 'skill-arcana', name: 'Skill: Arcana' },
          sources: [
            {
              category: 'class',
              selection: { id: 'wizard', name: 'Wizard' },
            },
          ],
          isSkill: true,
        },
      ],
      spellcasting: {
        ability: { id: 'int', name: 'INT' },
        cantripsKnown: 3,
        preparedSpells: 2,
        slots: [{ spellLevel: 1, count: 2 }],
        spellSaveDc: 11,
        spellAttackModifier: 3,
      },
      weaponMasteries: [],
      weaponAttacks: [],
    },
  }
}

function renderPage({
  document = createStoredCharacter(),
  validator = vi.fn().mockResolvedValue(validEvaluation()),
  printDocument = vi.fn(),
  exportDocument = vi.fn(),
}: {
  document?: StoredCharacterV1 | null
  validator?: (document: StoredCharacterV1, signal?: AbortSignal) => Promise<CharacterEvaluation>
  printDocument?: () => void
  exportDocument?: (document: StoredCharacterV1) => void
} = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const storage = { get: vi.fn().mockResolvedValue(document) }

  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/characters/f33771b4-ae75-47b6-bad0-df2a80896a67/sheet']}>
        <Routes>
          <Route
            path="/characters/:characterId/sheet"
            element={
              <CharacterSheetPage
                storage={storage}
                validator={validator}
                printDocument={printDocument}
                exportDocument={exportDocument}
              />
            }
          />
          <Route path="/characters" element={<p>Roster route</p>} />
          <Route path="/forge/:characterId" element={<p>Builder route</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )

  return { storage, validator, printDocument, exportDocument }
}

describe('CharacterSheetPage', () => {
  it('loads the local document and renders canonical evaluated values', async () => {
    const document = createStoredCharacter({
      character: {
        ...createStoredCharacter().character,
        spells: {
          cantrips: [{ id: 'light', name: 'Light' }],
          spellbook: [{ id: 'magic-missile', name: 'Magic Missile' }],
          preparedSpells: [{ id: 'magic-missile', name: 'Magic Missile' }],
        },
      },
    })
    const { storage, validator } = renderPage({ document })

    const sheet = await screen.findByRole('article', { name: 'Arannis' })
    expect(storage.get).toHaveBeenCalledWith(document.id)
    expect(validator).toHaveBeenCalledWith(document, expect.any(AbortSignal))
    expect(within(sheet).getByText('Armor class').nextSibling).toHaveTextContent('12')
    expect(within(sheet).getByText('Hit points').nextSibling).toHaveTextContent('7')
    expect(within(sheet).getByText('Save DC')).toBeInTheDocument()
    expect(within(sheet).getByText('Light')).toBeInTheDocument()
    expect(within(sheet).getByText('Magic Missile')).toBeInTheDocument()
    expect(within(sheet).getByText(/canonically validated against SRD-5.2.1/i)).toBeInTheDocument()
  })

  it('offers print and export actions for a valid sheet', async () => {
    const user = userEvent.setup()
    const document = createStoredCharacter()
    const printDocument = vi.fn()
    const exportDocument = vi.fn()
    renderPage({ document, printDocument, exportDocument })

    await screen.findByRole('article', { name: 'Arannis' })
    await user.click(screen.getByRole('button', { name: 'Print / Save PDF' }))
    await user.click(screen.getByRole('button', { name: 'Export JSON' }))

    expect(printDocument).toHaveBeenCalledOnce()
    expect(exportDocument).toHaveBeenCalledWith(document)
  })

  it('does not render a printable sheet when canonical validation fails', async () => {
    const evaluation: CharacterEvaluation = {
      validation: {
        isValid: false,
        violations: [
          {
            code: 'character.name.required',
            message: 'Choose a character name.',
            source: 'name',
            severity: 'error',
            requirement: 'A name is required.',
          },
        ],
      },
      derived: null,
    }
    renderPage({ validator: vi.fn().mockResolvedValue(evaluation) })

    expect(
      await screen.findByRole('heading', { name: 'This character still needs attention' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Choose a character name.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Print / Save PDF' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Return to the builder' })).toHaveAttribute(
      'href',
      '/forge/f33771b4-ae75-47b6-bad0-df2a80896a67',
    )
  })

  it('handles a missing local character without calling validation', async () => {
    const validator = vi.fn()
    renderPage({ document: null, validator })

    expect(await screen.findByRole('heading', { name: 'Character not found' })).toBeInTheDocument()
    expect(validator).not.toHaveBeenCalled()
  })

  it('does not present an incomplete successful response as a printable sheet', async () => {
    renderPage({
      validator: vi.fn().mockResolvedValue({
        validation: { isValid: true, violations: [] },
        derived: null,
      }),
    })

    expect(
      await screen.findByRole('heading', { name: 'Trusted character values are unavailable' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Print / Save PDF' })).not.toBeInTheDocument()
  })

  it('retries a temporarily unavailable rules service', async () => {
    const user = userEvent.setup()
    const validator = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(validEvaluation())
    renderPage({ validator })

    expect(
      await screen.findByRole('heading', { name: 'The character could not be validated' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('article', { name: 'Arannis' })).toBeInTheDocument()
    await waitFor(() => expect(validator).toHaveBeenCalledTimes(2))
  })
})
