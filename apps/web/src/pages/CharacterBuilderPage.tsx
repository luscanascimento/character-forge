import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  HeartPulse,
  LockKeyhole,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import type {
  CatalogCategory,
  CatalogFilters,
  CatalogItem,
  CatalogPage,
} from '../features/catalog/catalog'
import { getCatalogItem, getCatalogPage } from '../features/catalog/catalogApi'
import {
  abilityModifierPreview,
  formatModifier,
  maximumAbilityScore,
  minimumAbilityScore,
} from '../features/characters/abilityScores'
import {
  CharacterStorage,
  CharacterStorageDataError,
} from '../features/characters/characterStorage'
import { validateCharacter } from '../features/characters/characterApi'
import type {
  CharacterEvaluation,
  StoredCharacterV1,
} from '../features/characters/characterSchemas'
import '../styles/builder.css'

type CharacterRepository = Pick<CharacterStorage, 'get' | 'save'>

type CharacterBuilderPageProps = {
  storage?: CharacterRepository
  now?: () => Date
  catalogLoader?: CatalogLoader
  catalogItemLoader?: CatalogItemLoader
  validationLoader?: CharacterValidationLoader
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

const defaultStorage = new CharacterStorage()
const defaultNow = () => new Date()

const builderSteps = [
  ['Name', 'Give your character an identity'],
  ['Abilities', 'Set the six ability scores'],
  ['Origins', 'Choose species and background'],
  ['Class', 'Choose a first-level class'],
  ['Proficiencies', 'Complete required choices'],
  ['Review', 'Validate the finished character'],
] as const

type BuilderStep = 'name' | 'abilities' | 'origins' | 'class' | 'proficiencies' | 'review'
type AbilityScores = NonNullable<StoredCharacterV1['character']['abilities']>
type AbilityKey = keyof AbilityScores
type AbilityInputs = Record<AbilityKey, string>
type AbilityErrors = Partial<Record<AbilityKey, string>>
type ProficiencyInputs = Record<string, string[]>
type ProficiencyErrors = Record<string, string>
type SavedProficiencyChoices = StoredCharacterV1['character']['proficiencyChoices']

type ProficiencyRule = {
  id: string
  prompt: string
  count: number
  options: Array<{ id: string; name: string }>
  sourceName: string
}

type FixedProficiency = {
  id: string
  name: string
  sourceName: string
}

const abilityFields: ReadonlyArray<[AbilityKey, string, string]> = [
  ['strength', 'Strength', 'STR'],
  ['dexterity', 'Dexterity', 'DEX'],
  ['constitution', 'Constitution', 'CON'],
  ['intelligence', 'Intelligence', 'INT'],
  ['wisdom', 'Wisdom', 'WIS'],
  ['charisma', 'Charisma', 'CHA'],
]

export default function CharacterBuilderPage({
  storage = defaultStorage,
  now = defaultNow,
  catalogLoader = getCatalogPage,
  catalogItemLoader = getCatalogItem,
  validationLoader = validateCharacter,
}: CharacterBuilderPageProps) {
  const { characterId } = useParams()
  const characterQuery = useQuery({
    queryKey: ['character', characterId],
    queryFn: () => (characterId ? storage.get(characterId) : Promise.resolve(null)),
    retry: false,
  })

  return (
    <div className="builder-page">
      <header className="builder-header">
        <Link to="/characters">
          <ChevronLeft aria-hidden="true" size={17} />
          My characters
        </Link>
        <div>
          <span>Character builder</span>
          <strong>SRD 5.2.1 · Ruleset 2024</strong>
        </div>
      </header>

      {characterQuery.isPending && <BuilderLoadingState />}
      {characterQuery.isError && (
        <BuilderStorageError
          error={characterQuery.error}
          onRetry={() => void characterQuery.refetch()}
        />
      )}
      {characterQuery.isSuccess && characterQuery.data === null && <CharacterMissingState />}
      {characterQuery.isSuccess && characterQuery.data !== null && (
        <BuilderWorkspace
          document={characterQuery.data}
          storage={storage}
          now={now}
          catalogLoader={catalogLoader}
          catalogItemLoader={catalogItemLoader}
          validationLoader={validationLoader}
        />
      )}
    </div>
  )
}

function BuilderWorkspace({
  document,
  storage,
  now,
  catalogLoader,
  catalogItemLoader,
  validationLoader,
}: {
  document: StoredCharacterV1
  storage: CharacterRepository
  now: () => Date
  catalogLoader: CatalogLoader
  catalogItemLoader: CatalogItemLoader
  validationLoader: CharacterValidationLoader
}) {
  const queryClient = useQueryClient()
  const [selectedStep, setActiveStep] = useState<BuilderStep>(() => resumeStep(document))
  const [reviewResumePending, setReviewResumePending] = useState(
    () => resumeStep(document) === 'proficiencies',
  )
  const [name, setName] = useState(document.character.name)
  const [nameError, setNameError] = useState<string | null>(null)
  const [abilities, setAbilities] = useState<AbilityInputs>(() =>
    abilityInputsFrom(document.character.abilities),
  )
  const [abilityErrors, setAbilityErrors] = useState<AbilityErrors>({})
  const [speciesId, setSpeciesId] = useState(document.character.species?.id ?? '')
  const [backgroundId, setBackgroundId] = useState(document.character.background?.id ?? '')
  const [originErrors, setOriginErrors] = useState<{ species?: string; background?: string }>({})
  const [classId, setClassId] = useState(document.character.classProgressions[0]?.class?.id ?? '')
  const [classError, setClassError] = useState<string | null>(null)
  const [proficiencyInputs, setProficiencyInputs] = useState<ProficiencyInputs>(() =>
    proficiencyInputsFrom(document.character.proficiencyChoices),
  )
  const [proficiencyErrors, setProficiencyErrors] = useState<ProficiencyErrors>({})
  const nameComplete = Boolean(document.character.name.trim())
  const abilitiesComplete = document.character.abilities !== null
  const originsComplete =
    document.character.species !== null && document.character.background !== null
  const classComplete = Boolean(document.character.classProgressions[0]?.class)
  const selectedClass = document.character.classProgressions[0]?.class

  const speciesQuery = useQuery({
    queryKey: ['builder-options', 'species'],
    queryFn: ({ signal }) => catalogLoader('species', { page: 1, pageSize: 48 }, signal),
    enabled: selectedStep === 'origins',
    retry: false,
  })
  const backgroundsQuery = useQuery({
    queryKey: ['builder-options', 'backgrounds'],
    queryFn: ({ signal }) => catalogLoader('backgrounds', { page: 1, pageSize: 48 }, signal),
    enabled: selectedStep === 'origins',
    retry: false,
  })
  const classesQuery = useQuery({
    queryKey: ['builder-options', 'classes'],
    queryFn: ({ signal }) => catalogLoader('classes', { page: 1, pageSize: 48 }, signal),
    enabled: selectedStep === 'class',
    retry: false,
  })
  const classDetailQuery = useQuery({
    queryKey: ['catalog-item', 'classes', selectedClass?.id],
    queryFn: ({ signal }) => catalogItemLoader('classes', selectedClass!.id, signal),
    enabled: selectedStep === 'proficiencies' && Boolean(selectedClass),
    retry: false,
  })
  const speciesDetailQuery = useQuery({
    queryKey: ['catalog-item', 'species', document.character.species?.id],
    queryFn: ({ signal }) => catalogItemLoader('species', document.character.species!.id, signal),
    enabled: selectedStep === 'proficiencies' && Boolean(document.character.species),
    retry: false,
  })
  const backgroundDetailQuery = useQuery({
    queryKey: ['catalog-item', 'backgrounds', document.character.background?.id],
    queryFn: ({ signal }) =>
      catalogItemLoader('backgrounds', document.character.background!.id, signal),
    enabled: selectedStep === 'proficiencies' && Boolean(document.character.background),
    retry: false,
  })
  const creationItems = [
    classDetailQuery.data,
    speciesDetailQuery.data,
    backgroundDetailQuery.data,
  ].filter((item): item is CatalogItem => item !== undefined)
  const proficiencyRules = proficiencyRulesFrom(creationItems)
  const fixedProficiencies = fixedProficienciesFrom(creationItems)
  const proficiencyDetailsReady =
    creationItems.length === 3 && creationItems.every((item) => item.characterCreation)
  const proficiencyComplete =
    proficiencyDetailsReady &&
    validateProficiencyInputs(
      proficiencyRules,
      fixedProficiencies,
      proficiencyInputsFrom(document.character.proficiencyChoices),
    ).success
  const activeStep: BuilderStep =
    reviewResumePending &&
    selectedStep === 'proficiencies' &&
    proficiencyDetailsReady &&
    proficiencyComplete
      ? 'review'
      : selectedStep
  const validationQuery = useQuery({
    queryKey: ['character-validation', document.id, document.updatedAt],
    queryFn: ({ signal }) => validationLoader(document, signal),
    enabled: activeStep === 'review' && proficiencyComplete,
    retry: false,
  })

  function openStep(step: BuilderStep) {
    setReviewResumePending(false)
    setActiveStep(step)
  }

  function cacheSavedDocument(saved: StoredCharacterV1) {
    queryClient.setQueryData(['character', saved.id], saved)
    queryClient.setQueryData<StoredCharacterV1[]>(['characters'], (characters) =>
      characters
        ? [saved, ...characters.filter((character) => character.id !== saved.id)]
        : characters,
    )
  }

  const nameMutation = useMutation({
    mutationFn: (nextName: string) =>
      storage.save({
        ...document,
        updatedAt: now().toISOString(),
        character: { ...document.character, name: nextName },
      }),
    onSuccess: (saved) => {
      setName(saved.character.name)
      cacheSavedDocument(saved)
      setActiveStep('abilities')
    },
  })
  const abilitiesMutation = useMutation({
    mutationFn: (nextAbilities: AbilityScores) =>
      storage.save({
        ...document,
        updatedAt: now().toISOString(),
        character: { ...document.character, abilities: nextAbilities },
      }),
    onSuccess: (saved) => {
      setAbilities(abilityInputsFrom(saved.character.abilities))
      cacheSavedDocument(saved)
      setActiveStep('origins')
    },
  })
  const originsMutation = useMutation({
    mutationFn: ({
      species,
      background,
    }: {
      species: { id: string; name: string }
      background: { id: string; name: string }
    }) =>
      storage.save({
        ...document,
        updatedAt: now().toISOString(),
        character: { ...document.character, species, background },
      }),
    onSuccess: (saved) => {
      setSpeciesId(saved.character.species?.id ?? '')
      setBackgroundId(saved.character.background?.id ?? '')
      cacheSavedDocument(saved)
      setActiveStep('class')
    },
  })
  const classMutation = useMutation({
    mutationFn: (selectedClass: { id: string; name: string }) =>
      storage.save({
        ...document,
        updatedAt: now().toISOString(),
        character: {
          ...document.character,
          classProgressions: [{ class: selectedClass, level: 1 }],
        },
      }),
    onSuccess: (saved) => {
      setClassId(saved.character.classProgressions[0]?.class?.id ?? '')
      cacheSavedDocument(saved)
      setActiveStep('proficiencies')
    },
  })
  const proficienciesMutation = useMutation({
    mutationFn: (proficiencyChoices: SavedProficiencyChoices) =>
      storage.save({
        ...document,
        updatedAt: now().toISOString(),
        character: { ...document.character, proficiencyChoices },
      }),
    onSuccess: (saved) => {
      setProficiencyInputs(proficiencyInputsFrom(saved.character.proficiencyChoices))
      cacheSavedDocument(saved)
      setReviewResumePending(false)
      setActiveStep('review')
    },
  })

  function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedName = name.trim()
    if (!normalizedName) {
      setNameError('Choose a name before saving this step.')
      return
    }

    setNameError(null)
    nameMutation.mutate(normalizedName)
  }

  function saveAbilities(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = parseAbilityInputs(abilities)
    if (!result.success) {
      setAbilityErrors(result.errors)
      return
    }

    setAbilityErrors({})
    abilitiesMutation.mutate(result.scores)
  }

  function saveOrigins(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const species = speciesQuery.data?.items.find((item) => item.id === speciesId)
    const background = backgroundsQuery.data?.items.find((item) => item.id === backgroundId)
    const errors = {
      species: species ? undefined : 'Choose an available species.',
      background: background ? undefined : 'Choose an available background.',
    }
    if (!species || !background) {
      setOriginErrors(errors)
      return
    }

    setOriginErrors({})
    originsMutation.mutate({
      species: { id: species.id, name: species.name },
      background: { id: background.id, name: background.name },
    })
  }

  function saveClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const selectedClass = classesQuery.data?.items.find((item) => item.id === classId)
    if (!selectedClass) {
      setClassError('Choose an available class.')
      return
    }

    setClassError(null)
    classMutation.mutate({ id: selectedClass.id, name: selectedClass.name })
  }

  function saveProficiencies(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = validateProficiencyInputs(
      proficiencyRules,
      fixedProficiencies,
      proficiencyInputs,
    )
    if (!result.success) {
      setProficiencyErrors(result.errors)
      return
    }

    setProficiencyErrors({})
    proficienciesMutation.mutate(result.choices)
  }

  return (
    <div className="builder-layout">
      <aside className="builder-progress">
        <div>
          <p>Forging progress</p>
          <h1>{document.character.name.trim() || 'Untitled character'}</h1>
          <span>Your draft stays in this browser.</span>
        </div>
        <nav aria-label="Character creation steps">
          <ol>
            {builderSteps.map(([label, description], index) => {
              const step: BuilderStep | null =
                index === 0
                  ? 'name'
                  : index === 1
                    ? 'abilities'
                    : index === 2
                      ? 'origins'
                      : index === 3
                        ? 'class'
                        : index === 4
                          ? 'proficiencies'
                          : index === 5
                            ? 'review'
                            : null
              const available =
                step === 'name' ||
                (step === 'abilities' && nameComplete) ||
                (step === 'origins' && nameComplete && abilitiesComplete) ||
                (step === 'class' && nameComplete && abilitiesComplete && originsComplete) ||
                (step === 'proficiencies' &&
                  nameComplete &&
                  abilitiesComplete &&
                  originsComplete &&
                  classComplete) ||
                (step === 'review' && proficiencyComplete)
              const active = step === activeStep
              const complete =
                index === 0
                  ? nameComplete
                  : index === 1
                    ? abilitiesComplete
                    : index === 2
                      ? originsComplete
                      : index === 3
                        ? classComplete
                        : index === 4
                          ? proficiencyComplete
                          : index === 5
                            ? Boolean(validationQuery.data?.validation.isValid)
                            : false
              return (
                <li
                  className={[
                    'builder-step',
                    active ? 'builder-step--active' : '',
                    complete ? 'builder-step--complete' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  key={label}
                >
                  <span className="builder-step__number" aria-hidden="true">
                    {complete && !active ? (
                      <Check size={15} />
                    ) : available ? (
                      String(index + 1).padStart(2, '0')
                    ) : (
                      <LockKeyhole size={14} />
                    )}
                  </span>
                  <div>
                    {available && step ? (
                      <button
                        type="button"
                        aria-current={active ? 'step' : undefined}
                        onClick={() => openStep(step)}
                      >
                        {label}
                      </button>
                    ) : (
                      <strong>{label}</strong>
                    )}
                    <span>{description}</span>
                  </div>
                </li>
              )
            })}
          </ol>
        </nav>
      </aside>

      <section className="builder-workspace" aria-labelledby="builder-step-heading">
        {activeStep === 'name' ? (
          <>
            <BuilderStepHeading
              step={1}
              title="Name your hero"
              description="Start with the name that will identify this character in your local roster."
            />
            <form className="builder-form" onSubmit={saveName} noValidate>
              <label htmlFor="character-name">Character name</label>
              <div className={nameError ? 'builder-input builder-input--error' : 'builder-input'}>
                <ShieldCheck aria-hidden="true" size={20} />
                <input
                  id="character-name"
                  name="name"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value)
                    if (nameError) setNameError(null)
                    if (nameMutation.isError || nameMutation.isSuccess) nameMutation.reset()
                  }}
                  autoComplete="off"
                  aria-describedby={nameError ? 'character-name-error' : 'character-name-help'}
                  aria-invalid={nameError ? true : undefined}
                  placeholder="e.g. Arannis"
                  autoFocus
                />
              </div>
              {nameError ? (
                <span className="builder-field-error" id="character-name-error" role="alert">
                  {nameError}
                </span>
              ) : (
                <span className="builder-field-help" id="character-name-help">
                  You can return and change it later.
                </span>
              )}
              <LocalStorageNotice />
              <SaveError visible={nameMutation.isError} />
              <BuilderActions
                saved={nameMutation.isSuccess && name.trim() === document.character.name}
                pending={nameMutation.isPending}
                label="Save and continue"
              />
            </form>
          </>
        ) : activeStep === 'abilities' ? (
          <>
            <BuilderStepHeading
              step={2}
              title="Shape their abilities"
              description="Enter all six scores. Modifier previews are helpful guides; final calculations remain server-validated."
            />
            <form className="builder-form builder-form--wide" onSubmit={saveAbilities} noValidate>
              <fieldset className="ability-grid">
                <legend className="sr-only">Ability scores</legend>
                {abilityFields.map(([key, label, abbreviation]) => {
                  const value = abilities[key]
                  const modifier = abilityModifierPreview(Number(value))
                  const error = abilityErrors[key]
                  return (
                    <label
                      className={error ? 'ability-field ability-field--error' : 'ability-field'}
                      key={key}
                    >
                      <span>
                        <strong>{label}</strong>
                        <small>{abbreviation}</small>
                      </span>
                      <input
                        name={key}
                        type="number"
                        inputMode="numeric"
                        min={minimumAbilityScore}
                        max={maximumAbilityScore}
                        step="1"
                        value={value}
                        onChange={(event) => {
                          setAbilities((current) => ({ ...current, [key]: event.target.value }))
                          if (error) {
                            setAbilityErrors((current) => ({ ...current, [key]: undefined }))
                          }
                          if (abilitiesMutation.isError || abilitiesMutation.isSuccess) {
                            abilitiesMutation.reset()
                          }
                        }}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={`${key}-${error ? 'error' : 'modifier'}`}
                      />
                      {error ? (
                        <small className="ability-field__error" id={`${key}-error`} role="alert">
                          {error}
                        </small>
                      ) : (
                        <small className="ability-field__modifier" id={`${key}-modifier`}>
                          Modifier {modifier === null ? '—' : formatModifier(modifier)}
                        </small>
                      )}
                    </label>
                  )
                })}
              </fieldset>
              <LocalStorageNotice />
              <SaveError visible={abilitiesMutation.isError} />
              <BuilderActions
                saved={abilitiesMutation.isSuccess}
                pending={abilitiesMutation.isPending}
                label="Save abilities"
              />
            </form>
          </>
        ) : activeStep === 'origins' ? (
          <>
            <BuilderStepHeading
              step={3}
              title="Choose their origins"
              description="Select a species and background from the active SRD 5.2.1 catalog."
            />
            <OriginsStep
              speciesPage={speciesQuery.data}
              backgroundsPage={backgroundsQuery.data}
              pending={speciesQuery.isPending || backgroundsQuery.isPending}
              failed={speciesQuery.isError || backgroundsQuery.isError}
              speciesId={speciesId}
              backgroundId={backgroundId}
              errors={originErrors}
              saved={originsMutation.isSuccess}
              saving={originsMutation.isPending}
              saveFailed={originsMutation.isError}
              onSpeciesChange={(id) => {
                setSpeciesId(id)
                setOriginErrors((current) => ({ ...current, species: undefined }))
                if (originsMutation.isError || originsMutation.isSuccess) originsMutation.reset()
              }}
              onBackgroundChange={(id) => {
                setBackgroundId(id)
                setOriginErrors((current) => ({ ...current, background: undefined }))
                if (originsMutation.isError || originsMutation.isSuccess) originsMutation.reset()
              }}
              onRetry={() => {
                void speciesQuery.refetch()
                void backgroundsQuery.refetch()
              }}
              onSubmit={saveOrigins}
            />
          </>
        ) : activeStep === 'class' ? (
          <>
            <BuilderStepHeading
              step={4}
              title="Choose their class"
              description="Choose the path this character begins at level 1 from the active SRD 5.2.1 catalog."
            />
            <ClassStep
              page={classesQuery.data}
              pending={classesQuery.isPending}
              failed={classesQuery.isError}
              classId={classId}
              error={classError}
              saved={classMutation.isSuccess}
              saving={classMutation.isPending}
              saveFailed={classMutation.isError}
              onClassChange={(id) => {
                setClassId(id)
                setClassError(null)
                if (classMutation.isError || classMutation.isSuccess) classMutation.reset()
              }}
              onRetry={() => void classesQuery.refetch()}
              onSubmit={saveClass}
            />
          </>
        ) : activeStep === 'proficiencies' ? (
          <>
            <BuilderStepHeading
              step={5}
              title="Choose their proficiencies"
              description="Complete every required choice from the selected class and origins. Fixed proficiencies are already included."
            />
            <ProficienciesStep
              rules={proficiencyRules}
              fixedProficiencies={fixedProficiencies}
              savedChoiceNames={savedProficiencyNames(document.character.proficiencyChoices)}
              inputs={proficiencyInputs}
              errors={proficiencyErrors}
              pending={
                classDetailQuery.isPending ||
                speciesDetailQuery.isPending ||
                backgroundDetailQuery.isPending
              }
              failed={
                classDetailQuery.isError ||
                speciesDetailQuery.isError ||
                backgroundDetailQuery.isError ||
                (creationItems.length === 3 && !proficiencyDetailsReady)
              }
              saved={proficienciesMutation.isSuccess}
              saving={proficienciesMutation.isPending}
              saveFailed={proficienciesMutation.isError}
              onToggle={(choiceId, optionId, checked) => {
                setProficiencyInputs((current) => {
                  const selections = current[choiceId] ?? []
                  return {
                    ...current,
                    [choiceId]: checked
                      ? [...new Set([...selections, optionId])]
                      : selections.filter((id) => id !== optionId),
                  }
                })
                setProficiencyErrors((current) => omitKey(omitKey(current, choiceId), '_form'))
                if (proficienciesMutation.isError || proficienciesMutation.isSuccess) {
                  proficienciesMutation.reset()
                }
              }}
              onRemoveChoice={(choiceId) => {
                setProficiencyInputs((current) => omitKey(current, choiceId))
                setProficiencyErrors((current) => omitKey(omitKey(current, choiceId), '_form'))
                if (proficienciesMutation.isError || proficienciesMutation.isSuccess) {
                  proficienciesMutation.reset()
                }
              }}
              onRetry={() => {
                void classDetailQuery.refetch()
                void speciesDetailQuery.refetch()
                void backgroundDetailQuery.refetch()
              }}
              onSubmit={saveProficiencies}
            />
          </>
        ) : (
          <>
            <BuilderStepHeading
              step={6}
              title="Review your character"
              description="Character Forge validates this local draft against the active rules before presenting trusted derived values."
            />
            <ReviewStep
              document={document}
              evaluation={validationQuery.data}
              pending={validationQuery.isPending}
              failed={validationQuery.isError}
              onRetry={() => void validationQuery.refetch()}
              onEdit={openStep}
            />
          </>
        )}
      </section>
    </div>
  )
}

