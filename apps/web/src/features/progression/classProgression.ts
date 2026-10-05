import { z } from 'zod'

const referenceSchema = z.object({
  id: z.string(),
  name: z.string(),
})

const levelSchema = z.object({
  level: z.number().int().min(1).max(20),
  proficiencyBonus: z.number().int(),
  features: z.array(referenceSchema),
})

const subclassLevelSchema = z.object({
  level: z.number().int().min(1).max(20),
  features: z.array(referenceSchema),
})

export const classProgressionSchema = z.object({
  class: referenceSchema,
  hitDie: z.number().int().positive(),
  levels: z.array(levelSchema).length(20),
  subclasses: z.array(
    z.object({
      subclass: referenceSchema,
      availableAtLevel: z.number().int().min(1).max(20),
      levels: z.array(subclassLevelSchema),
    }),
  ),
  source: z.object({
    provider: z.string(),
    ruleset: z.string(),
    rulesVersion: z.string(),
    fetchedAt: z.string(),
  }),
})

export type ClassProgressionDocument = z.infer<typeof classProgressionSchema>
