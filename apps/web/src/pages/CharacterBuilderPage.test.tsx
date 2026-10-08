import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type {
  CatalogCategory,
  CatalogFilters,
  CatalogItem,
  CatalogPage,
} from '../features/catalog/catalog'
import {
  CharacterStorageConflictError,
  CharacterStorageDataError,
  CharacterStorageUnavailableError,
} from '../features/characters/characterStorage'
import type {
  CharacterEvaluation,
  StoredCharacterV1,
} from '../features/characters/characterSchemas'
import type { ClassProgressionDocument } from '../features/progression/classProgression'
import type { FeatureChoiceDocument } from '../features/featureRules/featureRules'
import { createStoredCharacter } from '../test/characterFixture'
import CharacterBuilderPage from './CharacterBuilderPage'

type CharacterRepository = {
  get: (id: string) => Promise<StoredCharacterV1 | null>
  save: (document: unknown, expectedUpdatedAt?: string) => Promise<StoredCharacterV1>
}

type CatalogLoader = (
  category: CatalogCategory,
  filters: CatalogFilters,
  signal?: AbortSignal,
) => Promise<CatalogPage>

type CatalogItemLoader = (
  category: CatalogCategory,
  id: string,
  signal?: AbortSignal,
) => Promise<CatalogItem>

type CharacterValidationLoader = (
  document: StoredCharacterV1,
  signal?: AbortSignal,
) => Promise<CharacterEvaluation>

type ClassProgressionLoader = (
  classId: string,
  signal?: AbortSignal,
) => Promise<ClassProgressionDocument>

type FeatureChoicesLoader = (
  classId: string,
  signal?: AbortSignal,
) => Promise<FeatureChoiceDocument>

const catalogItems = {
  classes: [
    { id: 'bard', name: 'Bard', category: 'classes' as const },
    { id: 'fighter', name: 'Fighter', category: 'classes' as const },
    { id: 'wizard', name: 'Wizard', category: 'classes' as const },
  ],
  species: [
    { id: 'elf', name: 'Elf', category: 'species' as const },
    { id: 'human', name: 'Human', category: 'species' as const },
  ],
  backgrounds: [
    { id: 'acolyte', name: 'Acolyte', category: 'backgrounds' as const },
    { id: 'sage', name: 'Sage', category: 'backgrounds' as const },
  ],
}

function catalogPage(category: 'classes' | 'species' | 'backgrounds'): CatalogPage {
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
    if (category !== 'classes' && category !== 'species' && category !== 'backgrounds') {
      return Promise.reject(new Error(`Unexpected category: ${category}`))
    }
    return Promise.resolve(catalogPage(category))
  })
}

function catalogItem(category: 'classes' | 'species' | 'backgrounds', id: string): CatalogItem {
  const names: Record<string, string> = {
    wizard: 'Wizard',
    bard: 'Bard',
    fighter: 'Fighter',
    elf: 'Elf',
    human: 'Human',
    acolyte: 'Acolyte',
    sage: 'Sage',
  }
  const proficiencyChoices =
    category === 'classes' && id === 'bard'
      ? [
          {
            id: 'classes/bard/proficiencies/0',
            prompt: 'Choose three Bard skills',
            count: 3,
            options: [
              { id: 'skill-arcana', name: 'Skill: Arcana', isSkill: true },
              { id: 'skill-performance', name: 'Skill: Performance', isSkill: true },
              { id: 'skill-persuasion', name: 'Skill: Persuasion', isSkill: true },
            ],
          },
        ]
      : category === 'classes' && id === 'wizard'
        ? [
            {
              id: 'classes/wizard/proficiencies/0',
              prompt: 'Choose two class skills',
              count: 2,
              options: [
                { id: 'skill-arcana', name: 'Skill: Arcana', isSkill: true },
                { id: 'skill-history', name: 'Skill: History', isSkill: true },
                { id: 'skill-perception', name: 'Skill: Perception', isSkill: true },
              ],
            },
          ]
        : category === 'classes' && id === 'fighter'
          ? [
              {
                id: 'classes/fighter/proficiencies/0',
                prompt: 'Choose two fighter skills',
                count: 2,
                options: [
                  { id: 'skill-athletics', name: 'Skill: Athletics', isSkill: true },
                  { id: 'skill-perception', name: 'Skill: Perception', isSkill: true },
                  { id: 'skill-survival', name: 'Skill: Survival', isSkill: true },
                ],
              },
            ]
          : category === 'species' && id === 'elf'
            ? [
                {
                  id: 'species/elf/traits/keen-senses/proficiencies/0',
                  prompt: 'Choose one keen sense',
                  count: 1,
                  options: [
                    { id: 'skill-insight', name: 'Skill: Insight', isSkill: true },
                    { id: 'skill-perception', name: 'Skill: Perception', isSkill: true },
                  ],
                },
              ]
            : []

  return {
    id,
    name: names[id] ?? id,
    category,
    description: [],
    attributes: [],
    sections: [],
    textSections: [],
    characterCreation: {
      hitDie: category === 'classes' ? (id === 'wizard' ? 6 : id === 'bard' ? 8 : 10) : null,
      grantedProficiencies:
        category === 'classes'
          ? [{ id: 'simple-weapons', name: 'Simple Weapons', isSkill: false }]
          : [],
      proficiencyChoices,
    },
    source: {
      provider: 'D&D 5e SRD API',
      ruleset: '2024',
      rulesVersion: 'SRD-5.2.1',
      fetchedAt: '2026-10-03T12:00:00Z',
    },
  }
}

function defaultCatalogItemLoader(): CatalogItemLoader {
  return vi.fn((category: CatalogCategory, id: string) => {
    if (category !== 'classes' && category !== 'species' && category !== 'backgrounds') {
      return Promise.reject(new Error(`Unexpected category: ${category}`))
    }
    return Promise.resolve(catalogItem(category, id))
  })
}