function ReviewStep({
  document,
  evaluation,
  pending,
  failed,
  onRetry,
  onEdit,
}: {
  document: StoredCharacterV1
  evaluation?: CharacterEvaluation
  pending: boolean
  failed: boolean
  onRetry: () => void
  onEdit: (step: BuilderStep) => void
}) {
  if (pending) {
    return (
      <div className="origin-state" role="status">
        <span aria-hidden="true">✦</span>
        <strong>Validating your character…</strong>
        <p>Checking this local draft against the active SRD 5.2.1 rules.</p>
      </div>
    )
  }

  if (failed || !evaluation) {
    return (
      <div className="origin-state origin-state--error" role="alert">
        <AlertTriangle aria-hidden="true" size={30} />
        <strong>The character could not be validated</strong>
        <p>Your local draft is unchanged. Try the rules service again when it is available.</p>
        <button className="button button--secondary" type="button" onClick={onRetry}>
          <RefreshCw aria-hidden="true" size={17} />
          Try again
        </button>
      </div>
    )
  }

  if (evaluation.validation.isValid && !evaluation.derived) {
    return (
      <div className="origin-state origin-state--error" role="alert">
        <AlertTriangle aria-hidden="true" size={30} />
        <strong>Trusted character values are unavailable</strong>
        <p>Your local draft is unchanged. Ask the rules service to validate it again.</p>
        <button className="button button--secondary" type="button" onClick={onRetry}>
          <RefreshCw aria-hidden="true" size={17} />
          Try again
        </button>
      </div>
    )
  }

  if (!evaluation.validation.isValid) {
    return (
      <div className="review-invalid" role="alert">
        <AlertTriangle aria-hidden="true" size={28} />
        <div>
          <h3>This character still needs attention</h3>
          <p>The draft remains saved locally. Review the rules feedback below.</p>
        </div>
        <ul>
          {evaluation.validation.violations.map((violation, index) => {
            const step = stepForViolation(violation.source)
            return (
              <li key={`${violation.code}-${violation.source}-${index}`}>
                <div>
                  <strong>{violation.message}</strong>
                  <span>{violation.requirement}</span>
                </div>
                {step && (
                  <button type="button" onClick={() => onEdit(step)}>
                    Edit {builderStepLabel(step)}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  const derived = evaluation.derived!
  const selectedClass = document.character.classProgressions[0]

  return (
    <div className="review-sheet">
      <header className="review-hero">
        <div>
          <p>Level 1 character</p>
          <h3>{document.character.name}</h3>
          <span>
            {document.character.species?.name} · {selectedClass?.class?.name}
          </span>
        </div>
        <ShieldCheck aria-label="Valid character" size={38} />
      </header>

      <section className="review-section" aria-labelledby="review-identity-heading">
        <div className="review-section__heading">
          <h4 id="review-identity-heading">Character choices</h4>
          <button type="button" onClick={() => onEdit('origins')}>
            Edit origins
          </button>
        </div>
        <dl className="review-choices">
          <div>
            <dt>Species</dt>
            <dd>{document.character.species?.name}</dd>
          </div>
          <div>
            <dt>Background</dt>
            <dd>{document.character.background?.name}</dd>
          </div>
          <div>
            <dt>Class</dt>
            <dd>{selectedClass?.class?.name}</dd>
          </div>
          <div>
            <dt>Level</dt>
            <dd>{selectedClass?.level}</dd>
          </div>
        </dl>
      </section>

      <section className="review-section" aria-labelledby="review-abilities-heading">
        <div className="review-section__heading">
          <h4 id="review-abilities-heading">Ability scores</h4>
          <button type="button" onClick={() => onEdit('abilities')}>
            Edit abilities
          </button>
        </div>
        <dl className="review-abilities">
          {abilityFields.map(([key, , abbreviation]) => (
            <div key={key}>
              <dt>{abbreviation}</dt>
              <dd>{document.character.abilities?.[key]}</dd>
              <span>{formatModifier(derived.abilityModifiers[key])}</span>
            </div>
          ))}
        </dl>
      </section>

      <section className="review-derived" aria-label="Derived statistics">
        <div>
          <ShieldCheck aria-hidden="true" size={20} />
          <span>Armor class</span>
          <strong>{derived.armorClass}</strong>
        </div>
        <div>
          <HeartPulse aria-hidden="true" size={20} />
          <span>Hit points</span>
          <strong>{derived.hitPointMaximum ?? '—'}</strong>
        </div>
        <div>
          <Sparkles aria-hidden="true" size={20} />
          <span>Proficiency bonus</span>
          <strong>{formatModifier(derived.proficiencyBonus)}</strong>
        </div>
        <div>
          <span aria-hidden="true" className="review-derived__die">
            d{derived.hitDie}
          </span>
          <span>Hit die</span>
          <strong>d{derived.hitDie}</strong>
        </div>
      </section>

      <section className="review-section" aria-labelledby="review-proficiencies-heading">
        <div className="review-section__heading">
          <h4 id="review-proficiencies-heading">Proficiencies</h4>
          <button type="button" onClick={() => onEdit('proficiencies')}>
            Edit proficiencies
          </button>
        </div>
        <ul className="review-proficiencies">
          {derived.grantedProficiencies.map((grant) => (
            <li key={grant.proficiency.id}>
              <strong>{grant.proficiency.name}</strong>
              <span>{grant.sources.map((source) => source.selection.name).join(', ')}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="review-trust">
        <ShieldCheck aria-hidden="true" size={16} /> Validated against {document.rulesVersion}. Your
        draft remains stored only in this browser.
      </p>
    </div>
  )
}

function ProficienciesStep({
  rules,
  fixedProficiencies,
  savedChoiceNames,
  inputs,
  errors,
  pending,
  failed,
  saved,
  saving,
  saveFailed,
  onToggle,
  onRemoveChoice,
  onRetry,
  onSubmit,
}: {
  rules: ProficiencyRule[]
  fixedProficiencies: FixedProficiency[]
  savedChoiceNames: Record<string, Record<string, string>>
  inputs: ProficiencyInputs
  errors: ProficiencyErrors
  pending: boolean
  failed: boolean
  saved: boolean
  saving: boolean
  saveFailed: boolean
  onToggle: (choiceId: string, optionId: string, checked: boolean) => void
  onRemoveChoice: (choiceId: string) => void
  onRetry: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  if (pending) {
    return (
      <div className="origin-state" role="status">
        <span aria-hidden="true">✦</span>
        <strong>Gathering proficiency choices…</strong>
        <p>Resolving the selected class, species, and background from the active catalog.</p>
      </div>
    )
  }

  if (failed) {
    return (
      <div className="origin-state origin-state--error" role="alert">
        <AlertTriangle aria-hidden="true" size={30} />
        <strong>The proficiency rules are unavailable</strong>
        <p>Your local draft is safe. Try resolving its class and origins again.</p>
        <button className="button button--secondary" type="button" onClick={onRetry}>
          <RefreshCw aria-hidden="true" size={17} />
          Try again
        </button>
      </div>
    )
  }

  const ruleIds = new Set(rules.map((rule) => rule.id))
  const staleChoiceIds = Object.keys(inputs).filter((choiceId) => !ruleIds.has(choiceId))

  return (
    <form className="builder-form builder-form--wide" onSubmit={onSubmit} noValidate>
      {fixedProficiencies.length > 0 && (
        <section className="proficiency-grants" aria-labelledby="fixed-proficiencies-heading">
          <h3 id="fixed-proficiencies-heading">Already granted</h3>
          <ul>
            {fixedProficiencies.map((proficiency) => (
              <li key={`${proficiency.sourceName}-${proficiency.id}`}>
                <Check aria-hidden="true" size={14} />
                <span>
                  <strong>{proficiency.name}</strong>
                  <small>{proficiency.sourceName}</small>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {staleChoiceIds.map((choiceId) => (
        <div className="proficiency-stale" key={choiceId} role="alert">
          <AlertTriangle aria-hidden="true" size={18} />
          <div>
            <strong>An earlier proficiency choice is no longer required.</strong>
            <span>
              {(inputs[choiceId] ?? [])
                .map((id) => savedChoiceNames[choiceId]?.[id] ?? id)
                .join(', ') || choiceId}
            </span>
          </div>
          <button type="button" onClick={() => onRemoveChoice(choiceId)}>
            Remove outdated choice
          </button>
        </div>
      ))}

      {rules.length === 0 ? (
        <div className="proficiency-empty">
          <Check aria-hidden="true" size={20} />
          <p>
            <strong>No additional choices are required.</strong>
            Fixed proficiencies from the selected class and origins are applied automatically.
          </p>
        </div>
      ) : (
        <div className="proficiency-rules">
          {rules.map((rule) => {
            const selectedIds = inputs[rule.id] ?? []
            const optionIds = new Set(rule.options.map((option) => option.id))
            const invalidIds = [...new Set(selectedIds.filter((id) => !optionIds.has(id)))]
            return (
              <fieldset
                className={
                  errors[rule.id] ? 'proficiency-rule proficiency-rule--error' : 'proficiency-rule'
                }
                key={rule.id}
              >
                <legend>{rule.prompt}</legend>
                <p>
                  {rule.sourceName} · Choose exactly {rule.count}
                </p>
                <div className="proficiency-options">
                  {invalidIds.map((id) => (
                    <label className="proficiency-option--stale" key={id}>
                      <input
                        type="checkbox"
                        checked
                        onChange={() => onToggle(rule.id, id, false)}
                      />
                      <span aria-hidden="true">
                        <AlertTriangle size={14} />
                      </span>
                      <span>
                        <strong>{savedChoiceNames[rule.id]?.[id] ?? id}</strong>
                        <small>No longer available — uncheck to remove</small>
                      </span>
                    </label>
                  ))}
                  {rule.options.map((option) => (
                    <label key={option.id}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(option.id)}
                        onChange={(event) => onToggle(rule.id, option.id, event.target.checked)}
                      />
                      <span aria-hidden="true">
                        {selectedIds.includes(option.id) ? <Check size={14} /> : null}
                      </span>
                      <strong>{option.name}</strong>
                    </label>
                  ))}
                </div>
                {errors[rule.id] && <small role="alert">{errors[rule.id]}</small>}
              </fieldset>
            )
          })}
        </div>
      )}

      {errors._form && (
        <div className="builder-save-error" role="alert">
          <AlertTriangle aria-hidden="true" size={18} />
          {errors._form}
        </div>
      )}
      <LocalStorageNotice />
      <SaveError visible={saveFailed} />
      <BuilderActions saved={saved} pending={saving} label="Save proficiencies" />
    </form>
  )
}

function ClassStep({
  page,
  pending,
  failed,
  classId,
  error,
  saved,
  saving,
  saveFailed,
  onClassChange,
  onRetry,
  onSubmit,
}: {
  page?: CatalogPage
  pending: boolean
  failed: boolean
  classId: string
  error: string | null
  saved: boolean
  saving: boolean
  saveFailed: boolean
  onClassChange: (id: string) => void
  onRetry: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  if (pending) {
    return (
      <div className="origin-state" role="status">
        <span aria-hidden="true">✦</span>
        <strong>Opening the class archive…</strong>
        <p>Loading first-level classes from the active rules catalog.</p>
      </div>
    )
  }

  if (failed || !page) {
    return (
      <div className="origin-state origin-state--error" role="alert">
        <AlertTriangle aria-hidden="true" size={30} />
        <strong>The class archive is unavailable</strong>
        <p>Your local draft is safe. Reopen the catalog when the provider is ready.</p>
        <button className="button button--secondary" type="button" onClick={onRetry}>
          <RefreshCw aria-hidden="true" size={17} />
          Try again
        </button>
      </div>
    )
  }

  return (
    <form className="builder-form builder-form--wide" onSubmit={onSubmit} noValidate>
      <OriginChoices
        legend="Class"
        name="class"
        items={page.items}
        selectedId={classId}
        error={error ?? undefined}
        onChange={onClassChange}
      />
      <p className="origin-source">
        Starting level: 1 · Source: {page.source.rulesVersion} · {page.source.provider}
      </p>
      <LocalStorageNotice />
      <SaveError visible={saveFailed} />
      <BuilderActions saved={saved} pending={saving} label="Save class" />
    </form>
  )
}

function OriginsStep({
  speciesPage,
  backgroundsPage,
  pending,
  failed,
  speciesId,
  backgroundId,
  errors,
  saved,
  saving,
  saveFailed,
  onSpeciesChange,
  onBackgroundChange,
  onRetry,
  onSubmit,
}: {
  speciesPage?: CatalogPage
  backgroundsPage?: CatalogPage
  pending: boolean
  failed: boolean
  speciesId: string
  backgroundId: string
  errors: { species?: string; background?: string }
  saved: boolean
  saving: boolean
  saveFailed: boolean
  onSpeciesChange: (id: string) => void
  onBackgroundChange: (id: string) => void
  onRetry: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  if (pending) {
    return (
      <div className="origin-state" role="status">
        <span aria-hidden="true">✦</span>
        <strong>Opening the origins archive…</strong>
        <p>Loading species and backgrounds from the active rules catalog.</p>
      </div>
    )
  }

  if (failed || !speciesPage || !backgroundsPage) {
    return (
      <div className="origin-state origin-state--error" role="alert">
        <AlertTriangle aria-hidden="true" size={30} />
        <strong>The origins archive is unavailable</strong>
        <p>Your local draft is safe. Reopen the catalog when the provider is ready.</p>
        <button className="button button--secondary" type="button" onClick={onRetry}>
          <RefreshCw aria-hidden="true" size={17} />
          Try again
        </button>
      </div>
    )
  }

  return (
    <form className="builder-form builder-form--wide" onSubmit={onSubmit} noValidate>
      <OriginChoices
        legend="Species"
        name="species"
        items={speciesPage.items}
        selectedId={speciesId}
        error={errors.species}
        onChange={onSpeciesChange}
      />
      <OriginChoices
        legend="Background"
        name="background"
        items={backgroundsPage.items}
        selectedId={backgroundId}
        error={errors.background}
        onChange={onBackgroundChange}
      />
      <p className="origin-source">
        Source: {speciesPage.source.rulesVersion} · {speciesPage.source.provider}
      </p>
      <LocalStorageNotice />
      <SaveError visible={saveFailed} />
      <BuilderActions saved={saved} pending={saving} label="Save origins" />
    </form>
  )
}

function OriginChoices({
  legend,
  name,
  items,
  selectedId,
  error,
  onChange,
}: {
  legend: string
  name: string
  items: CatalogPage['items']
  selectedId: string
  error?: string
  onChange: (id: string) => void
}) {
  return (
    <fieldset className={error ? 'origin-choices origin-choices--error' : 'origin-choices'}>
      <legend>{legend}</legend>
      <div className="origin-options">
        {items.map((item) => (
          <label key={item.id}>
            <input
              type="radio"
              name={name}
              value={item.id}
              checked={selectedId === item.id}
              onChange={() => onChange(item.id)}
            />
            <span aria-hidden="true">{selectedId === item.id ? <Check size={15} /> : null}</span>
            <strong>{item.name}</strong>
          </label>
        ))}
      </div>
      {error && <small role="alert">{error}</small>}
    </fieldset>
  )
}

function BuilderStepHeading({
  step,
  title,
  description,
}: {
  step: number
  title: string
  description: string
}) {
  return (
    <div className="builder-workspace__heading">
      <p>
        Step {step} of {builderSteps.length}
      </p>
      <h2 id="builder-step-heading">{title}</h2>
      <span>{description}</span>
    </div>
  )
}

function LocalStorageNotice() {
  return (
    <div className="builder-form__privacy">
      <ShieldCheck aria-hidden="true" size={18} />
      <p>
        <strong>Saved locally</strong>
        This draft is stored in this browser and is not sent to an account.
      </p>
    </div>
  )
}

function SaveError({ visible }: { visible: boolean }) {
  return visible ? (
    <div className="builder-save-error" role="alert">
      <AlertTriangle aria-hidden="true" size={18} />
      This change could not be saved. The previous draft remains intact.
    </div>
  ) : null
}

function BuilderActions({
  saved,
  pending,
  label,
}: {
  saved: boolean
  pending: boolean
  label: string
}) {
  return (
    <div className="builder-form__actions">
      <span aria-live="polite">
        {saved ? 'Draft saved locally.' : 'Changes save only when you use this button.'}
      </span>
      <button className="button button--primary" type="submit" disabled={pending}>
        <Save aria-hidden="true" size={17} />
        {pending ? 'Saving…' : label}
      </button>
    </div>
  )
}

function stepForViolation(source: string): Exclude<BuilderStep, 'review'> | null {
  if (source === 'name' || source.startsWith('name.')) return 'name'
  if (source === 'abilities' || abilityFields.some(([key]) => source.includes(key))) {
    return 'abilities'
  }
  if (source.startsWith('species') || source.startsWith('background')) return 'origins'
  if (source.startsWith('classProgressions')) return 'class'
  if (source.startsWith('proficiencyChoices')) return 'proficiencies'
  return null
}

function builderStepLabel(step: Exclude<BuilderStep, 'review'>): string {
  return builderSteps[
    {
      name: 0,
      abilities: 1,
      origins: 2,
      class: 3,
      proficiencies: 4,
    }[step]
  ][0]
}

function resumeStep(document: StoredCharacterV1): BuilderStep {
  if (!document.character.name.trim()) return 'name'
  if (document.character.abilities === null) return 'abilities'
  if (document.character.species === null || document.character.background === null)
    return 'origins'
  if (!document.character.classProgressions[0]?.class) return 'class'
  return 'proficiencies'
}

function proficiencyInputsFrom(choices: SavedProficiencyChoices): ProficiencyInputs {
  return Object.fromEntries(
    choices.map((choice) => [choice.choiceId, choice.selections.map((selection) => selection.id)]),
  )
}

function savedProficiencyNames(
  choices: SavedProficiencyChoices,
): Record<string, Record<string, string>> {
  return Object.fromEntries(
    choices.map((choice) => [
      choice.choiceId,
      Object.fromEntries(choice.selections.map((selection) => [selection.id, selection.name])),
    ]),
  )
}

function proficiencyRulesFrom(items: CatalogItem[]): ProficiencyRule[] {
  return items.flatMap((item) =>
    (item.characterCreation?.proficiencyChoices ?? []).map((choice) => ({
      ...choice,
      options: choice.options.map((option) => ({ id: option.id, name: option.name })),
      sourceName: item.name,
    })),
  )
}

function fixedProficienciesFrom(items: CatalogItem[]): FixedProficiency[] {
  return items.flatMap((item) =>
    (item.characterCreation?.grantedProficiencies ?? []).map((proficiency) => ({
      id: proficiency.id,
      name: proficiency.name,
      sourceName: item.name,
    })),
  )
}

function validateProficiencyInputs(
  rules: ProficiencyRule[],
  fixedProficiencies: FixedProficiency[],
  inputs: ProficiencyInputs,
):
  | { success: true; choices: SavedProficiencyChoices }
  | { success: false; errors: ProficiencyErrors } {
  const errors: ProficiencyErrors = {}
  const rulesById = new Map(rules.map((rule) => [rule.id, rule]))
  const staleChoiceIds = Object.keys(inputs).filter((choiceId) => !rulesById.has(choiceId))
  if (staleChoiceIds.length > 0) {
    errors._form = 'Remove outdated choices before saving these proficiencies.'
  }

  const knownIds = new Set(fixedProficiencies.map((proficiency) => proficiency.id.toLowerCase()))
  const choices: SavedProficiencyChoices = []

  for (const rule of rules) {
    const selectedIds = inputs[rule.id] ?? []
    const optionsById = new Map(rule.options.map((option) => [option.id, option]))
    const uniqueIds = [...new Set(selectedIds)]
    const invalidIds = uniqueIds.filter((id) => !optionsById.has(id))

    if (invalidIds.length > 0) {
      errors[rule.id] = 'Remove selections that are no longer available.'
      continue
    }
    if (uniqueIds.length !== selectedIds.length || uniqueIds.length !== rule.count) {
      errors[rule.id] =
        `Choose exactly ${rule.count} distinct option${rule.count === 1 ? '' : 's'}.`
      continue
    }

    const selections = uniqueIds.map((id) => optionsById.get(id)!)
    const duplicate = selections.find((selection) => knownIds.has(selection.id.toLowerCase()))
    if (duplicate) {
      errors[rule.id] = `${duplicate.name} is already granted or selected elsewhere.`
      continue
    }

    selections.forEach((selection) => knownIds.add(selection.id.toLowerCase()))
    choices.push({
      choiceId: rule.id,
      selections: selections.map((selection) => ({ id: selection.id, name: selection.name })),
    })
  }

  return Object.keys(errors).length > 0 ? { success: false, errors } : { success: true, choices }
}

function omitKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([entryKey]) => entryKey !== key))
}

function abilityInputsFrom(scores: AbilityScores | null): AbilityInputs {
  return Object.fromEntries(
    abilityFields.map(([key]) => [key, scores === null ? '' : String(scores[key])]),
  ) as AbilityInputs
}

function parseAbilityInputs(
  inputs: AbilityInputs,
): { success: true; scores: AbilityScores } | { success: false; errors: AbilityErrors } {
  const scores = {} as AbilityScores
  const errors: AbilityErrors = {}

  for (const [key] of abilityFields) {
    const raw = inputs[key].trim()
    const score = Number(raw)
    if (!raw) errors[key] = 'Enter a score.'
    else if (!Number.isInteger(score)) errors[key] = 'Use a whole number.'
    else if (score < minimumAbilityScore || score > maximumAbilityScore) {
      errors[key] = `Use ${minimumAbilityScore}–${maximumAbilityScore}.`
    } else scores[key] = score
  }

  return Object.keys(errors).length > 0 ? { success: false, errors } : { success: true, scores }
}

function BuilderLoadingState() {
  return (
    <div className="builder-state" role="status">
      <span aria-hidden="true">✦</span>
      <h1>Opening your draft…</h1>
      <p>Reading this character from local storage.</p>
    </div>
  )
}

function BuilderStorageError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const malformed = error instanceof CharacterStorageDataError

  return (
    <div className="builder-state builder-state--error" role="alert">
      <AlertTriangle aria-hidden="true" size={38} />
      <h1>{malformed ? 'This draft needs attention' : 'The forge cannot reach this draft'}</h1>
      <p>
        {malformed
          ? 'The saved record could not be read. It was not changed or removed.'
          : 'Local storage is unavailable. Check browser privacy settings or try again.'}
      </p>
      <button className="button button--secondary" type="button" onClick={onRetry}>
        <RefreshCw aria-hidden="true" size={17} />
        Try again
      </button>
    </div>
  )
}

function CharacterMissingState() {
  return (
    <div className="builder-state">
      <ShieldCheck aria-hidden="true" size={38} />
      <h1>Character not found</h1>
      <p>
        This draft is not in local storage. It may have been removed or saved in another browser.
      </p>
      <Link className="button button--secondary" to="/characters">
        <ChevronLeft aria-hidden="true" size={17} />
        Return to my characters
      </Link>
    </div>
  )
}
