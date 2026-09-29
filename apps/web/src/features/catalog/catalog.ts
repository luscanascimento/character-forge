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

const characterCreationSchema = z.object({
  hitDie: z.number().int().positive().nullable(),
  grantedProficiencies: z.array(referenceSchema),
  proficiencyChoices: z.array(
    z.object({
      id: z.string(),
      prompt: z.string(),
      count: z.number().int().positive(),
      options: z.array(referenceSchema),
    }),
  ),
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
})

export type CatalogPage = z.infer<typeof catalogPageSchema>
export type CatalogItem = z.infer<typeof catalogItemSchema>

export interface CatalogFilters {
  search?: string
  page?: number
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
