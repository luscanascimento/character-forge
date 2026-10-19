import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronLeft,
  HeartPulse,
  LockKeyhole,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
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
  CharacterStorageConflictError,
  CharacterStorageDataError,
} from '../features/characters/characterStorage'
import { validateCharacter } from '../features/characters/characterApi'
import type {
  CharacterEvaluation,
  CharacterDraft,
  StoredCharacterV1,
} from '../features/characters/characterSchemas'
import { getClassProgression } from '../features/progression/classProgressionApi'
import type { ClassProgressionDocument } from '../features/progression/classProgression'
import { getFeatureChoices } from '../features/featureRules/featureRulesApi'
import type {
  FeatureChoiceDocument,
  FeatureChoiceRequirement,
} from '../features/featureRules/featureRules'
import '../styles/builder.css'

type CharacterRepository = Pick<CharacterStorage, 'get' | 'save'>

type CharacterBuilderPageProps = {
  storage?: CharacterRepository
  now?: () => Date
  autosaveDelay?: number
  catalogLoader?: CatalogLoader
  catalogItemLoader?: CatalogItemLoader
  progressionLoader?: ClassProgressionLoader
  featureChoicesLoader?: FeatureChoicesLoader
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

type ClassProgressionLoader = (
  classId: string,
  signal?: AbortSignal,
) => Promise<ClassProgressionDocument>

type FeatureChoicesLoader = (
  classId: string,
  signal?: AbortSignal,
) => Promise<FeatureChoiceDocument>

const defaultStorage = new CharacterStorage()
const defaultNow = () => new Date()

const builderSteps = [
  ['Name', 'Give your character an identity'],
  ['Abilities', 'Set the six ability scores'],
  ['Origins', 'Choose species and background'],
  ['Class', 'Set class, level, and subclass'],
  ['Proficiencies', 'Complete required choices'],
  ['Spells', 'Choose cantrips and prepared spells'],
  ['Equipment', 'Manage owned and equipped items'],
  ['Review', 'Validate the finished character'],
] as const

type BuilderStep =
  'name' | 'abilities' | 'origins' | 'class' | 'proficiencies' | 'spells' | 'equipment' | 'review'
type AbilityScores = NonNullable<StoredCharacterV1['character']['abilities']>
type AbilityKey = keyof AbilityScores
type AbilityId =
  CharacterDraft['feats'][number]['abilityScoreImprovement']['increases'][number]['abilityId']
type AbilityInputs = Record<AbilityKey, string>
type AbilityErrors = Partial<Record<AbilityKey, string>>
type ProficiencyInputs = Record<string, string[]>
type ProficiencyErrors = Record<string, string>
type ClassErrors = { class?: string; subclass?: string; progression?: string }
type FeatureChoiceInputs = Record<string, { branchId: string; selectionIds: string[] }>
type FeatMode = 'single' | 'split'
type FeatInputs = Record<
  string,
  { mode: FeatMode | ''; firstAbilityId: string; secondAbilityId: string }
>
type SpellInputs = { cantripIds: string[]; spellbookIds: string[]; preparedSpellIds: string[] }
type SpellErrors = Partial<Record<'cantrips' | 'spellbook' | 'preparedSpells' | '_form', string>>
type EquipmentInputs = Record<string, { name: string; quantity: string; equipped: boolean }>
type EquipmentErrors = Record<string, string>
type WeaponMasteryInputs = string[]
type WeaponAttackInputs = Record<string, { abilityId: 'str' | 'dex'; twoHanded: boolean }>
type WeaponMasteryLevel = NonNullable<ClassProgressionDocument['weaponMastery']>['levels'][number]
type SavedProficiencyChoices = StoredCharacterV1['character']['proficiencyChoices']
type EditableBuilderStep = Exclude<BuilderStep, 'review'>
type SaveIntent = {
  step: EditableBuilderStep
  character: CharacterDraft
  advance: boolean
}

const defaultAutosaveDelayMs = 650

type ProficiencyRule = {
  id: string
  prompt: string
  count: number
  options: Array<{ id: string; name: string; isSkill?: boolean }>
  sourceName: string
}

type FixedProficiency = {
  id: string
  name: string
  sourceName: string
  isSkill: boolean
}

type SpellOption = CatalogPage['items'][number]
type SpellcastingLevel = NonNullable<ClassProgressionDocument['spellcasting']>['levels'][number]

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
  autosaveDelay = defaultAutosaveDelayMs,
  catalogLoader = getCatalogPage,
  catalogItemLoader = getCatalogItem,
  progressionLoader = getClassProgression,
  featureChoicesLoader = getFeatureChoices,
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
          autosaveDelay={autosaveDelay}
          catalogLoader={catalogLoader}
          catalogItemLoader={catalogItemLoader}
          progressionLoader={progressionLoader}
          featureChoicesLoader={featureChoicesLoader}
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
  autosaveDelay,
  catalogLoader,
  catalogItemLoader,
  progressionLoader,
  featureChoicesLoader,
  validationLoader,
}: {
  document: StoredCharacterV1
  storage: CharacterRepository
  now: () => Date
  autosaveDelay: number
  catalogLoader: CatalogLoader
  catalogItemLoader: CatalogItemLoader
  progressionLoader: ClassProgressionLoader
  featureChoicesLoader: FeatureChoicesLoader
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
  const [classLevel, setClassLevel] = useState(
    String(document.character.classProgressions[0]?.level ?? 1),
  )
  const [subclassId, setSubclassId] = useState(
    document.character.classProgressions[0]?.subclass?.id ?? '',
  )
  const [classErrors, setClassErrors] = useState<ClassErrors>({})
  const [featureChoiceInputs, setFeatureChoiceInputs] = useState<FeatureChoiceInputs>(() =>
    featureChoiceInputsFrom(document.character.featureChoices),
  )
  const [featureChoiceErrors, setFeatureChoiceErrors] = useState<Record<string, string>>({})
  const [featInputs, setFeatInputs] = useState<FeatInputs>(() =>
    featInputsFrom(document.character.feats),
  )
  const [featErrors, setFeatErrors] = useState<Record<string, string>>({})
  const [proficiencyInputs, setProficiencyInputs] = useState<ProficiencyInputs>(() =>
    proficiencyInputsFrom(document.character.proficiencyChoices),
  )
  const [proficiencyErrors, setProficiencyErrors] = useState<ProficiencyErrors>({})
  const [spellInputs, setSpellInputs] = useState<SpellInputs>(() =>
    spellInputsFrom(document.character.spells),
  )
  const [spellErrors, setSpellErrors] = useState<SpellErrors>({})
  const [equipmentInputs, setEquipmentInputs] = useState<EquipmentInputs>(() =>
    equipmentInputsFrom(document.character.equipment),
  )
  const [equipmentErrors, setEquipmentErrors] = useState<EquipmentErrors>({})
  const [weaponMasteryInputs, setWeaponMasteryInputs] = useState<WeaponMasteryInputs>(() =>
    document.character.weaponMasteries.map((selection) => selection.weapon.id),
  )
  const [weaponAttackInputs, setWeaponAttackInputs] = useState<WeaponAttackInputs>(() =>
    weaponAttackInputsFrom(document.character.weaponAttacks),
  )
  const [equipmentSearch, setEquipmentSearch] = useState('')
  const nameComplete = Boolean(document.character.name.trim())
  const abilitiesComplete = document.character.abilities !== null
  const originsComplete =
    document.character.species !== null && document.character.background !== null
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
  const classProgressionQuery = useQuery({
    queryKey: ['class-progression', classId],
    queryFn: ({ signal }) => progressionLoader(classId, signal),
    enabled: Boolean(classId),
    retry: false,
  })
  const featureChoicesQuery = useQuery({
    queryKey: ['feature-choices', classId],
    queryFn: ({ signal }) => featureChoicesLoader(classId, signal),
    enabled: Boolean(classId),
    retry: false,
  })
  const featOccurrences = abilityScoreImprovementOccurrences(classProgressionQuery.data)
  const abilityScoreImprovementQuery = useQuery({
    queryKey: ['catalog-item', 'feats', 'ability-score-improvement'],
    queryFn: ({ signal }) => catalogItemLoader('feats', 'ability-score-improvement', signal),
    enabled: featOccurrences.length > 0,
    retry: false,
  })
  const selectedProgression = document.character.classProgressions[0]
  const spellcasting = classProgressionQuery.data?.spellcasting
  const preparedSpellSource = spellcasting?.policy.preparedSpellSource
  const spellbookPolicy = spellcasting?.policy.spellbook
  const spellLevelRule = spellcasting?.levels.find(
    (level) => level.classLevel === selectedProgression?.level,
  )
  const hasSavedSpells =
    document.character.spells.cantrips.length > 0 ||
    document.character.spells.spellbook.length > 0 ||
    document.character.spells.preparedSpells.length > 0
  const spellOptionsQuery = useQuery({
    queryKey: ['builder-spell-options', selectedClass?.id],
    queryFn: ({ signal }) => getAllClassSpellOptions(catalogLoader, selectedClass!.id, signal),
    enabled:
      Boolean(selectedClass) &&
      (preparedSpellSource === 'classSpellList' || preparedSpellSource === 'spellbook') &&
      (selectedStep === 'spells' || (reviewResumePending && selectedStep === 'proficiencies')),
    retry: false,
  })
  const equipmentOptionsQuery = useQuery({
    queryKey: ['builder-equipment-options'],
    queryFn: ({ signal }) => getAllEquipmentOptions(catalogLoader, signal),
    enabled: selectedStep === 'equipment',
    retry: false,
  })
  const ownedCatalogEquipmentIds = Object.keys(equipmentInputs).filter((id) =>
    equipmentOptionsQuery.data?.some((item) => item.id === id),
  )
  const equipmentDetailQueries = useQueries({
    queries: ownedCatalogEquipmentIds.map((id) => ({
      queryKey: ['catalog-item', 'equipment', id],
      queryFn: ({ signal }: { signal: AbortSignal }) => catalogItemLoader('equipment', id, signal),
      enabled: selectedStep === 'equipment',
      retry: false,
    })),
  })
  const equipmentDetails = equipmentDetailQueries
    .map((query) => query.data)
    .filter((item): item is CatalogItem => item !== undefined)
  const weaponMasteryRule = classProgressionQuery.data?.weaponMastery?.levels.find(
    (level) => level.classLevel === document.character.classProgressions[0]?.level,
  )
  const classFeatureDocument = featureChoicesQuery.data
    ? featureDocumentByOptionSource(featureChoicesQuery.data, false)
    : undefined
  const classComplete =
    Boolean(selectedClass) &&
    classProgressionQuery.data !== undefined &&
    classFeatureDocument !== undefined &&
    classProgressionIsComplete(
      document.character.classProgressions[0],
      classProgressionQuery.data,
    ) &&
    validateFeatureChoiceInputs(
      classFeatureDocument,
      document.character.classProgressions[0],
      featureChoiceInputsForClass(featureChoiceInputsFrom(document.character.featureChoices)),
    ).success &&
    validateFeatInputs(
      classProgressionQuery.data,
      document.character.classProgressions[0],
      abilityScoreImprovementQuery.data,
      featInputsFrom(document.character.feats),
      document.character.abilities,
    ).success
  const classResumeNeedsAttention =
    reviewResumePending &&
    selectedStep === 'proficiencies' &&
    classProgressionQuery.data !== undefined &&
    !classComplete
  const classesQuery = useQuery({
    queryKey: ['builder-options', 'classes'],
    queryFn: ({ signal }) => catalogLoader('classes', { page: 1, pageSize: 48 }, signal),
    enabled: selectedStep === 'class' || classResumeNeedsAttention,
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
  const grantedProficiencyIds = new Set([
    ...fixedProficiencies.map((proficiency) => proficiency.id),
    ...document.character.proficiencyChoices.flatMap((choice) =>
      choice.selections.map((selection) => selection.id),
    ),
  ])
  const resolvedProficiencyIds = new Set([
    ...grantedProficiencyIds,
    ...Object.entries(classProgressionQuery.data?.weaponMastery?.specificProficiencyWeapons ?? {})
      .filter(([proficiencyId]) => grantedProficiencyIds.has(proficiencyId))
      .map(([, weaponId]) => weaponId),
  ])
  const proficiencyDetailsReady =
    creationItems.length === 3 && creationItems.every((item) => item.characterCreation)
  const savedProficiencyInputs = proficiencyInputsFrom(document.character.proficiencyChoices)
  const savedProficiencyResult = validateProficiencyInputs(
    proficiencyRules,
    fixedProficiencies,
    savedProficiencyInputs,
  )
  const expertiseDocument = featureChoicesQuery.data
    ? featureDocumentByOptionSource(featureChoicesQuery.data, true)
    : undefined
  const savedExpertiseResult =
    expertiseDocument && savedProficiencyResult.success
      ? validateFeatureChoiceInputs(
          expertiseDocument,
          document.character.classProgressions[0],
          featureChoiceInputsForExpertise(
            featureChoiceInputsFrom(document.character.featureChoices),
          ),
          false,
          document.character.featureChoices,
          resolvedSkillOptions(proficiencyRules, fixedProficiencies, savedProficiencyInputs),
        )
      : null
  const proficiencyComplete =
    proficiencyDetailsReady &&
    savedProficiencyResult.success &&
    savedExpertiseResult?.success === true
  const savedSpellResult = validateSpellInputs(
    preparedSpellSource,
    spellLevelRule,
    spellOptionsQuery.data,
    spellInputsFrom(document.character.spells),
    spellbookPolicy,
  )
  const spellComplete =
    preparedSpellSource === 'classSpellList' || preparedSpellSource === 'spellbook'
      ? savedSpellResult.success
      : !hasSavedSpells
  const activeStep: BuilderStep = classResumeNeedsAttention
    ? 'class'
    : reviewResumePending &&
        selectedStep === 'proficiencies' &&
        classComplete &&
        proficiencyDetailsReady &&
        proficiencyComplete
      ? spellComplete
        ? 'review'
        : 'spells'
      : selectedStep
  const validationQuery = useQuery({
    queryKey: ['character-validation', document.id, document.updatedAt],
    queryFn: ({ signal }) => validationLoader(document, signal),
    enabled: activeStep === 'review' && classComplete && proficiencyComplete && spellComplete,
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

  function changedCharacterForStep(step: BuilderStep): CharacterDraft | null {
    if (step === 'name') {
      const nextName = name.trim()
      return nextName && nextName !== document.character.name
        ? { ...document.character, name: nextName }
        : null
    }
    if (step === 'abilities') {
      const result = parseAbilityInputs(abilities)
      return result.success && !sameValue(result.scores, document.character.abilities)
        ? { ...document.character, abilities: result.scores }
        : null
    }
    if (step === 'origins') {
      const species = speciesQuery.data?.items.find((item) => item.id === speciesId)
      const background = backgroundsQuery.data?.items.find((item) => item.id === backgroundId)
      if (!species || !background) return null
      const nextOrigins = {
        species: { id: species.id, name: species.name },
        background: { id: background.id, name: background.name },
      }
      return sameValue(nextOrigins.species, document.character.species) &&
        sameValue(nextOrigins.background, document.character.background)
        ? null
        : { ...document.character, ...nextOrigins }
    }
    if (step === 'class') {
      const result = classProgressionFromInputs(
        classesQuery.data,
        classProgressionQuery.data,
        classId,
        classLevel,
        subclassId,
      )
      if (!result.success || !classFeatureDocument) return null
      const featureResult = validateFeatureChoiceInputs(
        classFeatureDocument,
        result.progression,
        featureChoiceInputsForClass(featureChoiceInputs),
        true,
        document.character.featureChoices,
      )
      if (!featureResult.success) return null
      const featResult = validateFeatInputs(
        classProgressionQuery.data,
        result.progression,
        abilityScoreImprovementQuery.data,
        featInputs,
        document.character.abilities,
        true,
        document.character.feats,
      )
      if (!featResult.success) return null
      const nextClass = {
        classProgressions: [result.progression],
        featureChoices: mergeFeatureChoices(
          featureResult.choices,
          document.character.featureChoices.filter((choice) =>
            isExpertiseRequirementId(choice.requirementId),
          ),
        ),
        feats: featResult.feats,
      }
      return sameValue(nextClass.classProgressions, document.character.classProgressions) &&
        sameValue(nextClass.featureChoices, document.character.featureChoices) &&
        sameValue(nextClass.feats, document.character.feats)
        ? null
        : { ...document.character, ...nextClass }
    }
    if (step === 'proficiencies') {
      const result = validateProficiencyInputs(
        proficiencyRules,
        fixedProficiencies,
        proficiencyInputs,
      )
      if (!result.success || !expertiseDocument) return null
      const expertiseResult = validateFeatureChoiceInputs(
        expertiseDocument,
        document.character.classProgressions[0],
        featureChoiceInputsForExpertise(featureChoiceInputs),
        false,
        document.character.featureChoices,
        resolvedSkillOptions(proficiencyRules, fixedProficiencies, proficiencyInputs),
      )
      if (!expertiseResult.success) return null
      const nextProficiencies = {
        proficiencyChoices: result.choices,
        featureChoices: mergeFeatureChoices(
          document.character.featureChoices.filter(
            (choice) => !isExpertiseRequirementId(choice.requirementId),
          ),
          expertiseResult.choices,
        ),
      }
      return sameValue(
        nextProficiencies.proficiencyChoices,
        document.character.proficiencyChoices,
      ) && sameValue(nextProficiencies.featureChoices, document.character.featureChoices)
        ? null
        : { ...document.character, ...nextProficiencies }
    }
    if (step === 'spells') {
      const result = validateSpellInputs(
        preparedSpellSource,
        spellLevelRule,
        spellOptionsQuery.data,
        spellInputs,
        spellbookPolicy,
      )
      return result.success && !sameValue(result.spells, document.character.spells)
        ? { ...document.character, spells: result.spells }
        : null
    }
    if (step === 'equipment') {
      const result = validateEquipmentInputs(
        equipmentOptionsQuery.data,
        equipmentInputs,
        weaponMasteryRule,
        equipmentDetails,
        weaponMasteryInputs,
        weaponAttackInputs,
        resolvedProficiencyIds,
      )
      if (!result.success) return null
      return sameValue(result.equipment, document.character.equipment) &&
        sameValue(result.weaponMasteries, document.character.weaponMasteries) &&
        sameValue(result.weaponAttacks, document.character.weaponAttacks)
        ? null
        : {
            ...document.character,
            equipment: result.equipment,
            weaponMasteries: result.weaponMasteries,
            weaponAttacks: result.weaponAttacks,
          }
    }
    return null
  }

  const autosaveCharacter = changedCharacterForStep(activeStep)
  const autosaveSnapshot = autosaveCharacter
    ? JSON.stringify({ step: activeStep, character: autosaveCharacter })
    : null
  const saveMutation = useMutation({
    mutationFn: (intent: SaveIntent) =>
      storage.save(
        {
          ...document,
          updatedAt: nextUpdatedAt(document.updatedAt, now()),
          character: intent.character,
        },
        document.updatedAt,
      ),
    onSuccess: (saved, intent) => {
      if (intent.step === 'name') {
        setName((current) =>
          current.trim() === intent.character.name ? saved.character.name : current,
        )
      }
      if (intent.step === 'abilities') {
        setAbilities((current) => {
          const parsed = parseAbilityInputs(current)
          return parsed.success && sameValue(parsed.scores, intent.character.abilities)
            ? abilityInputsFrom(saved.character.abilities)
            : current
        })
      }
      if (intent.step === 'origins') {
        setSpeciesId((current) =>
          current === intent.character.species?.id ? (saved.character.species?.id ?? '') : current,
        )
        setBackgroundId((current) =>
          current === intent.character.background?.id
            ? (saved.character.background?.id ?? '')
            : current,
        )
      }
      if (intent.step === 'class') {
        setClassId((current) =>
          current === intent.character.classProgressions[0]?.class?.id
            ? (saved.character.classProgressions[0]?.class?.id ?? '')
            : current,
        )
        setClassLevel((current) =>
          current === String(intent.character.classProgressions[0]?.level)
            ? String(saved.character.classProgressions[0]?.level ?? 1)
            : current,
        )
        setSubclassId((current) =>
          current === (intent.character.classProgressions[0]?.subclass?.id ?? '')
            ? (saved.character.classProgressions[0]?.subclass?.id ?? '')
            : current,
        )
        setFeatureChoiceInputs((current) =>
          sameValue(current, featureChoiceInputsFrom(intent.character.featureChoices))
            ? featureChoiceInputsFrom(saved.character.featureChoices)
            : current,
        )
        setFeatInputs((current) =>
          sameValue(current, featInputsFrom(intent.character.feats))
            ? featInputsFrom(saved.character.feats)
            : current,
        )
      }
      if (intent.step === 'proficiencies') {
        setProficiencyInputs((current) =>
          sameValue(current, proficiencyInputsFrom(intent.character.proficiencyChoices))
            ? proficiencyInputsFrom(saved.character.proficiencyChoices)
            : current,
        )
        setFeatureChoiceInputs((current) =>
          sameValue(current, featureChoiceInputsFrom(intent.character.featureChoices))
            ? featureChoiceInputsFrom(saved.character.featureChoices)
            : current,
        )
      }
      if (intent.step === 'spells') {
        setSpellInputs((current) =>
          sameValue(current, spellInputsFrom(intent.character.spells))
            ? spellInputsFrom(saved.character.spells)
            : current,
        )
      }
      if (intent.step === 'equipment') {
        setEquipmentInputs((current) =>
          sameValue(current, equipmentInputsFrom(intent.character.equipment))
            ? equipmentInputsFrom(saved.character.equipment)
            : current,
        )
        setWeaponMasteryInputs((current) =>
          sameValue(
            current,
            intent.character.weaponMasteries.map((selection) => selection.weapon.id),
          )
            ? saved.character.weaponMasteries.map((selection) => selection.weapon.id)
            : current,
        )
        setWeaponAttackInputs((current) =>
          sameValue(current, weaponAttackInputsFrom(intent.character.weaponAttacks))
            ? weaponAttackInputsFrom(saved.character.weaponAttacks)
            : current,
        )
      }
      cacheSavedDocument(saved)
      if (intent.advance) {
        openStep(
          intent.step === 'proficiencies' && spellComplete
            ? 'equipment'
            : nextBuilderStep(intent.step),
        )
      }
    },
  })
  const mutateSave = saveMutation.mutate

  useEffect(() => {
    if (!autosaveSnapshot || saveMutation.isPending || saveMutation.isError) return

    const timeout = window.setTimeout(() => {
      const candidate = JSON.parse(autosaveSnapshot) as Pick<SaveIntent, 'step' | 'character'>
      mutateSave({ ...candidate, advance: false })
    }, autosaveDelay)
    return () => window.clearTimeout(timeout)
  }, [autosaveDelay, autosaveSnapshot, mutateSave, saveMutation.isError, saveMutation.isPending])

  function persistOrAdvance(step: EditableBuilderStep, character: CharacterDraft) {
    if (sameValue(character, document.character)) {
      openStep(nextBuilderStep(step))
      return
    }
    saveMutation.mutate({ step, character, advance: true })
  }

  function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedName = name.trim()
    if (!normalizedName) {
      setNameError('Choose a name before saving this step.')
      return
    }

    setNameError(null)
    persistOrAdvance('name', { ...document.character, name: normalizedName })
  }

  function saveAbilities(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = parseAbilityInputs(abilities)
    if (!result.success) {
      setAbilityErrors(result.errors)
      return
    }

    setAbilityErrors({})
    persistOrAdvance('abilities', { ...document.character, abilities: result.scores })
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
    persistOrAdvance('origins', {
      ...document.character,
      species: { id: species.id, name: species.name },
      background: { id: background.id, name: background.name },
    })
  }

  function saveClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = classProgressionFromInputs(
      classesQuery.data,
      classProgressionQuery.data,
      classId,
      classLevel,
      subclassId,
    )
    if (!result.success) {
      setClassErrors(result.errors)
      return
    }

    if (!classFeatureDocument) {
      setClassErrors({ progression: 'Wait for the selected class feature rules before saving.' })
      return
    }
    const featureResult = validateFeatureChoiceInputs(
      classFeatureDocument,
      result.progression,
      featureChoiceInputsForClass(featureChoiceInputs),
      true,
      document.character.featureChoices,
    )
    if (!featureResult.success) {
      setFeatureChoiceErrors(featureResult.errors)
      return
    }
    const featResult = validateFeatInputs(
      classProgressionQuery.data,
      result.progression,
      abilityScoreImprovementQuery.data,
      featInputs,
      document.character.abilities,
      true,
      document.character.feats,
    )
    if (!featResult.success) {
      setFeatErrors(featResult.errors)
      return
    }

    setClassErrors({})
    setFeatureChoiceErrors({})
    setFeatErrors({})
    persistOrAdvance('class', {
      ...document.character,
      classProgressions: [result.progression],
      featureChoices: mergeFeatureChoices(
        featureResult.choices,
        document.character.featureChoices.filter((choice) =>
          isExpertiseRequirementId(choice.requirementId),
        ),
      ),
      feats: featResult.feats,
    })
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

    if (!expertiseDocument) {
      setProficiencyErrors({ _form: 'Wait for the selected class feature rules before saving.' })
      return
    }
    const expertiseResult = validateFeatureChoiceInputs(
      expertiseDocument,
      document.character.classProgressions[0],
      featureChoiceInputsForExpertise(featureChoiceInputs),
      false,
      document.character.featureChoices,
      resolvedSkillOptions(proficiencyRules, fixedProficiencies, proficiencyInputs),
    )
    if (!expertiseResult.success) {
      setFeatureChoiceErrors(expertiseResult.errors)
      return
    }

    setProficiencyErrors({})
    setFeatureChoiceErrors({})
    setReviewResumePending(false)
    persistOrAdvance('proficiencies', {
      ...document.character,
      proficiencyChoices: result.choices,
      featureChoices: mergeFeatureChoices(
        document.character.featureChoices.filter(
          (choice) => !isExpertiseRequirementId(choice.requirementId),
        ),
        expertiseResult.choices,
      ),
    })
  }

  function saveSpells(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = validateSpellInputs(
      preparedSpellSource,
      spellLevelRule,
      spellOptionsQuery.data,
      spellInputs,
      spellbookPolicy,
    )
    if (!result.success) {
      setSpellErrors(result.errors)
      return
    }

    setSpellErrors({})
    setReviewResumePending(false)
    persistOrAdvance('spells', { ...document.character, spells: result.spells })
  }

  function saveEquipment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = validateEquipmentInputs(
      equipmentOptionsQuery.data,
      equipmentInputs,
      weaponMasteryRule,
      equipmentDetails,
      weaponMasteryInputs,
      weaponAttackInputs,
      resolvedProficiencyIds,
    )
    if (!result.success) {
      setEquipmentErrors(result.errors)
      return
    }

    setEquipmentErrors({})
    setReviewResumePending(false)
    persistOrAdvance('equipment', {
      ...document.character,
      equipment: result.equipment,
      weaponMasteries: result.weaponMasteries,
      weaponAttacks: result.weaponAttacks,
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
                            ? 'spells'
                            : index === 6
                              ? 'equipment'
                              : index === 7
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
                (step === 'spells' && proficiencyComplete) ||
                (step === 'equipment' && proficiencyComplete && spellComplete) ||
                (step === 'review' && proficiencyComplete && spellComplete)
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
                            ? spellComplete
                            : index === 6
                              ? true
                              : index === 7
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
                    if (saveMutation.isError || saveMutation.isSuccess) saveMutation.reset()
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
              <SaveError
                error={saveMutation.variables?.step === 'name' ? saveMutation.error : null}
              />
              <BuilderActions
                saved={
                  saveMutation.isSuccess &&
                  saveMutation.variables.step === 'name' &&
                  autosaveCharacter === null
                }
                pending={saveMutation.isPending}
                label="Continue"
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
                          if (saveMutation.isError || saveMutation.isSuccess) {
                            saveMutation.reset()
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
              <SaveError
                error={saveMutation.variables?.step === 'abilities' ? saveMutation.error : null}
              />
              <BuilderActions
                saved={
                  saveMutation.isSuccess &&
                  saveMutation.variables.step === 'abilities' &&
                  autosaveCharacter === null
                }
                pending={saveMutation.isPending}
                label="Continue"
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
              saved={
                saveMutation.isSuccess &&
                saveMutation.variables.step === 'origins' &&
                autosaveCharacter === null
              }
              saving={saveMutation.isPending}
              saveError={saveMutation.variables?.step === 'origins' ? saveMutation.error : null}
              onSpeciesChange={(id) => {
                setSpeciesId(id)
                setOriginErrors((current) => ({ ...current, species: undefined }))
                if (saveMutation.isError || saveMutation.isSuccess) saveMutation.reset()
              }}
              onBackgroundChange={(id) => {
                setBackgroundId(id)
                setOriginErrors((current) => ({ ...current, background: undefined }))
                if (saveMutation.isError || saveMutation.isSuccess) saveMutation.reset()
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
              description="Set their current level and choose a subclass when the trusted progression makes one available."
            />
            <ClassStep
              page={classesQuery.data}
              pending={classesQuery.isPending}
              failed={classesQuery.isError}
              progression={classProgressionQuery.data}
              progressionPending={classProgressionQuery.isPending && Boolean(classId)}
              progressionFailed={classProgressionQuery.isError}
              featureChoices={classFeatureDocument}
              featureChoicesPending={featureChoicesQuery.isPending && Boolean(classId)}
              featureChoicesFailed={featureChoicesQuery.isError}
              featureChoiceInputs={featureChoiceInputsForClass(featureChoiceInputs)}
              featureChoiceErrors={featureChoiceErrors}
              feat={abilityScoreImprovementQuery.data}
              featPending={featOccurrences.length > 0 && abilityScoreImprovementQuery.isPending}
              featFailed={abilityScoreImprovementQuery.isError}
              featInputs={featInputs}
              featErrors={featErrors}
              baseAbilities={document.character.abilities}
              classId={classId}
              level={classLevel}
              subclassId={subclassId}
              savedSubclass={document.character.classProgressions[0]?.subclass ?? null}
              errors={classErrors}
              saved={
                saveMutation.isSuccess &&
                saveMutation.variables.step === 'class' &&
                autosaveCharacter === null
              }
              saving={saveMutation.isPending}
              saveError={saveMutation.variables?.step === 'class' ? saveMutation.error : null}
              onClassChange={(id) => {
                setClassId(id)
                setClassLevel('1')
                setSubclassId('')
                setClassErrors({})
                if (saveMutation.isError || saveMutation.isSuccess) saveMutation.reset()
              }}
              onLevelChange={(level) => {
                setClassLevel(level)
                setClassErrors((current) => ({ ...current, subclass: undefined }))
                if (saveMutation.isError || saveMutation.isSuccess) saveMutation.reset()
              }}
              onSubclassChange={(id) => {
                setSubclassId(id)
                setClassErrors((current) => ({ ...current, subclass: undefined }))
                if (saveMutation.isError || saveMutation.isSuccess) saveMutation.reset()
              }}
              onRemoveSubclass={() => {
                setSubclassId('')
                setClassErrors((current) => ({ ...current, subclass: undefined }))
                if (saveMutation.isError || saveMutation.isSuccess) saveMutation.reset()
              }}
              onFeatureChoice={(requirementId, branchId, selectionIds) => {
                setFeatureChoiceInputs((current) => ({
                  ...current,
                  [requirementId]: { branchId, selectionIds },
                }))
                setFeatureChoiceErrors((current) => omitKey(current, requirementId))
                if (saveMutation.isError || saveMutation.isSuccess) saveMutation.reset()
              }}
              onRemoveFeatureChoice={(requirementId) => {
                setFeatureChoiceInputs((current) => omitKey(current, requirementId))
                setFeatureChoiceErrors((current) => omitKey(current, requirementId))
                if (saveMutation.isError || saveMutation.isSuccess) saveMutation.reset()
              }}
              onFeatMode={(occurrenceId, mode) => {
                setFeatInputs((current) => ({
                  ...current,
                  [occurrenceId]: {
                    mode,
                    firstAbilityId: current[occurrenceId]?.firstAbilityId ?? '',
                    secondAbilityId:
                      mode === 'split' ? (current[occurrenceId]?.secondAbilityId ?? '') : '',
                  },
                }))
                setFeatErrors((current) => omitKey(current, occurrenceId))
                if (saveMutation.isError || saveMutation.isSuccess) saveMutation.reset()
              }}
              onFeatAbility={(occurrenceId, slot, abilityId) => {
                setFeatInputs((current) => ({
                  ...current,
                  [occurrenceId]: {
                    mode: current[occurrenceId]?.mode ?? '',
                    firstAbilityId:
                      slot === 'first' ? abilityId : (current[occurrenceId]?.firstAbilityId ?? ''),
                    secondAbilityId:
                      slot === 'second'
                        ? abilityId
                        : (current[occurrenceId]?.secondAbilityId ?? ''),
                  },
                }))
                setFeatErrors((current) => omitKey(current, occurrenceId))
                if (saveMutation.isError || saveMutation.isSuccess) saveMutation.reset()
              }}
              onRemoveFeat={(occurrenceId) => {
                setFeatInputs((current) => omitKey(current, occurrenceId))
                setFeatErrors((current) => omitKey(current, occurrenceId))
                if (saveMutation.isError || saveMutation.isSuccess) saveMutation.reset()
              }}
              onRetry={() => {
                void classesQuery.refetch()
                if (classId) void classProgressionQuery.refetch()
                if (classId) void featureChoicesQuery.refetch()
                if (featOccurrences.length > 0) void abilityScoreImprovementQuery.refetch()
              }}
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
              expertiseDocument={expertiseDocument}
              expertiseInputs={featureChoiceInputsForExpertise(featureChoiceInputs)}
              expertiseErrors={featureChoiceErrors}
              classLevel={document.character.classProgressions[0]?.level ?? 1}
              subclassId={document.character.classProgressions[0]?.subclass?.id ?? null}
              skillOptions={resolvedSkillOptions(
                proficiencyRules,
                fixedProficiencies,
                proficiencyInputs,
              )}
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
              saved={
                saveMutation.isSuccess &&
                saveMutation.variables.step === 'proficiencies' &&
                autosaveCharacter === null
              }
              saving={saveMutation.isPending}
              saveError={
                saveMutation.variables?.step === 'proficiencies' ? saveMutation.error : null
              }
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
                setFeatureChoiceErrors({})
                if (saveMutation.isError || saveMutation.isSuccess) {
                  saveMutation.reset()
                }
              }}
              onRemoveChoice={(choiceId) => {
                setProficiencyInputs((current) => omitKey(current, choiceId))
                setProficiencyErrors((current) => omitKey(omitKey(current, choiceId), '_form'))
                setFeatureChoiceErrors({})
                if (saveMutation.isError || saveMutation.isSuccess) {
                  saveMutation.reset()
                }
              }}
              onToggleExpertise={(requirementId, optionId, checked) => {
                setFeatureChoiceInputs((current) => {
                  const selection = current[requirementId] ?? {
                    branchId: 'expertise-skills',
                    selectionIds: [],
                  }
                  return {
                    ...current,
                    [requirementId]: {
                      ...selection,
                      selectionIds: checked
                        ? [...new Set([...selection.selectionIds, optionId])]
                        : selection.selectionIds.filter((id) => id !== optionId),
                    },
                  }
                })
                setFeatureChoiceErrors((current) => omitKey(current, requirementId))
                if (saveMutation.isError || saveMutation.isSuccess) saveMutation.reset()
              }}
              onRemoveExpertise={(requirementId) => {
                setFeatureChoiceInputs((current) => omitKey(current, requirementId))
                setFeatureChoiceErrors((current) => omitKey(current, requirementId))
                if (saveMutation.isError || saveMutation.isSuccess) saveMutation.reset()
              }}
              onRetry={() => {
                void classDetailQuery.refetch()
                void speciesDetailQuery.refetch()
                void backgroundDetailQuery.refetch()
              }}
              onSubmit={saveProficiencies}
            />
          </>
        ) : activeStep === 'spells' ? (
          <>
            <BuilderStepHeading
              step={6}
              title="Choose their spells"
              description="Choose exact cantrip and prepared-spell counts from the active class list and current spell-slot level."
            />
            <SpellsStep
              className={selectedClass?.name ?? 'This class'}
              preparedSpellSource={preparedSpellSource}
              levelRule={spellLevelRule}
              spellbookPolicy={spellbookPolicy}
              options={spellOptionsQuery.data}
              inputs={spellInputs}
              savedSpells={document.character.spells}
              errors={spellErrors}
              pending={
                classProgressionQuery.isPending ||
                ((preparedSpellSource === 'classSpellList' ||
                  preparedSpellSource === 'spellbook') &&
                  spellOptionsQuery.isPending)
              }
              failed={
                classProgressionQuery.isError ||
                ((preparedSpellSource === 'classSpellList' ||
                  preparedSpellSource === 'spellbook') &&
                  spellOptionsQuery.isError)
              }
              saved={
                saveMutation.isSuccess &&
                saveMutation.variables.step === 'spells' &&
                autosaveCharacter === null
              }
              saving={saveMutation.isPending}
              saveError={saveMutation.variables?.step === 'spells' ? saveMutation.error : null}
              onToggle={(group, id, checked) => {
                const key =
                  group === 'cantrips'
                    ? 'cantripIds'
                    : group === 'spellbook'
                      ? 'spellbookIds'
                      : 'preparedSpellIds'
                setSpellInputs((current) => ({
                  ...current,
                  [key]: checked
                    ? [...new Set([...current[key], id])]
                    : current[key].filter((candidate) => candidate !== id),
                }))
                setSpellErrors((current) => ({ ...current, [group]: undefined, _form: undefined }))
                if (saveMutation.isError || saveMutation.isSuccess) saveMutation.reset()
              }}
              onRetry={() => {
                void classProgressionQuery.refetch()
                if (
                  preparedSpellSource === 'classSpellList' ||
                  preparedSpellSource === 'spellbook'
                ) {
                  void spellOptionsQuery.refetch()
                }
              }}
              onSubmit={saveSpells}
            />
          </>
        ) : activeStep === 'equipment' ? (
          <>
            <BuilderStepHeading
              step={7}
              title="Outfit your character"
              description="Record owned equipment and mark items currently equipped. Armor Class remains server-calculated from canonical item facts and training."
            />
            <EquipmentStep
              options={equipmentOptionsQuery.data}
              details={equipmentDetails}
              inputs={equipmentInputs}
              errors={equipmentErrors}
              weaponMasteryRule={weaponMasteryRule}
              weaponMasteryInputs={weaponMasteryInputs}
              weaponAttackInputs={weaponAttackInputs}
              proficiencyIds={resolvedProficiencyIds}
              search={equipmentSearch}
              pending={equipmentOptionsQuery.isPending}
              detailsPending={equipmentDetailQueries.some((query) => query.isPending)}
              failed={
                equipmentOptionsQuery.isError ||
                equipmentDetailQueries.some((query) => query.isError)
              }
              saved={
                saveMutation.isSuccess &&
                saveMutation.variables.step === 'equipment' &&
                autosaveCharacter === null
              }
              saving={saveMutation.isPending}
              saveError={saveMutation.variables?.step === 'equipment' ? saveMutation.error : null}
              onSearch={setEquipmentSearch}
              onAdd={(item) => {
                setEquipmentInputs((current) => ({
                  ...current,
                  [item.id]: { name: item.name, quantity: '1', equipped: false },
                }))
                setEquipmentErrors((current) => omitKey(omitKey(current, item.id), '_form'))
                if (saveMutation.isError || saveMutation.isSuccess) saveMutation.reset()
              }}
              onQuantity={(id, quantity) => {
                setEquipmentInputs((current) => ({
                  ...current,
                  [id]: { ...current[id]!, quantity },
                }))
                setEquipmentErrors((current) => omitKey(current, id))
                if (saveMutation.isError || saveMutation.isSuccess) saveMutation.reset()
              }}
              onEquipped={(id, equipped) => {
                setEquipmentInputs((current) => ({
                  ...current,
                  [id]: { ...current[id]!, equipped },
                }))
                setEquipmentErrors((current) => omitKey(current, id))
                if (saveMutation.isError || saveMutation.isSuccess) saveMutation.reset()
              }}
              onMastery={(id, selected) => {
                setWeaponMasteryInputs((current) =>
                  selected
                    ? [...new Set([...current, id])]
                    : current.filter((candidate) => candidate !== id),
                )
                setEquipmentErrors((current) => omitKey(current, '_mastery'))
                if (saveMutation.isError || saveMutation.isSuccess) saveMutation.reset()
              }}
              onAttack={(id, attack) => {
                setWeaponAttackInputs((current) =>
                  attack === null ? omitKey(current, id) : { ...current, [id]: attack },
                )
                setEquipmentErrors((current) => omitKey(current, '_attacks'))
                if (saveMutation.isError || saveMutation.isSuccess) saveMutation.reset()
              }}
              onRemove={(id) => {
                setEquipmentInputs((current) => omitKey(current, id))
                setEquipmentErrors((current) => omitKey(omitKey(current, id), '_form'))
                if (saveMutation.isError || saveMutation.isSuccess) saveMutation.reset()
              }}
              onRetry={() => {
                void equipmentOptionsQuery.refetch()
                equipmentDetailQueries.forEach((query) => void query.refetch())
              }}
              onSubmit={saveEquipment}
            />
          </>
        ) : (
          <>
            <BuilderStepHeading
              step={8}
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

function SpellsStep({
  className,
  preparedSpellSource,
  levelRule,
  spellbookPolicy,
  options,
  inputs,
  savedSpells,
  errors,
  pending,
  failed,
  saved,
  saving,
  saveError,
  onToggle,
  onRetry,
  onSubmit,
}: {
  className: string
  preparedSpellSource?: 'classSpellList' | 'spellbook'
  levelRule?: SpellcastingLevel
  spellbookPolicy?: { initialSpells: number; spellsPerAdditionalClassLevel: number } | null
  options?: SpellOption[]
  inputs: SpellInputs
  savedSpells: CharacterDraft['spells']
  errors: SpellErrors
  pending: boolean
  failed: boolean
  saved: boolean
  saving: boolean
  saveError: Error | null
  onToggle: (
    group: 'cantrips' | 'spellbook' | 'preparedSpells',
    id: string,
    checked: boolean,
  ) => void
  onRetry: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  if (pending) {
    return (
      <div className="origin-state" role="status">
        <span aria-hidden="true">✦</span>
        <strong>Gathering spell choices…</strong>
        <p>Resolving the class list and the spell levels available to this character.</p>
      </div>
    )
  }

  if (failed) {
    return (
      <div className="origin-state origin-state--error" role="alert">
        <AlertTriangle aria-hidden="true" size={30} />
        <strong>The spell list could not be loaded</strong>
        <p>Your saved selections are unchanged. Try the rules service again.</p>
        <button className="button button--secondary" type="button" onClick={onRetry}>
          <RefreshCw aria-hidden="true" size={17} />
          Try again
        </button>
      </div>
    )
  }

  const savedById = new Map(
    [...savedSpells.cantrips, ...savedSpells.spellbook, ...savedSpells.preparedSpells].map(
      (spell) => [spell.id, spell],
    ),
  )
  const optionsById = new Map((options ?? []).map((spell) => [spell.id, spell]))
  const groupOptions = (group: 'cantrips' | 'spellbook' | 'preparedSpells') => {
    const ids =
      group === 'cantrips'
        ? inputs.cantripIds
        : group === 'spellbook'
          ? inputs.spellbookIds
          : inputs.preparedSpellIds
    const maximumLevel = Math.max(...(levelRule?.slots.map((slot) => slot.spellLevel) ?? [0]))
    const available = (options ?? []).filter((spell) =>
      group === 'cantrips'
        ? spell.level === 0
        : spell.level !== null &&
          spell.level !== undefined &&
          spell.level >= 1 &&
          spell.level <= maximumLevel &&
          (group !== 'preparedSpells' ||
            preparedSpellSource !== 'spellbook' ||
            inputs.spellbookIds.includes(spell.id)),
    )
    const unavailable = ids
      .filter((id) => !available.some((spell) => spell.id === id))
      .map((id) => optionsById.get(id) ?? savedById.get(id))
      .filter((spell): spell is SpellOption | CharacterDraft['spells']['cantrips'][number] =>
        Boolean(spell),
      )
    return [...available, ...unavailable]
  }
  const hasSelections =
    inputs.cantripIds.length > 0 ||
    inputs.spellbookIds.length > 0 ||
    inputs.preparedSpellIds.length > 0
  const lockedReason =
    preparedSpellSource === undefined
      ? `${className} does not use a supported class spell list.`
      : null
  const minimumSpellbookSpells = spellbookPolicy
    ? spellbookPolicy.initialSpells +
      spellbookPolicy.spellsPerAdditionalClassLevel * ((levelRule?.classLevel ?? 1) - 1)
    : 0

  return (
    <form className="builder-form builder-form--wide" onSubmit={onSubmit} noValidate>
      {lockedReason ? (
        <div className="feature-choice__locked">
          <LockKeyhole aria-hidden="true" size={20} />
          <span>
            <strong>Spell choices unavailable</strong>
            <small>{lockedReason}</small>
          </span>
        </div>
      ) : (
        <p className="builder-field-help">
          {preparedSpellSource === 'spellbook'
            ? `${className} prepares only spells recorded in the spellbook. Record at least ${minimumSpellbookSpells} eligible spells.`
            : `${className} prepares from its class list. Only spells supported by the current slot level can be saved.`}
        </p>
      )}

      {(
        [
          'cantrips',
          ...(preparedSpellSource === 'spellbook' ? (['spellbook'] as const) : []),
          'preparedSpells',
        ] as const
      ).map((group) => {
        const ids =
          group === 'cantrips'
            ? inputs.cantripIds
            : group === 'spellbook'
              ? inputs.spellbookIds
              : inputs.preparedSpellIds
        const count =
          group === 'cantrips'
            ? (levelRule?.cantripsKnown ?? 0)
            : group === 'spellbook'
              ? minimumSpellbookSpells
              : (levelRule?.preparedSpells ?? 0)
        const choices = groupOptions(group)
        if (lockedReason && ids.length === 0) return null
        return (
          <fieldset
            className={
              errors[group] ? 'proficiency-rule proficiency-rule--error' : 'proficiency-rule'
            }
            key={group}
          >
            <legend>
              {group === 'cantrips'
                ? 'Cantrips'
                : group === 'spellbook'
                  ? 'Spellbook'
                  : 'Prepared spells'}
            </legend>
            <p>
              {lockedReason
                ? 'Remove retained selections before continuing.'
                : group === 'spellbook'
                  ? `Record at least ${count}. ${ids.length} recorded.`
                  : `Choose exactly ${count}. ${ids.length} selected.`}
            </p>
            <div className="feature-choice__options">
              {choices.map((spell) => {
                const catalogOption = optionsById.get(spell.id)
                const eligible =
                  catalogOption !== undefined &&
                  (group === 'cantrips'
                    ? catalogOption.level === 0
                    : catalogOption.level !== null &&
                      catalogOption.level !== undefined &&
                      catalogOption.level >= 1 &&
                      catalogOption.level <=
                        Math.max(...(levelRule?.slots.map((slot) => slot.spellLevel) ?? [0])) &&
                      (group !== 'preparedSpells' ||
                        preparedSpellSource !== 'spellbook' ||
                        inputs.spellbookIds.includes(catalogOption.id)))
                return (
                  <label key={spell.id}>
                    <input
                      type="checkbox"
                      checked={ids.includes(spell.id)}
                      onChange={(event) => onToggle(group, spell.id, event.target.checked)}
                      disabled={!eligible && !ids.includes(spell.id)}
                    />
                    <span>
                      <strong>{spell.name}</strong>
                      <small>
                        {'level' in spell && spell.level !== null && spell.level !== undefined
                          ? spell.level === 0
                            ? 'Cantrip'
                            : `Level ${spell.level}`
                          : 'Retained selection'}
                        {!eligible ? ' · unavailable' : ''}
                      </small>
                    </span>
                  </label>
                )
              })}
            </div>
            {errors[group] && (
              <small className="builder-field-error" role="alert">
                {errors[group]}
              </small>
            )}
          </fieldset>
        )
      })}

      {errors._form && (
        <span className="builder-field-error" role="alert">
          {errors._form}
        </span>
      )}
      {!hasSelections && lockedReason && (
        <p className="builder-field-help">There are no retained spell selections to resolve.</p>
      )}
      <LocalStorageNotice />
      <SaveError error={saveError} />
      <BuilderActions saved={saved} pending={saving} label="Continue to equipment" />
    </form>
  )
}

function EquipmentStep({
  options,
  details,
  inputs,
  errors,
  weaponMasteryRule,
  weaponMasteryInputs,
  weaponAttackInputs,
  proficiencyIds,
  search,
  pending,
  detailsPending,
  failed,
  saved,
  saving,
  saveError,
  onSearch,
  onAdd,
  onQuantity,
  onEquipped,
  onMastery,
  onAttack,
  onRemove,
  onRetry,
  onSubmit,
}: {
  options?: CatalogPage['items']
  details: CatalogItem[]
  inputs: EquipmentInputs
  errors: EquipmentErrors
  weaponMasteryRule?: WeaponMasteryLevel
  weaponMasteryInputs: WeaponMasteryInputs
  weaponAttackInputs: WeaponAttackInputs
  proficiencyIds: ReadonlySet<string>
  search: string
  pending: boolean
  detailsPending: boolean
  failed: boolean
  saved: boolean
  saving: boolean
  saveError: Error | null
  onSearch: (search: string) => void
  onAdd: (item: CatalogPage['items'][number]) => void
  onQuantity: (id: string, quantity: string) => void
  onEquipped: (id: string, equipped: boolean) => void
  onMastery: (id: string, selected: boolean) => void
  onAttack: (id: string, attack: { abilityId: 'str' | 'dex'; twoHanded: boolean } | null) => void
  onRemove: (id: string) => void
  onRetry: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  if (pending && !options) {
    return (
      <div className="origin-state" role="status">
        <span aria-hidden="true">◆</span>
        <strong>Opening the equipment vault…</strong>
        <p>Your saved inventory remains local while the canonical catalog loads.</p>
      </div>
    )
  }

  if (failed || !options) {
    return (
      <div className="origin-state origin-state--error" role="alert">
        <AlertTriangle aria-hidden="true" size={30} />
        <strong>The equipment vault is unavailable</strong>
        <p>Your saved inventory is unchanged. Try the catalog again before editing it.</p>
        <button className="button button--secondary" type="button" onClick={onRetry}>
          <RefreshCw aria-hidden="true" size={17} />
          Try again
        </button>
      </div>
    )
  }

  const normalizedSearch = search.trim().toLocaleLowerCase()
  const available = options.filter(
    (item) =>
      !inputs[item.id] &&
      (normalizedSearch.length === 0 || item.name.toLocaleLowerCase().includes(normalizedSearch)),
  )
  const optionsById = new Map(options.map((item) => [item.id, item]))
  const detailsById = new Map(details.map((item) => [item.id, item]))
  const retainedMasteries = weaponMasteryInputs.filter((id) => !inputs[id])
  const retainedAttacks = Object.keys(weaponAttackInputs).filter((id) => !inputs[id])

  return (
    <form className="builder-form builder-form--wide equipment-form" onSubmit={onSubmit} noValidate>
      <section className="equipment-owned" aria-labelledby="owned-equipment-heading">
        <div>
          <h3 id="owned-equipment-heading">Owned equipment</h3>
          <span>{Object.keys(inputs).length} distinct items</span>
        </div>
        {Object.keys(inputs).length === 0 ? (
          <p className="equipment-empty">No equipment recorded. An empty inventory is valid.</p>
        ) : (
          <ul>
            {Object.entries(inputs).map(([id, input]) => {
              const catalogItem = optionsById.get(id)
              const detail = detailsById.get(id)
              const weapon = detail?.equipment?.weapon
              const stale = catalogItem === undefined
              const masterySelected = weaponMasteryInputs.includes(id)
              const attack = weaponAttackInputs[id]
              const finesse = weapon?.properties.some((property) => property.id === 'finesse')
              const ranged = detail?.equipment?.categories.some((category) =>
                category.id.includes('ranged-weapons'),
              )
              const trained = Boolean(
                detail?.equipment &&
                (proficiencyIds.has(id) ||
                  detail.equipment.categories.some((category) => proficiencyIds.has(category.id))),
              )
              return (
                <li
                  className={
                    stale
                      ? 'equipment-owned__item equipment-owned__item--stale'
                      : 'equipment-owned__item'
                  }
                  key={id}
                >
                  <div>
                    <strong>{catalogItem?.name ?? input.name}</strong>
                    <span>{stale ? 'Unavailable in the active catalog' : id}</span>
                  </div>
                  <label>
                    <span>Quantity</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      max="999"
                      step="1"
                      value={input.quantity}
                      onChange={(event) => onQuantity(id, event.target.value)}
                      aria-label={`Quantity for ${input.name}`}
                      aria-invalid={errors[id] ? true : undefined}
                    />
                  </label>
                  <label className="equipment-equipped">
                    <input
                      type="checkbox"
                      checked={input.equipped}
                      onChange={(event) => onEquipped(id, event.target.checked)}
                      aria-label={`Equip ${input.name}`}
                    />
                    <span>Equipped</span>
                  </label>
                  {weapon &&
                    (attack ? (
                      <fieldset className="equipment-attack">
                        <legend>Weapon attack</legend>
                        <label>
                          <span>Attack ability</span>
                          <select
                            value={attack.abilityId}
                            onChange={(event) =>
                              onAttack(id, {
                                ...attack,
                                abilityId: event.target.value as 'str' | 'dex',
                              })
                            }
                          >
                            {(!ranged || finesse) && <option value="str">Strength</option>}
                            {(ranged || finesse) && <option value="dex">Dexterity</option>}
                          </select>
                        </label>
                        {weapon.twoHandedDamage && (
                          <label className="equipment-equipped">
                            <input
                              type="checkbox"
                              checked={attack.twoHanded}
                              onChange={(event) =>
                                onAttack(id, { ...attack, twoHanded: event.target.checked })
                              }
                            />
                            <span>Use two-handed damage · {weapon.twoHandedDamage.dice}</span>
                          </label>
                        )}
                        {!input.equipped && (
                          <small>Equip this weapon to activate its attack.</small>
                        )}
                        <button
                          type="button"
                          aria-label={`Remove attack for ${input.name}`}
                          onClick={() => onAttack(id, null)}
                        >
                          Remove attack
                        </button>
                      </fieldset>
                    ) : (
                      <button
                        type="button"
                        aria-label={`Configure attack for ${input.name}`}
                        disabled={!input.equipped}
                        onClick={() =>
                          onAttack(id, { abilityId: ranged ? 'dex' : 'str', twoHanded: false })
                        }
                      >
                        Configure attack
                      </button>
                    ))}
                  {weapon && weaponMasteryRule && (
                    <label className="equipment-equipped">
                      <input
                        type="checkbox"
                        checked={masterySelected}
                        disabled={!trained && !masterySelected}
                        onChange={(event) => onMastery(id, event.target.checked)}
                        aria-label={`Master ${input.name}`}
                      />
                      <span>
                        Mastered · {weapon.mastery.name}
                        {!trained ? ' · no proficiency' : ''}
                      </span>
                    </label>
                  )}
                  <button type="button" onClick={() => onRemove(id)}>
                    Remove
                  </button>
                  {errors[id] && (
                    <small className="builder-field-error" role="alert">
                      {errors[id]}
                    </small>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {(weaponMasteryRule || weaponMasteryInputs.length > 0) && (
        <section className="equipment-mastery" aria-labelledby="weapon-mastery-heading">
          <div>
            <h3 id="weapon-mastery-heading">Weapon Mastery</h3>
            <span>
              {weaponMasteryRule
                ? `Choose exactly ${weaponMasteryRule.capacity}. ${weaponMasteryInputs.length} selected.`
                : 'Retained selections are unavailable for the current class.'}
            </span>
          </div>
          <p>
            Eligible choices are owned weapons covered by this character’s canonical weapon
            proficiencies.
          </p>
          {detailsPending && <small role="status">Resolving owned weapon properties…</small>}
          {(weaponMasteryRule ? retainedMasteries : weaponMasteryInputs).map((id) => (
            <div className="subclass-retained" key={id} role="alert">
              <AlertTriangle aria-hidden="true" size={18} />
              <div>
                <strong>{id} is retained as a mastery choice.</strong>
                <span>The weapon is no longer in owned equipment.</span>
              </div>
              <button type="button" onClick={() => onMastery(id, false)}>
                Remove mastery
              </button>
            </div>
          ))}
          {errors._mastery && (
            <small className="builder-field-error" role="alert">
              {errors._mastery}
            </small>
          )}
        </section>
      )}

      {(Object.keys(weaponAttackInputs).length > 0 ||
        details.some((item) => item.equipment?.weapon)) && (
        <section className="equipment-mastery" aria-labelledby="weapon-attacks-heading">
          <div>
            <h3 id="weapon-attacks-heading">Weapon attacks</h3>
            <span>{Object.keys(weaponAttackInputs).length} configured</span>
          </div>
          <p>
            Attack and damage modifiers are calculated canonically from the chosen ability and
            proficiency.
          </p>
          {retainedAttacks.map((id) => (
            <div className="subclass-retained" key={id} role="alert">
              <AlertTriangle aria-hidden="true" size={18} />
              <div>
                <strong>{id} is retained as an attack.</strong>
                <span>The weapon is no longer in owned equipment.</span>
              </div>
              <button
                type="button"
                aria-label={`Remove retained attack for ${id}`}
                onClick={() => onAttack(id, null)}
              >
                Remove attack
              </button>
            </div>
          ))}
          {errors._attacks && (
            <small className="builder-field-error" role="alert">
              {errors._attacks}
            </small>
          )}
        </section>
      )}

      <section className="equipment-catalog" aria-labelledby="equipment-catalog-heading">
        <div>
          <h3 id="equipment-catalog-heading">Equipment catalog</h3>
          <span>Add only items this character owns.</span>
        </div>
        <label htmlFor="equipment-search">Search equipment</label>
        <div className="builder-input">
          <span aria-hidden="true">⌕</span>
          <input
            id="equipment-search"
            type="search"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Armor, weapon, pack…"
          />
        </div>
        <ul>
          {available.map((item) => (
            <li key={item.id}>
              <span>{item.name}</span>
              <button type="button" onClick={() => onAdd(item)} aria-label={`Add ${item.name}`}>
                Add
              </button>
            </li>
          ))}
        </ul>
        {available.length === 0 && (
          <p className="equipment-empty">No unowned equipment matches this search.</p>
        )}
      </section>

      {errors._form && (
        <span className="builder-field-error" role="alert">
          {errors._form}
        </span>
      )}
      <LocalStorageNotice />
      <SaveError error={saveError} />
      <BuilderActions saved={saved} pending={saving} label="Review character" />
    </form>
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
  const fightingStyles = document.character.featureChoices.filter((choice) =>
    choice.requirementId.includes('fighting-style'),
  )
  const expertise = document.character.featureChoices
    .filter((choice) => isExpertiseRequirementId(choice.requirementId))
    .flatMap((choice) => choice.selections)

  return (
    <div className="review-sheet">
      <header className="review-hero">
        <div>
          <p>Level {selectedClass?.level} character</p>
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
          <div>
            <dt>Subclass</dt>
            <dd>{selectedClass?.subclass?.name ?? 'Not yet available'}</dd>
          </div>
          {fightingStyles.length > 0 && (
            <div>
              <dt>Fighting style</dt>
              <dd>
                {fightingStyles
                  .map((choice) =>
                    choice.branchId === 'fighting-style-feat'
                      ? choice.selections.map((selection) => selection.name).join(', ')
                      : `${lockedBranchLabel(choice.branchId)} — ${choice.selections
                          .map((selection) => selection.name)
                          .join(', ')}`,
                  )
                  .join('; ')}
              </dd>
            </div>
          )}
          {expertise.length > 0 && (
            <div>
              <dt>Expertise</dt>
              <dd>{expertise.map((selection) => selection.name).join(', ')}</dd>
            </div>
          )}
          {document.character.feats.map((selection) => (
            <div key={selection.occurrenceId}>
              <dt>Feat</dt>
              <dd>
                {selection.feat.name} ·{' '}
                {selection.abilityScoreImprovement.increases
                  .map((increase) => `${increase.abilityId.toUpperCase()} +${increase.increase}`)
                  .join(', ')}
              </dd>
            </div>
          ))}
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
              <dd>{derived.effectiveAbilities[key]}</dd>
              <span>{formatModifier(derived.abilityModifiers[key])}</span>
              {derived.baseAbilities[key] !== derived.effectiveAbilities[key] && (
                <small>Base {derived.baseAbilities[key]}</small>
              )}
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
        <div>
          <span aria-hidden="true" className="review-derived__die">
            ↟
          </span>
          <span>Walking speed</span>
          <strong>{derived.walkingSpeed} ft.</strong>
        </div>
        {derived.spellcasting && (
          <>
            <div>
              <Sparkles aria-hidden="true" size={20} />
              <span>Spell save DC</span>
              <strong>{derived.spellcasting.spellSaveDc}</strong>
            </div>
            <div>
              <Sparkles aria-hidden="true" size={20} />
              <span>Spell attack</span>
              <strong>{formatModifier(derived.spellcasting.spellAttackModifier)}</strong>
            </div>
          </>
        )}
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

      {(document.character.spells.cantrips.length > 0 ||
        document.character.spells.preparedSpells.length > 0) && (
        <section className="review-section" aria-labelledby="review-spells-heading">
          <div className="review-section__heading">
            <h4 id="review-spells-heading">Spells</h4>
            <button type="button" onClick={() => onEdit('spells')}>
              Edit spells
            </button>
          </div>
          <dl className="review-choices">
            {document.character.spells.cantrips.length > 0 && (
              <div>
                <dt>Cantrips</dt>
                <dd>{document.character.spells.cantrips.map((spell) => spell.name).join(', ')}</dd>
              </div>
            )}
            {document.character.spells.preparedSpells.length > 0 && (
              <div>
                <dt>Prepared</dt>
                <dd>
                  {document.character.spells.preparedSpells.map((spell) => spell.name).join(', ')}
                </dd>
              </div>
            )}
          </dl>
        </section>
      )}

      {(document.character.equipment.items.length > 0 || derived.weaponMasteries.length > 0) && (
        <section className="review-section" aria-labelledby="review-equipment-heading">
          <div className="review-section__heading">
            <h4 id="review-equipment-heading">Equipment</h4>
            <button type="button" onClick={() => onEdit('equipment')}>
              Edit equipment
            </button>
          </div>
          <ul className="review-proficiencies">
            {document.character.equipment.items.map((selection) => (
              <li key={selection.item.id}>
                <strong>
                  {selection.item.name} × {selection.quantity}
                </strong>
                <span>{selection.equipped ? 'Equipped' : 'Owned'}</span>
              </li>
            ))}
            {derived.weaponMasteries.map((selection) => (
              <li key={`mastery-${selection.weapon.id}`}>
                <strong>{selection.weapon.name}</strong>
                <span>Weapon Mastery · {selection.mastery.name}</span>
              </li>
            ))}
            {derived.weaponAttacks.map((attack) => (
              <li key={`attack-${attack.weapon.id}`}>
                <strong>
                  {attack.weapon.name} · {formatModifier(attack.attackModifier)} to hit
                </strong>
                <span>
                  {attack.damage.dice} {formatModifier(attack.damageModifier)}{' '}
                  {attack.damage.type.name}
                  {attack.isProficient ? ' · proficient' : ' · not proficient'}
                  {attack.mastery ? ` · ${attack.mastery.name} mastery` : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

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
  expertiseDocument,
  expertiseInputs,
  expertiseErrors,
  skillOptions,
  classLevel,
  subclassId,
  pending,
  failed,
  saved,
  saving,
  saveError,
  onToggle,
  onRemoveChoice,
  onToggleExpertise,
  onRemoveExpertise,
  onRetry,
  onSubmit,
}: {
  rules: ProficiencyRule[]
  fixedProficiencies: FixedProficiency[]
  savedChoiceNames: Record<string, Record<string, string>>
  inputs: ProficiencyInputs
  errors: ProficiencyErrors
  expertiseDocument?: FeatureChoiceDocument
  expertiseInputs: FeatureChoiceInputs
  expertiseErrors: Record<string, string>
  skillOptions: Array<{ id: string; name: string }>
  classLevel: number
  subclassId: string | null
  pending: boolean
  failed: boolean
  saved: boolean
  saving: boolean
  saveError: Error | null
  onToggle: (choiceId: string, optionId: string, checked: boolean) => void
  onRemoveChoice: (choiceId: string) => void
  onToggleExpertise: (requirementId: string, optionId: string, checked: boolean) => void
  onRemoveExpertise: (requirementId: string) => void
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

      {expertiseDocument && (
        <ExpertiseFields
          document={expertiseDocument}
          level={classLevel}
          subclassId={subclassId}
          inputs={expertiseInputs}
          errors={expertiseErrors}
          skillOptions={skillOptions}
          onToggle={onToggleExpertise}
          onRemove={onRemoveExpertise}
        />
      )}

      {errors._form && (
        <div className="builder-save-error" role="alert">
          <AlertTriangle aria-hidden="true" size={18} />
          {errors._form}
        </div>
      )}
      <LocalStorageNotice />
      <SaveError error={saveError} />
      <BuilderActions saved={saved} pending={saving} label="Continue to review" />
    </form>
  )
}

function ExpertiseFields({
  document,
  level,
  subclassId,
  inputs,
  errors,
  skillOptions,
  onToggle,
  onRemove,
}: {
  document: FeatureChoiceDocument
  level: number
  subclassId: string | null
  inputs: FeatureChoiceInputs
  errors: Record<string, string>
  skillOptions: Array<{ id: string; name: string }>
  onToggle: (requirementId: string, optionId: string, checked: boolean) => void
  onRemove: (requirementId: string) => void
}) {
  const active = document.requirements.filter((requirement) =>
    featureRequirementIsActive(requirement, level, subclassId),
  )
  const activeIds = new Set(active.map((requirement) => requirement.id))
  const staleIds = Object.keys(inputs).filter((requirementId) => !activeIds.has(requirementId))

  if (active.length === 0 && staleIds.length === 0) return null

  return (
    <section className="expertise-choices" aria-labelledby="expertise-heading">
      <div>
        <h3 id="expertise-heading">Expertise</h3>
        <span>Choose only skills this character is already proficient in.</span>
      </div>

      {staleIds.map((requirementId) => (
        <div className="proficiency-stale" key={requirementId} role="alert">
          <AlertTriangle aria-hidden="true" size={18} />
          <div>
            <strong>An earlier Expertise choice is retained.</strong>
            <span>It is no longer granted at the current class level.</span>
          </div>
          <button type="button" onClick={() => onRemove(requirementId)}>
            Remove outdated Expertise
          </button>
        </div>
      ))}

      <div className="proficiency-rules">
        {active.map((requirement) => {
          const branch = requirement.branches.find(
            (candidate) => candidate.optionSource === 'proficientSkills',
          )
          if (!branch) return null
          const selectedIds = inputs[requirement.id]?.selectionIds ?? []
          const claimedElsewhere = new Set(
            Object.entries(inputs)
              .filter(([requirementId]) => requirementId !== requirement.id)
              .flatMap(([, selection]) => selection.selectionIds),
          )
          const options = skillOptions.filter(
            (option) => selectedIds.includes(option.id) || !claimedElsewhere.has(option.id),
          )

          return (
            <fieldset
              className={
                errors[requirement.id]
                  ? 'proficiency-rule proficiency-rule--error'
                  : 'proficiency-rule'
              }
              key={requirement.id}
            >
              <legend>Expertise gained at level {requirement.availableAtLevel}</legend>
              <p>Choose exactly {branch.selectionCount}</p>
              <div className="proficiency-options">
                {options.map((option) => (
                  <label key={option.id}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(option.id)}
                      onChange={(event) =>
                        onToggle(requirement.id, option.id, event.target.checked)
                      }
                    />
                    <span aria-hidden="true">
                      {selectedIds.includes(option.id) ? <Check size={14} /> : null}
                    </span>
                    <strong>{option.name}</strong>
                  </label>
                ))}
              </div>
              {options.length === 0 && (
                <small role="alert">Complete eligible skill proficiencies first.</small>
              )}
              {errors[requirement.id] && <small role="alert">{errors[requirement.id]}</small>}
            </fieldset>
          )
        })}
      </div>
    </section>
  )
}

function ClassStep({
  page,
  pending,
  failed,
  progression,
  progressionPending,
  progressionFailed,
  featureChoices,
  featureChoicesPending,
  featureChoicesFailed,
  featureChoiceInputs,
  featureChoiceErrors,
  feat,
  featPending,
  featFailed,
  featInputs,
  featErrors,
  baseAbilities,
  classId,
  level,
  subclassId,
  savedSubclass,
  errors,
  saved,
  saving,
  saveError,
  onClassChange,
  onLevelChange,
  onSubclassChange,
  onRemoveSubclass,
  onFeatureChoice,
  onRemoveFeatureChoice,
  onFeatMode,
  onFeatAbility,
  onRemoveFeat,
  onRetry,
  onSubmit,
}: {
  page?: CatalogPage
  pending: boolean
  failed: boolean
  progression?: ClassProgressionDocument
  progressionPending: boolean
  progressionFailed: boolean
  featureChoices?: FeatureChoiceDocument
  featureChoicesPending: boolean
  featureChoicesFailed: boolean
  featureChoiceInputs: FeatureChoiceInputs
  featureChoiceErrors: Record<string, string>
  feat?: CatalogItem
  featPending: boolean
  featFailed: boolean
  featInputs: FeatInputs
  featErrors: Record<string, string>
  baseAbilities: AbilityScores | null
  classId: string
  level: string
  subclassId: string
  savedSubclass: { id: string; name: string } | null
  errors: ClassErrors
  saved: boolean
  saving: boolean
  saveError: Error | null
  onClassChange: (id: string) => void
  onLevelChange: (level: string) => void
  onSubclassChange: (id: string) => void
  onRemoveSubclass: () => void
  onFeatureChoice: (requirementId: string, branchId: string, selectionIds: string[]) => void
  onRemoveFeatureChoice: (requirementId: string) => void
  onFeatMode: (occurrenceId: string, mode: FeatMode) => void
  onFeatAbility: (occurrenceId: string, slot: 'first' | 'second', abilityId: string) => void
  onRemoveFeat: (occurrenceId: string) => void
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
        error={errors.class}
        onChange={onClassChange}
      />
      {progressionPending && (
        <div className="class-progression-state" role="status">
          <span aria-hidden="true">✦</span>
          Resolving the selected class progression…
        </div>
      )}
      {classId && progressionFailed && (
        <div className="class-progression-state class-progression-state--error" role="alert">
          <AlertTriangle aria-hidden="true" size={18} />
          <div>
            <strong>The class progression is unavailable.</strong>
            <span>Your saved class and level have not been changed.</span>
          </div>
          <button type="button" onClick={onRetry}>
            Try again
          </button>
        </div>
      )}
      {featureChoicesPending && (
        <div className="class-progression-state" role="status">
          <span aria-hidden="true">✦</span>
          Resolving level-dependent feature choices…
        </div>
      )}
      {classId && featureChoicesFailed && (
        <div className="class-progression-state class-progression-state--error" role="alert">
          <AlertTriangle aria-hidden="true" size={18} />
          <div>
            <strong>The feature choices are unavailable.</strong>
            <span>Your saved class choices have not been changed.</span>
          </div>
          <button type="button" onClick={onRetry}>
            Try again
          </button>
        </div>
      )}
      {featPending && (
        <div className="class-progression-state" role="status">
          <span aria-hidden="true">✦</span>
          Resolving the supported feat effect…
        </div>
      )}
      {featFailed && (
        <div className="class-progression-state class-progression-state--error" role="alert">
          <AlertTriangle aria-hidden="true" size={18} />
          <div>
            <strong>The supported feat is unavailable.</strong>
            <span>Your saved feat choices have not been changed.</span>
          </div>
          <button type="button" onClick={onRetry}>
            Try again
          </button>
        </div>
      )}
      {progression && (
        <>
          <ClassProgressionFields
            progression={progression}
            level={level}
            subclassId={subclassId}
            savedSubclass={savedSubclass}
            error={errors.subclass}
            onLevelChange={onLevelChange}
            onSubclassChange={onSubclassChange}
            onRemoveSubclass={onRemoveSubclass}
          />
          {featureChoices && (
            <FeatureChoicesFields
              document={featureChoices}
              level={Number(level)}
              subclassId={subclassId || null}
              inputs={featureChoiceInputs}
              errors={featureChoiceErrors}
              onChoose={onFeatureChoice}
              onRemove={onRemoveFeatureChoice}
            />
          )}
          <FeatChoiceFields
            progression={progression}
            level={Number(level)}
            feat={feat}
            inputs={featInputs}
            errors={featErrors}
            baseAbilities={baseAbilities}
            onMode={onFeatMode}
            onAbility={onFeatAbility}
            onRemove={onRemoveFeat}
          />
        </>
      )}
      {errors.progression && (
        <span className="builder-field-error" role="alert">
          {errors.progression}
        </span>
      )}
      <p className="origin-source">
        Source: {progression?.source.rulesVersion ?? page.source.rulesVersion} ·{' '}
        {progression?.source.provider ?? page.source.provider}
      </p>
      <LocalStorageNotice />
      <SaveError error={saveError} />
      <BuilderActions saved={saved} pending={saving} label="Continue" />
    </form>
  )
}

function FeatureChoicesFields({
  document,
  level,
  subclassId,
  inputs,
  errors,
  onChoose,
  onRemove,
}: {
  document: FeatureChoiceDocument
  level: number
  subclassId: string | null
  inputs: FeatureChoiceInputs
  errors: Record<string, string>
  onChoose: (requirementId: string, branchId: string, selectionIds: string[]) => void
  onRemove: (requirementId: string) => void
}) {
  const active = document.requirements.filter((requirement) =>
    featureRequirementIsActive(requirement, level, subclassId),
  )
  const activeIds = new Set(active.map((requirement) => requirement.id))
  const staleIds = Object.keys(inputs).filter((requirementId) => !activeIds.has(requirementId))

  if (active.length === 0 && staleIds.length === 0) return null

  return (
    <section className="feature-choices" aria-labelledby="feature-choices-heading">
      <div>
        <h3 id="feature-choices-heading">Level-dependent choices</h3>
        <span>Options are verified against manifest {document.manifestVersion}.</span>
      </div>

      {staleIds.map((requirementId) => (
        <div className="subclass-retained" key={requirementId} role="alert">
          <AlertTriangle aria-hidden="true" size={18} />
          <div>
            <strong>A previous feature choice is retained.</strong>
            <span>
              It is unavailable for the current class, subclass, or level. Restore the granting
              progression or remove it explicitly.
            </span>
          </div>
          <button type="button" onClick={() => onRemove(requirementId)}>
            Remove feature choice
          </button>
        </div>
      ))}

      {active.map((requirement) => {
        const selection = inputs[requirement.id]
        return (
          <fieldset
            className={
              errors[requirement.id] ? 'feature-choice feature-choice--error' : 'feature-choice'
            }
            key={requirement.id}
          >
            <legend>{featureChoiceLabel(requirement)}</legend>
            <p>Choose one available path.</p>
            {requirement.branches.map((branch) =>
              branch.availability === 'locked' ? (
                <div className="feature-choice__locked" key={branch.id}>
                  <LockKeyhole aria-hidden="true" size={16} />
                  <span>
                    <strong>{lockedBranchLabel(branch.id)}</strong>
                    <small>This path depends on rules that are not implemented yet.</small>
                  </span>
                </div>
              ) : (
                <div className="feature-choice__branch" key={branch.id}>
                  {branch.selectionCount > 1 && (
                    <p>
                      <strong>{lockedBranchLabel(branch.id)}</strong> · Choose exactly{' '}
                      {branch.selectionCount} cantrips.
                    </p>
                  )}
                  <div className="feature-choice__options">
                    {branch.options.map((option) => {
                      const selectedIds =
                        selection?.branchId === branch.id ? selection.selectionIds : []
                      const checked = selectedIds.includes(option.id)
                      return (
                        <label key={option.id}>
                          <input
                            type={branch.selectionCount === 1 ? 'radio' : 'checkbox'}
                            name={`feature-choice-${requirement.id}`}
                            checked={checked}
                            onChange={(event) =>
                              onChoose(
                                requirement.id,
                                branch.id,
                                branch.selectionCount === 1
                                  ? [option.id]
                                  : event.target.checked
                                    ? [...selectedIds, option.id]
                                    : selectedIds.filter((id) => id !== option.id),
                              )
                            }
                          />
                          <span aria-hidden="true">{checked ? <Check size={14} /> : null}</span>
                          <strong>{option.name}</strong>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ),
            )}
            {errors[requirement.id] && <small role="alert">{errors[requirement.id]}</small>}
          </fieldset>
        )
      })}
    </section>
  )
}

function featureChoiceLabel(requirement: FeatureChoiceRequirement): string {
  return requirement.id === 'champion-additional-fighting-style'
    ? 'Additional Fighting Style'
    : 'Fighting Style'
}

function lockedBranchLabel(branchId: string): string {
  return branchId
    .split('-')
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ')
}

const featAbilityOptions: ReadonlyArray<[AbilityId, string]> = abilityFields.map(
  ([key, label, abbreviation]) => [abilityIdFromKey(key), `${label} (${abbreviation})`],
)

function FeatChoiceFields({
  progression,
  level,
  feat,
  inputs,
  errors,
  baseAbilities,
  onMode,
  onAbility,
  onRemove,
}: {
  progression: ClassProgressionDocument
  level: number
  feat?: CatalogItem
  inputs: FeatInputs
  errors: Record<string, string>
  baseAbilities: AbilityScores | null
  onMode: (occurrenceId: string, mode: FeatMode) => void
  onAbility: (occurrenceId: string, slot: 'first' | 'second', abilityId: string) => void
  onRemove: (occurrenceId: string) => void
}) {
  const occurrences = abilityScoreImprovementOccurrences(progression)
  const active = occurrences.filter((occurrence) => occurrence.level <= level)
  const activeIds = new Set(active.map((occurrence) => occurrence.id))
  const staleIds = Object.keys(inputs).filter((id) => !activeIds.has(id))

  if (occurrences.length === 0 && staleIds.length === 0) return null

  return (
    <section className="feat-choices" aria-labelledby="feat-choices-heading">
      <div>
        <h3 id="feat-choices-heading">Ability Score Improvement feats</h3>
        <span>
          Saved scores remain the base; these progression choices produce effective scores.
        </span>
      </div>

      {staleIds.map((occurrenceId) => (
        <div className="subclass-retained" key={occurrenceId} role="alert">
          <AlertTriangle aria-hidden="true" size={18} />
          <div>
            <strong>An earlier feat choice is retained.</strong>
            <span>It is unavailable at the current class or level.</span>
          </div>
          <button type="button" onClick={() => onRemove(occurrenceId)}>
            Remove feat choice
          </button>
        </div>
      ))}

      {active.map((occurrence) => {
        const input = inputs[occurrence.id]
        return (
          <fieldset
            className={errors[occurrence.id] ? 'feat-choice feat-choice--error' : 'feat-choice'}
            key={occurrence.id}
          >
            <legend>
              Level {occurrence.level} · {feat?.name ?? 'Ability Score Improvement'}
            </legend>
            <p>Increase one ability by 2, or two different abilities by 1 (maximum 20).</p>
            <div className="feat-choice__modes">
              <label>
                <input
                  type="radio"
                  name={`feat-mode-${occurrence.id}`}
                  checked={input?.mode === 'single'}
                  onChange={() => onMode(occurrence.id, 'single')}
                />
                One ability +2
              </label>
              <label>
                <input
                  type="radio"
                  name={`feat-mode-${occurrence.id}`}
                  checked={input?.mode === 'split'}
                  onChange={() => onMode(occurrence.id, 'split')}
                />
                Two abilities +1
              </label>
            </div>
            {input?.mode && (
              <div className="feat-choice__abilities">
                <label>
                  <span>{input.mode === 'single' ? 'Ability' : 'First ability'}</span>
                  <select
                    value={input.firstAbilityId}
                    onChange={(event) => onAbility(occurrence.id, 'first', event.target.value)}
                  >
                    <option value="">Choose an ability</option>
                    {featAbilityOptions.map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                        {baseAbilities ? ` · base ${abilityScoreById(baseAbilities, id)}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
                {input.mode === 'split' && (
                  <label>
                    <span>Second ability</span>
                    <select
                      value={input.secondAbilityId}
                      onChange={(event) => onAbility(occurrence.id, 'second', event.target.value)}
                    >
                      <option value="">Choose a different ability</option>
                      {featAbilityOptions.map(([id, label]) => (
                        <option key={id} value={id}>
                          {label}
                          {baseAbilities ? ` · base ${abilityScoreById(baseAbilities, id)}` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            )}
            {errors[occurrence.id] && <small role="alert">{errors[occurrence.id]}</small>}
          </fieldset>
        )
      })}
      {errors._form && <small role="alert">{errors._form}</small>}
    </section>
  )
}

function ClassProgressionFields({
  progression,
  level,
  subclassId,
  savedSubclass,
  error,
  onLevelChange,
  onSubclassChange,
  onRemoveSubclass,
}: {
  progression: ClassProgressionDocument
  level: string
  subclassId: string
  savedSubclass: { id: string; name: string } | null
  error?: string
  onLevelChange: (level: string) => void
  onSubclassChange: (id: string) => void
  onRemoveSubclass: () => void
}) {
  const numericLevel = Number(level)
  const selectedSubclass = progression.subclasses.find(
    (subclass) => subclass.subclass.id === subclassId,
  )
  const staleSubclass =
    subclassId && !selectedSubclass
      ? savedSubclass?.id === subclassId
        ? savedSubclass
        : { id: subclassId, name: subclassId }
      : null
  const selectedSubclassLocked =
    selectedSubclass !== undefined && numericLevel < selectedSubclass.availableAtLevel
  const classLevel = progression.levels.find((entry) => entry.level === numericLevel)
  const subclassLevel = selectedSubclass?.levels.find((entry) => entry.level === numericLevel)
  const levelFeatures = [
    ...(classLevel?.features.map((feature) => ({ ...feature, source: progression.class.name })) ??
      []),
    ...(subclassLevel?.features.map((feature) => ({
      ...feature,
      source: selectedSubclass!.subclass.name,
    })) ?? []),
  ]

  return (
    <div className="class-progression-fields">
      <label className="class-level" htmlFor="class-level">
        <span>Current class level</span>
        <select
          id="class-level"
          value={level}
          onChange={(event) => onLevelChange(event.target.value)}
        >
          {progression.levels.map((entry) => (
            <option key={entry.level} value={entry.level}>
              Level {entry.level} · proficiency +{entry.proficiencyBonus}
            </option>
          ))}
        </select>
      </label>

      {progression.subclasses.length > 0 && (
        <fieldset
          className={error ? 'subclass-choices subclass-choices--error' : 'subclass-choices'}
        >
          <legend>Subclass</legend>
          <div className="subclass-options">
            {progression.subclasses.map((subclass) => {
              const locked = numericLevel < subclass.availableAtLevel
              return (
                <label
                  className={locked ? 'subclass-option--locked' : undefined}
                  key={subclass.subclass.id}
                >
                  <input
                    type="radio"
                    name="subclass"
                    value={subclass.subclass.id}
                    checked={subclassId === subclass.subclass.id}
                    disabled={locked}
                    onChange={() => onSubclassChange(subclass.subclass.id)}
                  />
                  <span aria-hidden="true">
                    {subclassId === subclass.subclass.id ? (
                      <Check size={15} />
                    ) : locked ? (
                      <LockKeyhole size={14} />
                    ) : null}
                  </span>
                  <span>
                    <strong>{subclass.subclass.name}</strong>
                    <small>
                      {locked ? `Available at level ${subclass.availableAtLevel}` : 'Available now'}
                    </small>
                  </span>
                </label>
              )
            })}
          </div>
          {error && <small role="alert">{error}</small>}
        </fieldset>
      )}

      {(staleSubclass || selectedSubclassLocked) && (
        <div className="subclass-retained" role="alert">
          <AlertTriangle aria-hidden="true" size={18} />
          <div>
            <strong>{staleSubclass?.name ?? selectedSubclass?.subclass.name} is retained.</strong>
            <span>
              {staleSubclass
                ? 'It is not part of the current class progression.'
                : `It requires level ${selectedSubclass?.availableAtLevel}. Raise the level or remove it explicitly.`}
            </span>
          </div>
          <button type="button" onClick={onRemoveSubclass}>
            Remove subclass
          </button>
        </div>
      )}

      <section className="level-features" aria-labelledby="level-features-heading">
        <div>
          <h3 id="level-features-heading">Unlocked at level {numericLevel}</h3>
          <span>Feature references are informational; narrative choices are not inferred.</span>
        </div>
        {levelFeatures.length > 0 ? (
          <ul>
            {levelFeatures.map((feature) => (
              <li key={`${feature.source}-${feature.id}`}>
                <strong>{feature.name}</strong>
                <span>{feature.source}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>No new class or selected-subclass features are listed at this level.</p>
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
  saveError,
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
  saveError: Error | null
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
      <SaveError error={saveError} />
      <BuilderActions saved={saved} pending={saving} label="Continue" />
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

function SaveError({ error }: { error: Error | null }) {
  return error ? (
    <div className="builder-save-error" role="alert">
      <AlertTriangle aria-hidden="true" size={18} />
      {error instanceof CharacterStorageConflictError
        ? 'A newer draft was saved in another tab. Reopen this character before saving more changes.'
        : 'This change could not be saved. The previous draft remains intact.'}
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
        {pending
          ? 'Saving valid changes locally…'
          : saved
            ? 'Draft saved locally.'
            : 'Valid changes save automatically.'}
      </span>
      <button className="button button--primary" type="submit" disabled={pending}>
        {pending ? (
          <Save aria-hidden="true" size={17} />
        ) : (
          <ArrowRight aria-hidden="true" size={17} />
        )}
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
  if (source.startsWith('featureChoices')) {
    return source.includes('expertise') ? 'proficiencies' : 'class'
  }
  if (source.startsWith('proficiencyChoices')) return 'proficiencies'
  if (source.startsWith('spells')) return 'spells'
  if (source.startsWith('equipment')) return 'equipment'
  if (source.startsWith('weaponMasteries')) return 'equipment'
  if (source.startsWith('weaponAttacks')) return 'equipment'
  if (source.startsWith('feats')) return 'class'
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
      spells: 5,
      equipment: 6,
    }[step]
  ][0]
}

function nextBuilderStep(step: EditableBuilderStep): BuilderStep {
  return {
    name: 'abilities',
    abilities: 'origins',
    origins: 'class',
    class: 'proficiencies',
    proficiencies: 'spells',
    spells: 'equipment',
    equipment: 'review',
  }[step] as BuilderStep
}

function nextUpdatedAt(current: string, now: Date): string {
  const candidate = now.toISOString()
  return candidate > current ? candidate : new Date(Date.parse(current) + 1).toISOString()
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function classProgressionFromInputs(
  page: CatalogPage | undefined,
  rules: ClassProgressionDocument | undefined,
  classId: string,
  levelInput: string,
  subclassId: string,
):
  | { success: true; progression: CharacterDraft['classProgressions'][number] }
  | { success: false; errors: ClassErrors } {
  const selectedClass = page?.items.find((item) => item.id === classId)
  if (!selectedClass) {
    return { success: false, errors: { class: 'Choose an available class.' } }
  }
  if (!rules || rules.class.id !== selectedClass.id) {
    return {
      success: false,
      errors: { progression: 'Wait for the selected class progression before saving.' },
    }
  }

  const level = Number(levelInput)
  if (!rules.levels.some((entry) => entry.level === level)) {
    return {
      success: false,
      errors: { progression: 'Choose a level from the trusted class progression.' },
    }
  }

  const selectedSubclass = rules.subclasses.find((subclass) => subclass.subclass.id === subclassId)
  if (subclassId && !selectedSubclass) {
    return {
      success: false,
      errors: { subclass: 'Remove the subclass that is no longer available for this class.' },
    }
  }
  if (
    !selectedSubclass &&
    rules.subclasses.some((subclass) => subclass.availableAtLevel <= level)
  ) {
    return {
      success: false,
      errors: { subclass: 'Choose an available subclass for this level.' },
    }
  }

  return {
    success: true,
    progression: {
      class: { id: selectedClass.id, name: selectedClass.name },
      level,
      subclass: selectedSubclass
        ? { id: selectedSubclass.subclass.id, name: selectedSubclass.subclass.name }
        : null,
    },
  }
}

function classProgressionIsComplete(
  progression: CharacterDraft['classProgressions'][number] | undefined,
  rules: ClassProgressionDocument,
): boolean {
  if (!progression?.class || progression.class.id !== rules.class.id) return false

  const selectedSubclass = progression.subclass
    ? rules.subclasses.find((subclass) => subclass.subclass.id === progression.subclass?.id)
    : undefined
  if (progression.subclass && !selectedSubclass) return false
  if (selectedSubclass && progression.level < selectedSubclass.availableAtLevel) return false

  return (
    selectedSubclass !== undefined ||
    !rules.subclasses.some((subclass) => subclass.availableAtLevel <= progression.level)
  )
}

function featureChoiceInputsFrom(choices: CharacterDraft['featureChoices']): FeatureChoiceInputs {
  return Object.fromEntries(
    choices.map((choice) => [
      choice.requirementId,
      {
        branchId: choice.branchId,
        selectionIds: choice.selections.map((selection) => selection.id),
      },
    ]),
  )
}

function isExpertiseRequirementId(requirementId: string): boolean {
  return requirementId.includes('expertise')
}

function featureChoiceInputsForClass(inputs: FeatureChoiceInputs): FeatureChoiceInputs {
  return Object.fromEntries(
    Object.entries(inputs).filter(([requirementId]) => !isExpertiseRequirementId(requirementId)),
  )
}

function featureChoiceInputsForExpertise(inputs: FeatureChoiceInputs): FeatureChoiceInputs {
  return Object.fromEntries(
    Object.entries(inputs).filter(([requirementId]) => isExpertiseRequirementId(requirementId)),
  )
}

function featureDocumentByOptionSource(
  document: FeatureChoiceDocument,
  proficientSkills: boolean,
): FeatureChoiceDocument {
  return {
    ...document,
    requirements: document.requirements.filter((requirement) =>
      proficientSkills
        ? requirement.branches.some((branch) => branch.optionSource === 'proficientSkills')
        : requirement.branches.every((branch) => branch.optionSource !== 'proficientSkills'),
    ),
  }
}

function mergeFeatureChoices(
  ...groups: Array<CharacterDraft['featureChoices']>
): CharacterDraft['featureChoices'] {
  const choices = new Map<string, CharacterDraft['featureChoices'][number]>()
  groups.flat().forEach((choice) => choices.set(choice.requirementId, choice))
  return [...choices.values()]
}

function abilityScoreImprovementOccurrences(progression?: ClassProgressionDocument): Array<{
  id: string
  level: number
}> {
  if (!progression) return []
  return progression.levels
    .filter((entry) => entry.features.some((feature) => feature.id === 'ability-score-improvement'))
    .map((entry) => ({
      id: `${progression.class.id}-ability-score-improvement-${entry.level}`,
      level: entry.level,
    }))
}

function featInputsFrom(feats: CharacterDraft['feats']): FeatInputs {
  return Object.fromEntries(
    feats.map((selection) => {
      const increases = selection.abilityScoreImprovement.increases
      return [
        selection.occurrenceId,
        {
          mode: increases.length === 1 && increases[0]?.increase === 2 ? 'single' : 'split',
          firstAbilityId: increases[0]?.abilityId ?? '',
          secondAbilityId: increases[1]?.abilityId ?? '',
        },
      ]
    }),
  )
}

function validateFeatInputs(
  rules: ClassProgressionDocument | undefined,
  progression: CharacterDraft['classProgressions'][number] | undefined,
  feat: CatalogItem | undefined,
  inputs: FeatInputs,
  baseAbilities: AbilityScores | null,
  allowUnavailable = false,
  savedFeats: CharacterDraft['feats'] = [],
):
  | { success: true; feats: CharacterDraft['feats'] }
  | { success: false; errors: Record<string, string> } {
  if (!rules || !progression?.class || progression.class.id !== rules.class.id) {
    return { success: false, errors: { _form: 'Wait for matching class progression.' } }
  }

  const occurrences = abilityScoreImprovementOccurrences(rules)
  const byId = new Map(occurrences.map((occurrence) => [occurrence.id, occurrence]))
  const active = occurrences.filter((occurrence) => occurrence.level <= progression.level)
  const activeIds = new Set(active.map((occurrence) => occurrence.id))
  const errors: Record<string, string> = {}
  const selections: CharacterDraft['feats'] = []
  const effective = baseAbilities ? { ...baseAbilities } : null

  if (active.length > 0 && (!feat || feat.id !== 'ability-score-improvement')) {
    return {
      success: false,
      errors: { _form: 'Wait for the canonical Ability Score Improvement feat before saving.' },
    }
  }

  const orderedInputs = Object.entries(inputs).sort(
    ([left], [right]) => (byId.get(left)?.level ?? 99) - (byId.get(right)?.level ?? 99),
  )
  for (const [occurrenceId, input] of orderedInputs) {
    if (!activeIds.has(occurrenceId)) {
      const saved = savedFeats.find((selection) => selection.occurrenceId === occurrenceId)
      if (!allowUnavailable || !saved) {
        errors[occurrenceId] = 'Remove this feat choice or restore its granting level.'
        continue
      }
      selections.push(saved)
      continue
    }

    const abilityIds =
      input.mode === 'single'
        ? [input.firstAbilityId]
        : input.mode === 'split'
          ? [input.firstAbilityId, input.secondAbilityId]
          : []
    if (
      abilityIds.some((id) => !featAbilityOptions.some(([candidate]) => candidate === id)) ||
      (input.mode === 'split' && abilityIds[0] === abilityIds[1]) ||
      (input.mode !== 'single' && input.mode !== 'split')
    ) {
      errors[occurrenceId] = 'Choose one +2 ability or two different +1 abilities.'
      continue
    }

    const increase = input.mode === 'single' ? 2 : 1
    if (
      effective &&
      abilityIds.some((abilityId) => abilityScoreById(effective, abilityId) + increase > 20)
    ) {
      errors[occurrenceId] = 'This feat cannot increase an effective ability score above 20.'
      continue
    }
    if (effective) {
      abilityIds.forEach((abilityId) => increaseAbilityById(effective, abilityId, increase))
    }

    selections.push({
      occurrenceId,
      feat: { id: feat!.id, name: feat!.name },
      abilityScoreImprovement: {
        increases: abilityIds.map((abilityId) => ({
          abilityId: abilityId as AbilityId,
          increase,
        })),
      },
    })
  }

  active.forEach((occurrence) => {
    if (!inputs[occurrence.id]) {
      errors[occurrence.id] = 'Complete this Ability Score Improvement before continuing.'
    }
  })

  return Object.keys(errors).length > 0
    ? { success: false, errors }
    : {
        success: true,
        feats: selections.sort(
          (left, right) =>
            (byId.get(left.occurrenceId)?.level ?? 99) -
            (byId.get(right.occurrenceId)?.level ?? 99),
        ),
      }
}

function abilityIdFromKey(key: AbilityKey): AbilityId {
  const ids: Record<AbilityKey, AbilityId> = {
    strength: 'str',
    dexterity: 'dex',
    constitution: 'con',
    intelligence: 'int',
    wisdom: 'wis',
    charisma: 'cha',
  }
  return ids[key]
}

function abilityKeyFromId(id: string): AbilityKey {
  const entry = abilityFields.find(([key]) => abilityIdFromKey(key) === id)
  if (!entry) throw new Error(`Unsupported ability id: ${id}`)
  return entry[0]
}

function abilityScoreById(abilities: AbilityScores, id: string): number {
  return abilities[abilityKeyFromId(id)]
}

function increaseAbilityById(abilities: AbilityScores, id: string, increase: number): void {
  const key = abilityKeyFromId(id)
  abilities[key] += increase
}

function featureRequirementIsActive(
  requirement: FeatureChoiceRequirement,
  level: number,
  subclassId: string | null,
): boolean {
  return (
    level >= requirement.availableAtLevel &&
    (requirement.subclassId === null || requirement.subclassId === subclassId)
  )
}

function validateFeatureChoiceInputs(
  document: FeatureChoiceDocument,
  progression: CharacterDraft['classProgressions'][number] | undefined,
  inputs: FeatureChoiceInputs,
  allowUnavailable = false,
  savedChoices: CharacterDraft['featureChoices'] = [],
  proficientSkills: Array<{ id: string; name: string }> = [],
):
  | { success: true; choices: CharacterDraft['featureChoices'] }
  | { success: false; errors: Record<string, string> } {
  if (!progression?.class || progression.class.id !== document.class.id) {
    return { success: false, errors: { _form: 'Wait for matching feature rules.' } }
  }

  const active = document.requirements.filter((requirement) =>
    featureRequirementIsActive(requirement, progression.level, progression.subclass?.id ?? null),
  )
  const activeById = new Map(active.map((requirement) => [requirement.id, requirement]))
  const allById = new Map(document.requirements.map((requirement) => [requirement.id, requirement]))
  const errors: Record<string, string> = {}
  const choices: CharacterDraft['featureChoices'] = []
  const claimedExpertise = new Set<string>()

  for (const [requirementId, input] of Object.entries(inputs)) {
    const requirement = activeById.get(requirementId)
    if (!requirement) {
      if (!allowUnavailable) {
        errors[requirementId] = 'Remove this choice or restore its granting progression.'
        continue
      }

      const knownRequirement = allById.get(requirementId)
      const saved = savedChoices.find((choice) => choice.requirementId === requirementId)
      const selections = input.selectionIds.map((id) => {
        const known = knownRequirement?.branches
          .flatMap((branch) =>
            branch.optionSource === 'proficientSkills' ? proficientSkills : branch.options,
          )
          .find((option) => option.id === id)
        return known ?? saved?.selections.find((option) => option.id === id) ?? { id, name: id }
      })
      choices.push({ requirementId, branchId: input.branchId, selections })
      continue
    }

    const branch = requirement.branches.find((candidate) => candidate.id === input.branchId)
    if (!branch || branch.availability !== 'supported') {
      errors[requirementId] = 'Choose an available feature path.'
      continue
    }

    const uniqueIds = [...new Set(input.selectionIds)]
    const branchOptions =
      branch.optionSource === 'proficientSkills' ? proficientSkills : branch.options
    const optionsById = new Map(branchOptions.map((option) => [option.id, option]))
    if (
      uniqueIds.length !== input.selectionIds.length ||
      uniqueIds.length !== branch.selectionCount ||
      uniqueIds.some((id) => !optionsById.has(id))
    ) {
      errors[requirementId] =
        `Choose exactly ${branch.selectionCount} available option${branch.selectionCount === 1 ? '' : 's'}.`
      continue
    }

    if (
      branch.optionSource === 'proficientSkills' &&
      uniqueIds.some((id) => claimedExpertise.has(id))
    ) {
      errors[requirementId] = 'Choose skills that do not already have Expertise.'
      continue
    }
    if (branch.optionSource === 'proficientSkills') {
      uniqueIds.forEach((id) => claimedExpertise.add(id))
    }

    choices.push({
      requirementId,
      branchId: branch.id,
      selections: uniqueIds.map((id) => optionsById.get(id)!),
    })
  }

  for (const requirement of active) {
    if (!inputs[requirement.id]) {
      errors[requirement.id] = requirement.branches.some(
        (branch) => branch.optionSource === 'proficientSkills',
      )
        ? 'Choose the required Expertise skills before continuing.'
        : 'Choose a Fighting Style before continuing.'
    }
  }

  return Object.keys(errors).length > 0 ? { success: false, errors } : { success: true, choices }
}

function resumeStep(document: StoredCharacterV1): BuilderStep {
  if (!document.character.name.trim()) return 'name'
  if (document.character.abilities === null) return 'abilities'
  if (document.character.species === null || document.character.background === null)
    return 'origins'
  if (!document.character.classProgressions[0]?.class) return 'class'
  return 'proficiencies'
}

function spellInputsFrom(spells: CharacterDraft['spells']): SpellInputs {
  return {
    cantripIds: spells.cantrips.map((spell) => spell.id),
    spellbookIds: spells.spellbook.map((spell) => spell.id),
    preparedSpellIds: spells.preparedSpells.map((spell) => spell.id),
  }
}

function equipmentInputsFrom(equipment: CharacterDraft['equipment']): EquipmentInputs {
  return Object.fromEntries(
    equipment.items.map((selection) => [
      selection.item.id,
      {
        name: selection.item.name,
        quantity: String(selection.quantity),
        equipped: selection.equipped,
      },
    ]),
  )
}

function weaponAttackInputsFrom(attacks: CharacterDraft['weaponAttacks']): WeaponAttackInputs {
  return Object.fromEntries(
    attacks.map((attack) => [
      attack.weapon.id,
      { abilityId: attack.abilityId, twoHanded: attack.twoHanded },
    ]),
  )
}

function validateEquipmentInputs(
  options: CatalogPage['items'] | undefined,
  inputs: EquipmentInputs,
  weaponMasteryRule: WeaponMasteryLevel | undefined,
  details: CatalogItem[],
  weaponMasteryInputs: WeaponMasteryInputs,
  weaponAttackInputs: WeaponAttackInputs,
  proficiencyIds: ReadonlySet<string>,
):
  | {
      success: true
      equipment: CharacterDraft['equipment']
      weaponMasteries: CharacterDraft['weaponMasteries']
      weaponAttacks: CharacterDraft['weaponAttacks']
    }
  | { success: false; errors: EquipmentErrors } {
  if (Object.keys(inputs).length > 0 && !options) {
    return {
      success: false,
      errors: { _form: 'Wait for the canonical equipment catalog before saving.' },
    }
  }

  const optionsById = new Map((options ?? []).map((item) => [item.id, item]))
  const errors: EquipmentErrors = {}
  const items: CharacterDraft['equipment']['items'] = []
  for (const [id, input] of Object.entries(inputs)) {
    const option = optionsById.get(id)
    const quantity = Number(input.quantity)
    if (!option) {
      errors[id] = 'Remove this unavailable item or retry after the catalog is restored.'
      continue
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
      errors[id] = 'Quantity must be a whole number between 1 and 999.'
      continue
    }

    items.push({
      item: { id: option.id, name: option.name },
      quantity,
      equipped: input.equipped,
    })
  }

  const detailsById = new Map(details.map((item) => [item.id, item]))
  const weaponMasteries: CharacterDraft['weaponMasteries'] = []
  if (!weaponMasteryRule) {
    if (weaponMasteryInputs.length > 0) {
      errors._mastery =
        'Remove retained Weapon Mastery choices or restore a class that grants the feature.'
    }
  } else {
    if (weaponMasteryInputs.length !== weaponMasteryRule.capacity) {
      errors._mastery = `Choose exactly ${weaponMasteryRule.capacity} eligible owned weapons.`
    }

    for (const id of weaponMasteryInputs) {
      if (!inputs[id]) {
        errors._mastery = 'Every mastered weapon must remain in owned equipment.'
        continue
      }
      const detail = detailsById.get(id)
      if (!detail) {
        errors._form = 'Wait for all owned weapon details before saving.'
        continue
      }
      const weapon = detail.equipment?.weapon
      if (!weapon) {
        errors._mastery = 'Weapon Mastery choices must be canonical weapons.'
        continue
      }
      const trained =
        proficiencyIds.has(id) ||
        (detail.equipment?.categories ?? []).some((category) => proficiencyIds.has(category.id))
      if (!trained) {
        errors._mastery = 'Choose only weapons covered by this character’s proficiencies.'
        continue
      }
      weaponMasteries.push({ weapon: { id: detail.id, name: detail.name } })
    }
  }

  const weaponAttacks: CharacterDraft['weaponAttacks'] = []
  for (const [id, attack] of Object.entries(weaponAttackInputs)) {
    const input = inputs[id]
    if (!input) {
      errors._attacks = 'Every configured attack must remain in owned equipment.'
      continue
    }
    if (!input.equipped) {
      errors._attacks = 'Equip each configured weapon or remove its retained attack.'
      continue
    }
    const detail = detailsById.get(id)
    if (!detail) {
      errors._form = 'Wait for all configured weapon details before saving.'
      continue
    }
    const weapon = detail.equipment?.weapon
    if (!weapon) {
      errors._attacks = 'Weapon attacks must reference canonical weapons.'
      continue
    }
    const finesse = weapon.properties.some((property) => property.id === 'finesse')
    const ranged = detail.equipment?.categories.some((category) =>
      category.id.includes('ranged-weapons'),
    )
    if (
      (!ranged && attack.abilityId === 'dex' && !finesse) ||
      (ranged && attack.abilityId === 'str' && !finesse)
    ) {
      errors._attacks = `${detail.name} cannot use the selected attack ability.`
      continue
    }
    if (attack.twoHanded && !weapon.twoHandedDamage) {
      errors._attacks = `${detail.name} does not have a two-handed damage profile.`
      continue
    }
    weaponAttacks.push({
      weapon: { id: detail.id, name: detail.name },
      abilityId: attack.abilityId,
      twoHanded: attack.twoHanded,
    })
  }

  return Object.keys(errors).length > 0
    ? { success: false, errors }
    : { success: true, equipment: { items }, weaponMasteries, weaponAttacks }
}

function validateSpellInputs(
  preparedSpellSource: 'classSpellList' | 'spellbook' | undefined,
  levelRule: SpellcastingLevel | undefined,
  options: SpellOption[] | undefined,
  inputs: SpellInputs,
  spellbookPolicy?: { initialSpells: number; spellsPerAdditionalClassLevel: number } | null,
): { success: true; spells: CharacterDraft['spells'] } | { success: false; errors: SpellErrors } {
  if (preparedSpellSource === undefined) {
    return inputs.cantripIds.length === 0 &&
      inputs.spellbookIds.length === 0 &&
      inputs.preparedSpellIds.length === 0
      ? { success: true, spells: { cantrips: [], spellbook: [], preparedSpells: [] } }
      : {
          success: false,
          errors: {
            _form: 'Remove retained selections or restore the class that granted them.',
          },
        }
  }

  if (!levelRule || !options) {
    return { success: false, errors: { _form: 'Wait for the active spell rules to load.' } }
  }

  const optionsById = new Map(options.map((option) => [option.id, option]))
  const maximumLevel = Math.max(...levelRule.slots.map((slot) => slot.spellLevel))
  const errors: SpellErrors = {}
  const validateGroup = (
    ids: string[],
    requiredCount: number,
    eligible: (option: SpellOption) => boolean,
    group: 'cantrips' | 'preparedSpells',
  ) => {
    if (
      ids.length !== requiredCount ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => {
        const option = optionsById.get(id)
        return !option || !eligible(option)
      })
    ) {
      errors[group] =
        `Choose exactly ${requiredCount} distinct, available ${group === 'cantrips' ? 'cantrip' : 'prepared spell'}${requiredCount === 1 ? '' : 's'}.`
    }
  }

  validateGroup(
    inputs.cantripIds,
    levelRule.cantripsKnown,
    (option) => option.level === 0,
    'cantrips',
  )
  if (preparedSpellSource === 'spellbook') {
    const minimumSpellbookSpells = spellbookPolicy
      ? spellbookPolicy.initialSpells +
        spellbookPolicy.spellsPerAdditionalClassLevel * (levelRule.classLevel - 1)
      : 0
    if (
      !spellbookPolicy ||
      inputs.spellbookIds.length < minimumSpellbookSpells ||
      new Set(inputs.spellbookIds).size !== inputs.spellbookIds.length ||
      inputs.spellbookIds.some((id) => {
        const option = optionsById.get(id)
        return (
          !option ||
          option.level === null ||
          option.level === undefined ||
          option.level < 1 ||
          option.level > maximumLevel
        )
      })
    ) {
      errors.spellbook = `Record at least ${minimumSpellbookSpells} distinct, available Wizard spells.`
    }
  } else if (inputs.spellbookIds.length > 0) {
    errors.spellbook = 'Remove the retained spellbook or restore the Wizard class.'
  }
  validateGroup(
    inputs.preparedSpellIds,
    levelRule.preparedSpells,
    (option) =>
      option.level !== null &&
      option.level !== undefined &&
      option.level >= 1 &&
      option.level <= maximumLevel &&
      (preparedSpellSource !== 'spellbook' || inputs.spellbookIds.includes(option.id)),
    'preparedSpells',
  )
  if (Object.keys(errors).length > 0) return { success: false, errors }

  const references = (ids: string[]) =>
    ids.map((id) => {
      const option = optionsById.get(id)!
      return { id: option.id, name: option.name }
    })
  return {
    success: true,
    spells: {
      cantrips: references(inputs.cantripIds),
      spellbook: references(inputs.spellbookIds),
      preparedSpells: references(inputs.preparedSpellIds),
    },
  }
}

async function getAllClassSpellOptions(
  loader: CatalogLoader,
  classId: string,
  signal?: AbortSignal,
): Promise<SpellOption[]> {
  const first = await loader(
    'spells',
    { page: 1, pageSize: 48, characterClass: classId, sort: 'level' },
    signal,
  )
  if (first.totalPages <= 1) return first.items

  const remaining = await Promise.all(
    Array.from({ length: first.totalPages - 1 }, (_, index) =>
      loader(
        'spells',
        { page: index + 2, pageSize: 48, characterClass: classId, sort: 'level' },
        signal,
      ),
    ),
  )
  return [first, ...remaining].flatMap((page) => page.items)
}

async function getAllEquipmentOptions(
  loader: CatalogLoader,
  signal?: AbortSignal,
): Promise<CatalogPage['items']> {
  const first = await loader('equipment', { page: 1, pageSize: 48 }, signal)
  if (first.totalPages <= 1) return first.items

  const remaining = await Promise.all(
    Array.from({ length: first.totalPages - 1 }, (_, index) =>
      loader('equipment', { page: index + 2, pageSize: 48 }, signal),
    ),
  )
  return [first, ...remaining].flatMap((page) => page.items)
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
      options: choice.options.map((option) => ({
        id: option.id,
        name: option.name,
        isSkill: option.isSkill,
      })),
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
      isSkill: proficiency.isSkill === true,
    })),
  )
}

function resolvedSkillOptions(
  rules: ProficiencyRule[],
  fixedProficiencies: FixedProficiency[],
  inputs: ProficiencyInputs,
): Array<{ id: string; name: string }> {
  const skills = new Map<string, { id: string; name: string }>()
  fixedProficiencies
    .filter((proficiency) => proficiency.isSkill)
    .forEach((proficiency) =>
      skills.set(proficiency.id, { id: proficiency.id, name: proficiency.name }),
    )

  for (const rule of rules) {
    const options = new Map(rule.options.map((option) => [option.id, option]))
    for (const id of inputs[rule.id] ?? []) {
      const option = options.get(id)
      if (option?.isSkill) skills.set(option.id, { id: option.id, name: option.name })
    }
  }

  return [...skills.values()].sort((left, right) => left.name.localeCompare(right.name))
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