function validEvaluation(): CharacterEvaluation {
  return {
    validation: { violations: [], isValid: true },
    derived: {
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
      hitPointMaximum: 7,
      hitDie: 6,
      spellcasting: {
        ability: { id: 'int', name: 'INT' },
        cantripsKnown: 3,
        preparedSpells: 4,
        slots: [{ spellLevel: 1, count: 2 }],
        spellSaveDc: 11,
        spellAttackModifier: 3,
      },
      grantedProficiencies: [
        {
          proficiency: { id: 'simple-weapons', name: 'Simple Weapons' },
          isSkill: false,
          sources: [
            {
              category: 'classes',
              selection: { id: 'wizard', name: 'Wizard' },
            },
          ],
        },
        {
          proficiency: { id: 'skill-arcana', name: 'Skill: Arcana' },
          isSkill: true,
          sources: [
            {
              category: 'classes',
              selection: { id: 'wizard', name: 'Wizard' },
            },
          ],
        },
      ],
    },
  }
}

function defaultValidationLoader(): CharacterValidationLoader {
  return vi.fn().mockResolvedValue(validEvaluation())
}

function classProgression(classId: string): ClassProgressionDocument {
  const isFighter = classId === 'fighter'
  const isBard = classId === 'bard'
  const className = isFighter ? 'Fighter' : isBard ? 'Bard' : 'Wizard'
  const subclass = isFighter
    ? { id: 'champion', name: 'Champion' }
    : isBard
      ? { id: 'lore', name: 'College of Lore' }
      : { id: 'evoker', name: 'Evoker' }

  return {
    class: { id: classId, name: className },
    hitDie: isFighter ? 10 : isBard ? 8 : 6,
    levels: Array.from({ length: 20 }, (_, index) => ({
      level: index + 1,
      proficiencyBonus: 2 + Math.floor(index / 4),
      features:
        index === 2
          ? [{ id: `${classId}-subclass`, name: `${className} Subclass` }]
          : index === 4
            ? [{ id: `${classId}-extra-attack`, name: 'Extra Attack' }]
            : [],
    })),
    subclasses: [
      {
        subclass,
        availableAtLevel: 3,
        levels: [
          {
            level: 3,
            features: [
              {
                id: isFighter ? 'champion-improved-critical' : 'sculpt-spells',
                name: isFighter ? 'Improved Critical' : 'Sculpt Spells',
              },
            ],
          },
        ],
      },
    ],
    source: {
      provider: 'D&D 5e SRD API',
      ruleset: '2024',
      rulesVersion: 'SRD-5.2.1',
      fetchedAt: '2026-10-04T12:00:00Z',
    },
  }
}

function defaultProgressionLoader(): ClassProgressionLoader {
  return vi.fn((classId: string) => Promise.resolve(classProgression(classId)))
}

function defaultFeatureChoicesLoader(): FeatureChoicesLoader {
  return vi.fn((classId: string) =>
    Promise.resolve<FeatureChoiceDocument>({
      manifestVersion: 'SRD-5.2.1-CF-1',
      ruleset: '2024',
      rulesVersion: 'SRD-5.2.1',
      class: { id: classId, name: classId === 'fighter' ? 'Fighter' : 'Wizard' },
      requirements: [],
    }),
  )
}

