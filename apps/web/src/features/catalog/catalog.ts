import { z } from 'zod'

export const catalogCategories = [
  'classes',
  'species',
  'backgrounds',
  'feats',
  'spells',
  'equipment',
] as const

export const catalogCategorySchema = z.enum(catalogCategories)
export type CatalogCategory = z.infer<typeof catalogCategorySchema>

const sourceSchema = z.object({
  provider: z.string(),
  ruleset: z.string(),
  rulesVersion: z.string(),
  fetchedAt: z.string(),
})

const summarySchema = z.object({
  id: z.string(),
  name: z.string(),
  category: catalogCategorySchema,
  level: z.number().int().nullable().optional(),
})

const referenceSchema = z.object({
  id: z.string(),
  name: z.string(),
  note: z.string().nullable().optional(),
})

const proficiencyReferenceSchema = referenceSchema.extend({
  isSkill: z.boolean().optional(),
})

type EquipmentChoice = {
  id: string
  prompt: string
  count: number
  options: EquipmentOption[]
  equipmentCategory?: z.infer<typeof referenceSchema> | null
}

type EquipmentOption = {
  kind: 'bundle' | 'item' | 'equipmentCategory' | 'currency' | 'choice'
  quantity: number
  reference?: z.infer<typeof referenceSchema> | null
  currencyUnit?: string | null
  items?: EquipmentOption[] | null
  choice?: EquipmentChoice | null
}

const equipmentOptionSchema: z.ZodType<EquipmentOption> = z.lazy(() =>
  z.object({
    kind: z.enum(['bundle', 'item', 'equipmentCategory', 'currency', 'choice']),
    quantity: z.number().int().nonnegative(),
    reference: referenceSchema.nullable().optional(),
    currencyUnit: z.string().min(1).nullable().optional(),
    items: z.array(equipmentOptionSchema).nullable().optional(),
    choice: equipmentChoiceSchema.nullable().optional(),
  }),
)

const equipmentChoiceSchema: z.ZodType<EquipmentChoice> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    prompt: z.string(),
    count: z.number().int().positive(),
    options: z.array(equipmentOptionSchema),
    equipmentCategory: referenceSchema.nullable().optional(),
  }),
)

const characterCreationSchema = z.object({
  hitDie: z.number().int().positive().nullable(),
  grantedProficiencies: z.array(proficiencyReferenceSchema),
  proficiencyChoices: z.array(
    z.object({
      id: z.string(),
      prompt: z.string(),
      count: z.number().int().positive(),
      options: z.array(proficiencyReferenceSchema),
    }),
  ),
  equipmentChoices: z
    .array(equipmentChoiceSchema)
    .nullish()
    .transform((choices) => choices ?? []),
})

const abilityScorePrerequisiteChoiceSchema = z
  .object({
    count: z.number().int().positive(),
    options: z.array(
      z.object({
        ability: referenceSchema,
        minimumScore: z.number().int().min(1).max(30),
      }),
    ),
  })
  .refine((choice) => choice.options.length >= choice.count, {
    message: 'Ability prerequisite does not contain enough options',
  })

const featFactsSchema = z.object({
  type: z.string().min(1),
  minimumLevel: z.number().int().min(1).max(20).nullable(),
  requiredFeature: z.string().min(1).nullable(),
  isRepeatable: z.boolean(),
  abilityScorePrerequisite: abilityScorePrerequisiteChoiceSchema.nullable(),
})

const damageSchema = z.object({
  dice: z.string().min(1),
  type: referenceSchema,
})

const equipmentFactsSchema = z.object({
  categories: z.array(referenceSchema).min(1),
  cost: z.object({ quantity: z.number().nonnegative(), unit: z.string().min(1) }).nullable(),
  weight: z.number().nonnegative().nullable(),
  weapon: z
    .object({
      damage: damageSchema,
      twoHandedDamage: damageSchema.nullable(),
      range: z
        .object({
          normal: z.number().int().positive(),
          long: z.number().int().positive().nullable(),
        })
        .nullable(),
      properties: z.array(referenceSchema),
      mastery: referenceSchema,
    })
    .nullable(),
  armor: z
    .object({
      baseArmorClass: z.number().int().positive(),
      addsDexterity: z.boolean(),
      maximumDexterityBonus: z.number().int().nonnegative().nullable(),
      strengthMinimum: z.number().int().min(0).max(30),
      imposesStealthDisadvantage: z.boolean(),
    })
    .nullable(),
})

export const catalogPageSchema = z.object({
  items: z.array(summarySchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
  source: sourceSchema,
})

export const catalogItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: catalogCategorySchema,
  description: z.array(z.string()),
  attributes: z.array(z.object({ label: z.string(), value: z.string() })),
  sections: z.array(
    z.object({
      title: z.string(),
      entries: z.array(referenceSchema),
    }),
  ),
  textSections: z
    .array(z.object({ title: z.string(), paragraphs: z.array(z.string()) }))
    .nullish()
    .transform((sections) => sections ?? []),
  characterCreation: characterCreationSchema.nullable().optional(),
  source: sourceSchema,
  feat: featFactsSchema.nullable().optional(),
  equipment: equipmentFactsSchema.nullable().optional(),
})

export type CatalogPage = z.infer<typeof catalogPageSchema>
export type CatalogItem = z.infer<typeof catalogItemSchema>

export interface CatalogFilters {
  search?: string
  page?: number
  pageSize?: number
  level?: number
  school?: string
  characterClass?: string
  sort?: 'name' | 'level'
}

export const categoryDetails: Record<
  CatalogCategory,
  { label: string; singular: string; description: string; sigil: string }
> = {
  classes: {
    label: 'Classes',
    singular: 'Class',
    description: 'Paths of training, talent, and power.',
    sigil: '⚔',
  },
  species: {
    label: 'Species',
    singular: 'Species',
    description: 'Lineages and traits carried into every adventure.',
    sigil: '◈',
  },
  backgrounds: {
    label: 'Backgrounds',
    singular: 'Background',
    description: 'The lives heroes led before answering the call.',
    sigil: '⌂',
  },
  feats: {
    label: 'Feats',
    singular: 'Feat',
    description: 'Exceptional talents earned along the road.',
    sigil: '✦',
  },
  spells: {
    label: 'Spells',
    singular: 'Spell',
    description: 'Arcane formulae and divine invocations.',
    sigil: '✧',
  },
  equipment: {
    label: 'Equipment',
    singular: 'Equipment',
    description: 'Tools, armor, and weapons for the journey ahead.',
    sigil: '◆',
  },
}

export const spellSchools = [
  ['abjuration', 'Abjuration'],
  ['conjuration', 'Conjuration'],
  ['divination', 'Divination'],
  ['enchantment', 'Enchantment'],
  ['evocation', 'Evocation'],
  ['illusion', 'Illusion'],
  ['necromancy', 'Necromancy'],
  ['transmutation', 'Transmutation'],
] as const

export const spellClasses = [
  ['bard', 'Bard'],
  ['cleric', 'Cleric'],
  ['druid', 'Druid'],
  ['paladin', 'Paladin'],
  ['ranger', 'Ranger'],
  ['sorcerer', 'Sorcerer'],
  ['warlock', 'Warlock'],
  ['wizard', 'Wizard'],
] as const
