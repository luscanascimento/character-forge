import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  LockKeyhole,
  RefreshCw,
  Save,
  ShieldCheck,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { CatalogCategory, CatalogFilters, CatalogPage } from '../features/catalog/catalog'
import { getCatalogPage } from '../features/catalog/catalogApi'
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
import type { StoredCharacterV1 } from '../features/characters/characterSchemas'
import '../styles/builder.css'

type CharacterRepository = Pick<CharacterStorage, 'get' | 'save'>

type CharacterBuilderPageProps = {
  storage?: CharacterRepository
  now?: () => Date
  catalogLoader?: CatalogLoader
}

type CatalogLoader = (
  category: CatalogCategory,
  filters: CatalogFilters,
  signal?: AbortSignal,
) => Promise<CatalogPage>

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

type BuilderStep = 'name' | 'abilities' | 'origins'
type AbilityScores = NonNullable<StoredCharacterV1['character']['abilities']>
type AbilityKey = keyof AbilityScores
type AbilityInputs = Record<AbilityKey, string>
type AbilityErrors = Partial<Record<AbilityKey, string>>

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
}: {
  document: StoredCharacterV1
  storage: CharacterRepository
  now: () => Date
  catalogLoader: CatalogLoader
}) {
  const queryClient = useQueryClient()
  const [activeStep, setActiveStep] = useState<BuilderStep>(() => resumeStep(document))
  const [name, setName] = useState(document.character.name)
  const [nameError, setNameError] = useState<string | null>(null)
  const [abilities, setAbilities] = useState<AbilityInputs>(() =>
    abilityInputsFrom(document.character.abilities),
  )
  const [abilityErrors, setAbilityErrors] = useState<AbilityErrors>({})
  const [speciesId, setSpeciesId] = useState(document.character.species?.id ?? '')
  const [backgroundId, setBackgroundId] = useState(document.character.background?.id ?? '')
  const [originErrors, setOriginErrors] = useState<{ species?: string; background?: string }>({})
  const nameComplete = Boolean(document.character.name.trim())
  const abilitiesComplete = document.character.abilities !== null
  const originsComplete =
    document.character.species !== null && document.character.background !== null

  const speciesQuery = useQuery({
    queryKey: ['builder-options', 'species'],
    queryFn: ({ signal }) => catalogLoader('species', { page: 1, pageSize: 48 }, signal),
    enabled: activeStep === 'origins',
    retry: false,
  })
  const backgroundsQuery = useQuery({
    queryKey: ['builder-options', 'backgrounds'],
    queryFn: ({ signal }) => catalogLoader('backgrounds', { page: 1, pageSize: 48 }, signal),
    enabled: activeStep === 'origins',
    retry: false,
  })

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
                index === 0 ? 'name' : index === 1 ? 'abilities' : index === 2 ? 'origins' : null
              const available =
                step === 'name' ||
                (step === 'abilities' && nameComplete) ||
                (step === 'origins' && nameComplete && abilitiesComplete)
              const active = step === activeStep
              const complete =
                index === 0
                  ? nameComplete
                  : index === 1
                    ? abilitiesComplete
                    : index === 2
                      ? originsComplete
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
                        onClick={() => setActiveStep(step)}
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
        ) : (
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
        )}
      </section>
    </div>
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

function resumeStep(document: StoredCharacterV1): BuilderStep {
  if (!document.character.name.trim()) return 'name'
  if (document.character.abilities === null) return 'abilities'
  return 'origins'
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