function bardFeatureChoicesLoader(): FeatureChoicesLoader {
  return vi.fn((classId: string) =>
    Promise.resolve<FeatureChoiceDocument>({
      manifestVersion: 'SRD-5.2.1-CF-1',
      ruleset: '2024',
      rulesVersion: 'SRD-5.2.1',
      class: { id: classId, name: classId === 'bard' ? 'Bard' : classId },
      requirements:
        classId === 'bard'
          ? [
              {
                id: 'bard-expertise-2',
                subclassId: null,
                featureId: 'bard-expertise',
                availableAtLevel: 2,
                count: 1,
                branches: [
                  {
                    id: 'expertise-skills',
                    selectionCount: 2,
                    optionSource: 'proficientSkills',
                    availability: 'supported',
                    dependency: null,
                    options: [],
                  },
                ],
              },
            ]
          : [],
    }),
  )
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

function classlessCharacter(): StoredCharacterV1 {
  const character = createStoredCharacter()
  return {
    ...character,
    character: {
      ...character.character,
      classProgressions: [{ class: null, level: 1, subclass: null }],
      proficiencyChoices: [],
    },
  }
}

function proficiencylessCharacter(): StoredCharacterV1 {
  const character = createStoredCharacter()
  return {
    ...character,
    character: {
      ...character.character,
      proficiencyChoices: [],
    },
  }
}

function bardSpellcaster(): StoredCharacterV1 {
  const character = createStoredCharacter()
  return {
    ...character,
    character: {
      ...character.character,
      classProgressions: [{ class: { id: 'bard', name: 'Bard' }, level: 1, subclass: null }],
      proficiencyChoices: [
        {
          choiceId: 'classes/bard/proficiencies/0',
          selections: [
            { id: 'skill-arcana', name: 'Skill: Arcana' },
            { id: 'skill-performance', name: 'Skill: Performance' },
            { id: 'skill-persuasion', name: 'Skill: Persuasion' },
          ],
        },
        {
          choiceId: 'species/elf/traits/keen-senses/proficiencies/0',
          selections: [{ id: 'skill-perception', name: 'Skill: Perception' }],
        },
      ],
    },
  }
}

function bardSpellProgression(): ClassProgressionDocument {
  return {
    ...classProgression('bard'),
    spellcasting: {
      availableAtLevel: 1,
      ability: { id: 'cha', name: 'CHA' },
      policy: {
        manifestVersion: 'SRD-5.2.1-SPELL-1',
        preparedSpellSource: 'classSpellList',
        cantripReplacement: { trigger: 'classLevelGained', maximumReplacements: 1 },
        preparedSpellReplacement: { trigger: 'classLevelGained', maximumReplacements: 1 },
        slotPool: 'standard',
        baseSlotRecovery: 'longRest',
        usesUniformSlotLevel: false,
        maximumSlotLevel: 9,
        specialSpellAccess: [],
      },
      levels: Array.from({ length: 20 }, (_, index) => ({
        classLevel: index + 1,
        cantripsKnown: 2,
        preparedSpells: 4,
        slots: [{ spellLevel: 1, count: 2 }],
      })),
    },
  }
}

function spellCatalogPage(): CatalogPage {
  const items = [
    { id: 'dancing-lights', name: 'Dancing Lights', category: 'spells' as const, level: 0 },
    { id: 'light', name: 'Light', category: 'spells' as const, level: 0 },
    { id: 'charm-person', name: 'Charm Person', category: 'spells' as const, level: 1 },
    { id: 'cure-wounds', name: 'Cure Wounds', category: 'spells' as const, level: 1 },
    { id: 'detect-magic', name: 'Detect Magic', category: 'spells' as const, level: 1 },
    { id: 'heroism', name: 'Heroism', category: 'spells' as const, level: 1 },
    { id: 'shatter', name: 'Shatter', category: 'spells' as const, level: 2 },
  ]
  return {
    items,
    page: 1,
    pageSize: 48,
    total: items.length,
    totalPages: 1,
    source: {
      provider: 'D&D 5e SRD API',
      ruleset: '2024',
      rulesVersion: 'SRD-5.2.1',
      fetchedAt: '2026-10-06T12:00:00Z',
    },
  }
}

function renderPage(
  storage: CharacterRepository,
  now: () => Date = () => new Date('2026-10-01T15:00:00.000Z'),
  catalogLoader: CatalogLoader = defaultCatalogLoader(),
  catalogItemLoader: CatalogItemLoader = defaultCatalogItemLoader(),
  validationLoader: CharacterValidationLoader = defaultValidationLoader(),
  autosaveDelay?: number,
  progressionLoader: ClassProgressionLoader = defaultProgressionLoader(),
  featureChoicesLoader: FeatureChoicesLoader = defaultFeatureChoicesLoader(),
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
              <CharacterBuilderPage
                storage={storage}
                now={now}
                autosaveDelay={autosaveDelay}
                catalogLoader={catalogLoader}
                catalogItemLoader={catalogItemLoader}
                progressionLoader={progressionLoader}
                featureChoicesLoader={featureChoicesLoader}
                validationLoader={validationLoader}
              />
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

  it('resumes a character with unfinished origins at the origins step', async () => {
    const storage = repository({ get: vi.fn().mockResolvedValue(originlessCharacter()) })
    const character = createStoredCharacter()
    const loader = defaultCatalogLoader()
    renderPage(storage, undefined, loader)

    expect(await screen.findByRole('heading', { name: 'Choose their origins' })).toBeInTheDocument()
    expect(storage.get).toHaveBeenCalledWith(character.id)
    expect(await screen.findByRole('radio', { name: 'Elf' })).not.toBeChecked()

    const steps = within(screen.getByRole('navigation', { name: 'Character creation steps' }))
    expect(steps.getAllByRole('listitem')).toHaveLength(7)
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

    expect(
      await screen.findByRole('heading', { name: 'Review your character' }),
    ).toBeInTheDocument()
    expect(get).toHaveBeenCalledTimes(2)
  })

  it('requires a name and explicitly saves a trimmed update with a new timestamp', async () => {
    const user = userEvent.setup()
    const storage = repository({ get: vi.fn().mockResolvedValue(blankCharacter()) })
    renderPage(storage)

    const input = await screen.findByRole('textbox', { name: 'Character name' })
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Choose a name')
    expect(storage.save).not.toHaveBeenCalled()

    await user.type(input, '  Lyra  ')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => expect(storage.save).toHaveBeenCalledTimes(1))
    expect(storage.save).toHaveBeenCalledWith(
      expect.objectContaining({
        updatedAt: '2026-10-01T15:00:00.000Z',
        character: expect.objectContaining({ name: 'Lyra' }),
      }),
      '2026-09-29T12:00:00.000Z',
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
    await user.click(screen.getByRole('button', { name: 'Continue' }))

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
    await user.click(screen.getByRole('button', { name: 'Continue' }))

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
      '2026-09-29T12:00:00.000Z',
    )
    expect(await screen.findByRole('heading', { name: 'Choose their origins' })).toBeInTheDocument()
  })

  it('keeps the previous ability draft when explicit saving fails', async () => {
    const user = userEvent.setup()
    const storage = repository({ save: vi.fn().mockRejectedValue(new Error('quota exceeded')) })
    renderPage(storage)

    await user.click(await screen.findByRole('button', { name: 'Abilities' }))
    await screen.findByRole('heading', { name: 'Shape their abilities' })
    const strength = screen.getByRole('spinbutton', { name: /strength/i })
    await user.clear(strength)
    await user.type(strength, '9')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('The previous draft remains intact')
    expect(strength).toHaveValue(9)
  })

  it('autosaves a valid edit after the debounce without advancing the step', async () => {
    const user = userEvent.setup()
    const storage = repository({ get: vi.fn().mockResolvedValue(blankCharacter()) })
    renderPage(storage, undefined, undefined, undefined, undefined, 80)

    await user.type(await screen.findByRole('textbox', { name: 'Character name' }), 'Lyra')

    expect(storage.save).not.toHaveBeenCalled()
    await waitFor(() => expect(storage.save).toHaveBeenCalledTimes(1))
    expect(storage.save).toHaveBeenCalledWith(
      expect.objectContaining({ character: expect.objectContaining({ name: 'Lyra' }) }),
      '2026-09-29T12:00:00.000Z',
    )
    expect(screen.getByRole('heading', { name: 'Name your hero' })).toBeInTheDocument()
    expect(screen.getByText('Draft saved locally.')).toBeInTheDocument()
  })

  it('retries autosave after another edit clears a transient failure', async () => {
    const user = userEvent.setup()
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error('quota exceeded'))
      .mockImplementation(async (document: unknown) => document as StoredCharacterV1)
    const storage = repository({
      get: vi.fn().mockResolvedValue(blankCharacter()),
      save,
    })
    renderPage(storage, undefined, undefined, undefined, undefined, 20)

    const input = await screen.findByRole('textbox', { name: 'Character name' })
    await user.type(input, 'Lyra')
    expect(await screen.findByRole('alert')).toHaveTextContent('previous draft remains intact')

    await user.type(input, ' Moon')

    await waitFor(() => expect(save).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(input).toHaveValue('Lyra Moon')
  })

  it('does not autosave an incomplete step', async () => {
    const user = userEvent.setup()
    const storage = repository()
    renderPage(storage, undefined, undefined, undefined, undefined, 20)

    await user.click(await screen.findByRole('button', { name: 'Abilities' }))
    await user.clear(await screen.findByRole('spinbutton', { name: /strength/i }))
    await new Promise((resolve) => window.setTimeout(resolve, 60))

    expect(storage.save).not.toHaveBeenCalled()
  })

  it('reports a conflicting tab without overwriting its newer draft', async () => {
    const user = userEvent.setup()
    const storage = repository({
      get: vi.fn().mockResolvedValue(blankCharacter()),
      save: vi.fn().mockRejectedValue(new CharacterStorageConflictError()),
    })
    renderPage(storage)

    await user.type(await screen.findByRole('textbox', { name: 'Character name' }), 'Lyra')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A newer draft was saved in another tab',
    )
    expect(screen.getByRole('heading', { name: 'Name your hero' })).toBeInTheDocument()
  })

  it('serializes autosaves and preserves an edit made while a write is pending', async () => {
    const user = userEvent.setup()
    let resolveFirst: ((document: StoredCharacterV1) => void) | undefined
    const save = vi.fn((document: unknown, _expectedUpdatedAt?: string) => {
      const stored = document as StoredCharacterV1
      if (!resolveFirst) {
        return new Promise<StoredCharacterV1>((resolve) => {
          resolveFirst = resolve
        })
      }
      return Promise.resolve(stored)
    })
    const storage = repository({
      get: vi.fn().mockResolvedValue(blankCharacter()),
      save,
    })
    renderPage(storage, undefined, undefined, undefined, undefined, 20)

    const input = await screen.findByRole('textbox', { name: 'Character name' })
    await user.type(input, 'Lyra')
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))

    await user.type(input, ' Moon')
    await new Promise((resolve) => window.setTimeout(resolve, 60))
    expect(save).toHaveBeenCalledTimes(1)

    const firstSaved = save.mock.calls[0][0] as StoredCharacterV1
    await act(async () => resolveFirst?.(firstSaved))

    await waitFor(() => expect(save).toHaveBeenCalledTimes(2))
    expect(save.mock.calls[1][0]).toEqual(
      expect.objectContaining({ character: expect.objectContaining({ name: 'Lyra Moon' }) }),
    )
    expect(save.mock.calls[1][1]).toBe(firstSaved.updatedAt)
    expect(input).toHaveValue('Lyra Moon')
  })

  it('persists canonical species and background references from catalog choices', async () => {
    const user = userEvent.setup()
    const storage = repository()
    renderPage(storage)

    await user.click(await screen.findByRole('button', { name: 'Origins' }))
    await user.click(await screen.findByRole('radio', { name: 'Human' }))
    await user.click(screen.getByRole('radio', { name: 'Sage' }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => expect(storage.save).toHaveBeenCalledTimes(1))
    expect(storage.save).toHaveBeenCalledWith(
      expect.objectContaining({
        character: expect.objectContaining({
          species: { id: 'human', name: 'Human' },
          background: { id: 'sage', name: 'Sage' },
        }),
      }),
      '2026-09-29T12:00:00.000Z',
    )
    expect(await screen.findByRole('heading', { name: 'Choose their class' })).toBeInTheDocument()
  })

  it('requires both origin selections before saving', async () => {
    const user = userEvent.setup()
    const storage = repository({ get: vi.fn().mockResolvedValue(originlessCharacter()) })
    renderPage(storage)

    await screen.findByRole('radio', { name: 'Elf' })
    await user.click(screen.getByRole('button', { name: 'Continue' }))

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
    renderPage(
      repository({ get: vi.fn().mockResolvedValue(originlessCharacter()) }),
      undefined,
      loader,
    )

    expect(await screen.findByText('The origins archive is unavailable')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('radio', { name: 'Human' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Sage' })).toBeInTheDocument()
  })

  it('resumes a saved class and keeps completed earlier steps editable', async () => {
    renderPage(repository())

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Class' }))
    expect(await screen.findByRole('heading', { name: 'Choose their class' })).toBeInTheDocument()
    expect(await screen.findByRole('radio', { name: 'Wizard' })).toBeChecked()

    const steps = within(screen.getByRole('navigation', { name: 'Character creation steps' }))
    expect(steps.getByRole('button', { name: 'Class' })).toHaveAttribute('aria-current', 'step')
    await userEvent.setup().click(steps.getByRole('button', { name: 'Origins' }))
    expect(await screen.findByRole('heading', { name: 'Choose their origins' })).toBeInTheDocument()
  })

  it('persists exactly one stable first-level class reference', async () => {
    const user = userEvent.setup()
    const storage = repository({ get: vi.fn().mockResolvedValue(classlessCharacter()) })
    renderPage(storage)

    await user.click(await screen.findByRole('radio', { name: 'Fighter' }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => expect(storage.save).toHaveBeenCalledTimes(1))
    expect(storage.save).toHaveBeenCalledWith(
      expect.objectContaining({
        updatedAt: '2026-10-01T15:00:00.000Z',
        character: expect.objectContaining({
          classProgressions: [
            { class: { id: 'fighter', name: 'Fighter' }, level: 1, subclass: null },
          ],
        }),
      }),
      '2026-09-29T12:00:00.000Z',
    )
    expect(
      await screen.findByRole('heading', { name: 'Choose their proficiencies' }),
    ).toBeInTheDocument()
  })

  it('persists a canonical Fighting Style and keeps spellcasting alternatives locked', async () => {
    const user = userEvent.setup()
    const storage = repository({ get: vi.fn().mockResolvedValue(classlessCharacter()) })
    const featureChoicesLoader: FeatureChoicesLoader = vi.fn((classId: string) =>
      Promise.resolve<FeatureChoiceDocument>({
        manifestVersion: 'SRD-5.2.1-CF-1',
        ruleset: '2024',
        rulesVersion: 'SRD-5.2.1',
        class: { id: classId, name: 'Fighter' },
        requirements:
          classId === 'fighter'
            ? [
                {
                  id: 'fighter-fighting-style',
                  subclassId: null,
                  featureId: 'fighter-fighting-style',
                  availableAtLevel: 1,
                  count: 1,
                  branches: [
                    {
                      id: 'fighting-style-feat',
                      selectionCount: 1,
                      optionSource: 'featType',
                      availability: 'supported',
                      dependency: null,
                      options: [
                        { id: 'archery', name: 'Archery' },
                        { id: 'defense', name: 'Defense' },
                      ],
                    },
                    {
                      id: 'blessed-warrior',
                      selectionCount: 2,
                      optionSource: 'classCantrips',
                      availability: 'locked',
                      dependency: 'spellcasting',
                      options: [],
                    },
                  ],
                },
              ]
            : [],
      }),
    )
    renderPage(
      storage,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      featureChoicesLoader,
    )

    await user.click(await screen.findByRole('radio', { name: 'Fighter' }))
    await user.click(await screen.findByRole('radio', { name: 'Archery' }))
    expect(screen.getByText('Blessed Warrior')).toBeInTheDocument()
    expect(screen.getByText(/after Spellcasting is implemented/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => expect(storage.save).toHaveBeenCalledTimes(1))
    expect(storage.save).toHaveBeenCalledWith(
      expect.objectContaining({
        character: expect.objectContaining({
          featureChoices: [
            {
              requirementId: 'fighter-fighting-style',
              branchId: 'fighting-style-feat',
              selections: [{ id: 'archery', name: 'Archery' }],
            },
          ],
        }),
      }),
      '2026-09-29T12:00:00.000Z',
    )
  })

  it('derives and persists Expertise from resolved skill proficiencies', async () => {
    const user = userEvent.setup()
    const storage = repository({ get: vi.fn().mockResolvedValue(classlessCharacter()) })
    const featureChoicesLoader = bardFeatureChoicesLoader()
    renderPage(
      storage,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      featureChoicesLoader,
    )

    await user.click(await screen.findByRole('radio', { name: 'Bard' }))
    await user.selectOptions(
      await screen.findByRole('combobox', { name: 'Current class level' }),
      '2',
    )
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    const bardSkills = await screen.findByRole('group', { name: 'Choose three Bard skills' })
    await user.click(within(bardSkills).getByRole('checkbox', { name: 'Skill: Arcana' }))
    await user.click(within(bardSkills).getByRole('checkbox', { name: 'Skill: Performance' }))
    await user.click(within(bardSkills).getByRole('checkbox', { name: 'Skill: Persuasion' }))
    const keenSense = screen.getByRole('group', { name: 'Choose one keen sense' })
    await user.click(within(keenSense).getByRole('checkbox', { name: 'Skill: Insight' }))

    const expertise = await screen.findByRole('group', { name: 'Expertise gained at level 2' })
    await user.click(within(expertise).getByRole('checkbox', { name: 'Skill: Performance' }))
    await user.click(within(expertise).getByRole('checkbox', { name: 'Skill: Persuasion' }))
    await user.click(screen.getByRole('button', { name: 'Continue to review' }))

    await waitFor(() => expect(storage.save).toHaveBeenCalledTimes(2))
    expect(storage.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        character: expect.objectContaining({
          featureChoices: [
            {
              requirementId: 'bard-expertise-2',
              branchId: 'expertise-skills',
              selections: [
                { id: 'skill-performance', name: 'Skill: Performance' },
                { id: 'skill-persuasion', name: 'Skill: Persuasion' },
              ],
            },
          ],
        }),
      }),
      '2026-10-01T15:00:00.000Z',
    )
    expect(
      await screen.findByRole('heading', { name: 'Review your character' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Skill: Performance, Skill: Persuasion')).toBeInTheDocument()
  })

  it('retains Expertise after a level decrease until explicit removal', async () => {
    const user = userEvent.setup()
    const source = createStoredCharacter()
    const bard = {
      ...source,
      character: {
        ...source.character,
        classProgressions: [{ class: { id: 'bard', name: 'Bard' }, level: 2, subclass: null }],
        proficiencyChoices: [
          {
            choiceId: 'classes/bard/proficiencies/0',
            selections: [
              { id: 'skill-arcana', name: 'Skill: Arcana' },
              { id: 'skill-performance', name: 'Skill: Performance' },
              { id: 'skill-persuasion', name: 'Skill: Persuasion' },
            ],
          },
          {
            choiceId: 'species/elf/traits/keen-senses/proficiencies/0',
            selections: [{ id: 'skill-insight', name: 'Skill: Insight' }],
          },
        ],
        featureChoices: [
          {
            requirementId: 'bard-expertise-2',
            branchId: 'expertise-skills',
            selections: [
              { id: 'skill-performance', name: 'Skill: Performance' },
              { id: 'skill-persuasion', name: 'Skill: Persuasion' },
            ],
          },
        ],
      },
    } satisfies StoredCharacterV1
    const storage = repository({ get: vi.fn().mockResolvedValue(bard) })
    renderPage(
      storage,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      bardFeatureChoicesLoader(),
    )

    await screen.findByText(/Validated against SRD-5.2.1/)
    await user.click(screen.getByRole('button', { name: 'Class' }))
    await user.selectOptions(
      await screen.findByRole('combobox', { name: 'Current class level' }),
      '1',
    )
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByText('An earlier Expertise choice is retained.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove outdated Expertise' })).toBeInTheDocument()
    expect(storage.save).toHaveBeenCalledWith(
      expect.objectContaining({
        character: expect.objectContaining({
          classProgressions: [{ class: { id: 'bard', name: 'Bard' }, level: 1, subclass: null }],
          featureChoices: bard.character.featureChoices,
        }),
      }),
      source.updatedAt,
    )
  })

  it('persists a trusted level and subclass and shows their unlocked features', async () => {
    const user = userEvent.setup()
    const storage = repository()
    renderPage(storage)

    await user.click(await screen.findByRole('button', { name: 'Class' }))
    const level = await screen.findByRole('combobox', { name: 'Current class level' })
    const evoker = screen.getByRole('radio', { name: /Evoker/ })
    expect(evoker).toBeDisabled()
    expect(screen.getByText('Available at level 3')).toBeInTheDocument()

    await user.selectOptions(level, '3')
    expect(evoker).toBeEnabled()
    await user.click(evoker)
    expect(screen.getByText('Wizard Subclass')).toBeInTheDocument()
    expect(screen.getByText('Sculpt Spells')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => expect(storage.save).toHaveBeenCalledTimes(1))
    expect(storage.save).toHaveBeenCalledWith(
      expect.objectContaining({
        character: expect.objectContaining({
          classProgressions: [
            {
              class: { id: 'wizard', name: 'Wizard' },
              level: 3,
              subclass: { id: 'evoker', name: 'Evoker' },
            },
          ],
        }),
      }),
      '2026-09-29T12:00:00.000Z',
    )
  })

  it('retains a subclass when level drops and offers explicit removal', async () => {
    const user = userEvent.setup()
    const leveledCharacter = createStoredCharacter()
    const storage = repository({
      get: vi.fn().mockResolvedValue({
        ...leveledCharacter,
        character: {
          ...leveledCharacter.character,
          classProgressions: [
            {
              class: { id: 'wizard', name: 'Wizard' },
              level: 3,
              subclass: { id: 'evoker', name: 'Evoker' },
            },
          ],
        },
      }),
    })
    renderPage(storage)

    await user.click(await screen.findByRole('button', { name: 'Class' }))
    await user.selectOptions(
      await screen.findByRole('combobox', { name: 'Current class level' }),
      '2',
    )

    expect(screen.getByRole('radio', { name: /Evoker/ })).toBeChecked()
    expect(screen.getByText(/Evoker is retained/)).toBeInTheDocument()
    expect(screen.getByText(/requires level 3/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => expect(storage.save).toHaveBeenCalledTimes(1))
    expect(storage.save).toHaveBeenCalledWith(
      expect.objectContaining({
        character: expect.objectContaining({
          classProgressions: [
            expect.objectContaining({
              level: 2,
              subclass: { id: 'evoker', name: 'Evoker' },
            }),
          ],
        }),
      }),
      '2026-09-29T12:00:00.000Z',
    )
  })

  it('removes a retained subclass only through the explicit action', async () => {
    const user = userEvent.setup()
    const leveledCharacter = createStoredCharacter()
    const storage = repository({
      get: vi.fn().mockResolvedValue({
        ...leveledCharacter,
        character: {
          ...leveledCharacter.character,
          classProgressions: [
            {
              class: { id: 'wizard', name: 'Wizard' },
              level: 2,
              subclass: { id: 'evoker', name: 'Evoker' },
            },
          ],
        },
      }),
    })
    renderPage(storage)

    expect(await screen.findByText(/Evoker is retained/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remove subclass' }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => expect(storage.save).toHaveBeenCalledTimes(1))
    expect(storage.save).toHaveBeenCalledWith(
      expect.objectContaining({
        character: expect.objectContaining({
          classProgressions: [expect.objectContaining({ level: 2, subclass: null })],
        }),
      }),
      '2026-09-29T12:00:00.000Z',
    )
  })

  it('requires a catalog class before saving', async () => {
    const user = userEvent.setup()
    const storage = repository({ get: vi.fn().mockResolvedValue(classlessCharacter()) })
    renderPage(storage)

    await screen.findByRole('radio', { name: 'Fighter' })
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(screen.getByText('Choose an available class.')).toBeInTheDocument()
    expect(storage.save).not.toHaveBeenCalled()
  })

  it('recovers the class list after a provider failure', async () => {
    const user = userEvent.setup()
    const loader = vi
      .fn<CatalogLoader>()
      .mockRejectedValueOnce(new Error('provider unavailable'))
      .mockResolvedValue(catalogPage('classes'))
    renderPage(
      repository({ get: vi.fn().mockResolvedValue(classlessCharacter()) }),
      undefined,
      loader,
    )

    expect(await screen.findByText('The class archive is unavailable')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('radio', { name: 'Fighter' })).toBeInTheDocument()
    expect(loader).toHaveBeenCalledWith('classes', { page: 1, pageSize: 48 }, expect.anything())
  })

  it('recovers the selected class progression without changing the local draft', async () => {
    const user = userEvent.setup()
    const storage = repository()
    const progressionLoader = vi
      .fn<ClassProgressionLoader>()
      .mockRejectedValueOnce(new Error('provider unavailable'))
      .mockResolvedValue(classProgression('wizard'))
    renderPage(storage, undefined, undefined, undefined, undefined, undefined, progressionLoader)

    await user.click(await screen.findByRole('button', { name: 'Class' }))
    expect(await screen.findByText('The class progression is unavailable.')).toBeInTheDocument()
    expect(storage.save).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('combobox', { name: 'Current class level' })).toBeInTheDocument()
    expect(progressionLoader).toHaveBeenCalledTimes(2)
  })

  it('resumes saved proficiency choices from all selected catalog details', async () => {
    const user = userEvent.setup()
    const itemLoader = defaultCatalogItemLoader()
    renderPage(repository(), undefined, undefined, itemLoader)

    await screen.findByRole('heading', { name: 'Review your character' })
    await user.click(screen.getByRole('button', { name: 'Proficiencies' }))
    const classChoice = await screen.findByRole('group', { name: 'Choose two class skills' })
    const speciesChoice = screen.getByRole('group', { name: 'Choose one keen sense' })
    expect(within(classChoice).getByRole('checkbox', { name: 'Skill: Arcana' })).toBeChecked()
    expect(within(classChoice).getByRole('checkbox', { name: 'Skill: History' })).toBeChecked()
    expect(within(speciesChoice).getByRole('checkbox', { name: 'Skill: Perception' })).toBeChecked()
    expect(screen.getByText('Simple Weapons')).toBeInTheDocument()
    expect(itemLoader).toHaveBeenCalledWith('classes', 'wizard', expect.anything())
    expect(itemLoader).toHaveBeenCalledWith('species', 'elf', expect.anything())
    expect(itemLoader).toHaveBeenCalledWith('backgrounds', 'acolyte', expect.anything())
  })

  it('persists canonical proficiency choice ids, names, and a new timestamp', async () => {
    const user = userEvent.setup()
    const storage = repository({ get: vi.fn().mockResolvedValue(proficiencylessCharacter()) })
    renderPage(storage)

    const classChoice = await screen.findByRole('group', { name: 'Choose two class skills' })
    const speciesChoice = screen.getByRole('group', { name: 'Choose one keen sense' })
    await user.click(within(classChoice).getByRole('checkbox', { name: 'Skill: Arcana' }))
    await user.click(within(classChoice).getByRole('checkbox', { name: 'Skill: History' }))
    await user.click(within(speciesChoice).getByRole('checkbox', { name: 'Skill: Perception' }))
    await user.click(screen.getByRole('button', { name: 'Continue to review' }))

    await waitFor(() => expect(storage.save).toHaveBeenCalledTimes(1))
    expect(storage.save).toHaveBeenCalledWith(
      expect.objectContaining({
        updatedAt: '2026-10-01T15:00:00.000Z',
        character: expect.objectContaining({
          proficiencyChoices: [
            {
              choiceId: 'classes/wizard/proficiencies/0',
              selections: [
                { id: 'skill-arcana', name: 'Skill: Arcana' },
                { id: 'skill-history', name: 'Skill: History' },
              ],
            },
            {
              choiceId: 'species/elf/traits/keen-senses/proficiencies/0',
              selections: [{ id: 'skill-perception', name: 'Skill: Perception' }],
            },
          ],
        }),
      }),
      '2026-09-29T12:00:00.000Z',
    )
    expect(
      await screen.findByRole('heading', { name: 'Review your character' }),
    ).toBeInTheDocument()
  })

  it('requires exact counts and rejects a proficiency selected from two sources', async () => {
    const user = userEvent.setup()
    const storage = repository({ get: vi.fn().mockResolvedValue(proficiencylessCharacter()) })
    renderPage(storage)

    const classChoice = await screen.findByRole('group', { name: 'Choose two class skills' })
    const speciesChoice = screen.getByRole('group', { name: 'Choose one keen sense' })
    expect(screen.queryByRole('button', { name: 'Review' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Continue to review' }))
    expect(screen.getByText('Choose exactly 2 distinct options.')).toBeInTheDocument()
    expect(screen.getByText('Choose exactly 1 distinct option.')).toBeInTheDocument()

    await user.click(within(classChoice).getByRole('checkbox', { name: 'Skill: History' }))
    await user.click(within(classChoice).getByRole('checkbox', { name: 'Skill: Perception' }))
    await user.click(within(speciesChoice).getByRole('checkbox', { name: 'Skill: Perception' }))
    await user.click(screen.getByRole('button', { name: 'Continue to review' }))

    expect(
      screen.getByText('Skill: Perception is already granted or selected elsewhere.'),
    ).toBeInTheDocument()
    expect(storage.save).not.toHaveBeenCalled()
  })

  it('surfaces stale choices and disallowed saved options until explicitly removed', async () => {
    const user = userEvent.setup()
    const character = proficiencylessCharacter()
    character.character.proficiencyChoices = [
      {
        choiceId: 'classes/wizard/proficiencies/0',
        selections: [{ id: 'skill-old-lore', name: 'Skill: Old Lore' }],
      },
      {
        choiceId: 'classes/old-class/proficiencies/0',
        selections: [{ id: 'skill-stealth', name: 'Skill: Stealth' }],
      },
    ]
    const storage = repository({ get: vi.fn().mockResolvedValue(character) })
    renderPage(storage)

    expect(await screen.findByText('Skill: Old Lore')).toBeInTheDocument()
    expect(screen.getByText('No longer available — uncheck to remove')).toBeInTheDocument()
    expect(
      screen.getByText('An earlier proficiency choice is no longer required.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Skill: Stealth')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Continue to review' }))
    expect(
      screen.getByText('Remove outdated choices before saving these proficiencies.'),
    ).toBeInTheDocument()
    expect(storage.save).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Remove outdated choice' }))
    await user.click(screen.getByRole('checkbox', { name: /Skill: Old Lore/i }))
    expect(screen.queryByText('Skill: Stealth')).not.toBeInTheDocument()
    expect(screen.queryByText('Skill: Old Lore')).not.toBeInTheDocument()
  })

  it('recovers all proficiency details after provider failures', async () => {
    const user = userEvent.setup()
    const attempts = new Map<string, number>()
    const itemLoader = vi.fn((category: CatalogCategory, id: string) => {
      if (category !== 'classes' && category !== 'species' && category !== 'backgrounds') {
        return Promise.reject(new Error('unexpected category'))
      }
      const key = `${category}/${id}`
      const attempt = (attempts.get(key) ?? 0) + 1
      attempts.set(key, attempt)
      return attempt === 1
        ? Promise.reject(new Error('provider unavailable'))
        : Promise.resolve(catalogItem(category, id))
    })
    renderPage(
      repository({ get: vi.fn().mockResolvedValue(proficiencylessCharacter()) }),
      undefined,
      undefined,
      itemLoader,
    )

    expect(await screen.findByText('The proficiency rules are unavailable')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(
      await screen.findByRole('group', { name: 'Choose two class skills' }),
    ).toBeInTheDocument()
    expect(itemLoader).toHaveBeenCalledTimes(6)
  })

  it('resumes a complete draft at Review and presents trusted derived values', async () => {
    const validationLoader = defaultValidationLoader()
    const character = createStoredCharacter()
    renderPage(repository(), undefined, undefined, undefined, validationLoader)

    expect(
      await screen.findByRole('heading', { name: 'Review your character' }),
    ).toBeInTheDocument()
    expect(await screen.findByText(/Validated against SRD-5.2.1/)).toBeInTheDocument()
    const derived = screen.getByRole('region', { name: 'Derived statistics' })
    expect(within(derived).getByText('Armor class')).toBeInTheDocument()
    expect(within(derived).getByText('12')).toBeInTheDocument()
    expect(within(derived).getByText('7')).toBeInTheDocument()
    expect(within(derived).getByText('+2')).toBeInTheDocument()
    expect(within(derived).getByText('Spell save DC')).toBeInTheDocument()
    expect(within(derived).getByText('11')).toBeInTheDocument()
    expect(within(derived).getByText('Spell attack')).toBeInTheDocument()
    expect(within(derived).getByText('+3')).toBeInTheDocument()
    expect(within(derived).getAllByText('d6')).toHaveLength(2)
    expect(screen.getByText('Skill: Arcana')).toBeInTheDocument()
    expect(validationLoader).toHaveBeenCalledWith(character, expect.anything())

    const steps = within(screen.getByRole('navigation', { name: 'Character creation steps' }))
    expect(steps.getByRole('button', { name: 'Review' })).toHaveAttribute('aria-current', 'step')
  })

  it('routes structured validation feedback back to its editable builder step', async () => {
    const user = userEvent.setup()
    const validationLoader = vi.fn().mockResolvedValue({
      validation: {
        isValid: false,
        violations: [
          {
            code: 'character.proficiencyChoice.selection.duplicate',
            message: 'Skill: Perception is already granted.',
            source: 'proficiencyChoices[1].selections[0]',
            severity: 'error',
            requirement: 'Choose a different allowed proficiency.',
          },
        ],
      },
      derived: null,
    } satisfies CharacterEvaluation)
    const storage = repository()
    renderPage(storage, undefined, undefined, undefined, validationLoader)

    expect(await screen.findByText('This character still needs attention')).toBeInTheDocument()
    expect(screen.getByText('Skill: Perception is already granted.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Edit Proficiencies' }))

    expect(
      await screen.findByRole('heading', { name: 'Choose their proficiencies' }),
    ).toBeInTheDocument()
    expect(storage.save).not.toHaveBeenCalled()
  })

  it('persists exact canonical spell selections from the class list', async () => {
    const user = userEvent.setup()
    const storage = repository({ get: vi.fn().mockResolvedValue(bardSpellcaster()) })
    const catalogLoader = vi.fn<CatalogLoader>((category) => {
      if (category === 'spells') return Promise.resolve(spellCatalogPage())
      if (category === 'classes' || category === 'species' || category === 'backgrounds') {
        return Promise.resolve(catalogPage(category))
      }
      return Promise.reject(new Error(`Unexpected category: ${category}`))
    })
    const progressionLoader = vi
      .fn<ClassProgressionLoader>()
      .mockResolvedValue(bardSpellProgression())
    renderPage(
      storage,
      undefined,
      catalogLoader,
      undefined,
      undefined,
      undefined,
      progressionLoader,
    )

    expect(await screen.findByRole('heading', { name: 'Choose their spells' })).toBeInTheDocument()
    await user.click(await screen.findByRole('checkbox', { name: /Dancing Lights/ }))
    await user.click(screen.getByRole('checkbox', { name: /^Light/ }))
    await user.click(screen.getByRole('checkbox', { name: /Charm Person/ }))
    await user.click(screen.getByRole('checkbox', { name: /Cure Wounds/ }))
    await user.click(screen.getByRole('checkbox', { name: /Detect Magic/ }))
    await user.click(screen.getByRole('checkbox', { name: /Heroism/ }))
    expect(screen.queryByRole('checkbox', { name: /Shatter/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Review character' }))

    await waitFor(() => expect(storage.save).toHaveBeenCalledTimes(1))
    expect(storage.save).toHaveBeenCalledWith(
      expect.objectContaining({
        character: expect.objectContaining({
          spells: {
            cantrips: [
              { id: 'dancing-lights', name: 'Dancing Lights' },
              { id: 'light', name: 'Light' },
            ],
            preparedSpells: [
              { id: 'charm-person', name: 'Charm Person' },
              { id: 'cure-wounds', name: 'Cure Wounds' },
              { id: 'detect-magic', name: 'Detect Magic' },
              { id: 'heroism', name: 'Heroism' },
            ],
          },
        }),
      }),
      '2026-09-29T12:00:00.000Z',
    )
    expect(catalogLoader).toHaveBeenCalledWith(
      'spells',
      { page: 1, pageSize: 48, characterClass: 'bard', sort: 'level' },
      expect.anything(),
    )
    expect(
      await screen.findByRole('heading', { name: 'Review your character' }),
    ).toBeInTheDocument()
  })

  it('retries canonical validation without changing the local draft', async () => {
    const user = userEvent.setup()
    const validationLoader = vi
      .fn<CharacterValidationLoader>()
      .mockRejectedValueOnce(new Error('provider unavailable'))
      .mockResolvedValue(validEvaluation())
    const storage = repository()
    renderPage(storage, undefined, undefined, undefined, validationLoader)

    expect(await screen.findByText('The character could not be validated')).toBeInTheDocument()
    expect(screen.getByText(/Your local draft is unchanged/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText(/Validated against SRD-5.2.1/)).toBeInTheDocument()
    expect(validationLoader).toHaveBeenCalledTimes(2)
    expect(storage.save).not.toHaveBeenCalled()
  })

  it('keeps completed steps editable from the validated review', async () => {
    const user = userEvent.setup()
    renderPage(repository())

    await screen.findByText(/Validated against SRD-5.2.1/)
    await user.click(screen.getByRole('button', { name: 'Edit origins' }))

    expect(await screen.findByRole('heading', { name: 'Choose their origins' })).toBeInTheDocument()
  })
})
