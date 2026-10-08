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

const spellcastingSchema = z
  .object({
    availableAtLevel: z.number().int().min(1).max(20),
    ability: referenceSchema,
    levels: z.array(
      z.object({
        classLevel: z.number().int().min(1).max(20),
        cantripsKnown: z.number().int().min(0).max(6),
        preparedSpells: z.number().int().min(0).max(22),
        slots: z.array(
          z.object({
            spellLevel: z.number().int().min(1).max(9),
            count: z.number().int().min(1).max(4),
          }),
        ),
      }),
    ),
  })
  .superRefine((spellcasting, context) => {
    const expectedLevels = 21 - spellcasting.availableAtLevel
    if (spellcasting.levels.length !== expectedLevels) {
      context.addIssue({
        code: 'custom',
        path: ['levels'],
        message: 'Spellcasting progression must continue through class level 20.',
      })
    }

    spellcasting.levels.forEach((level, index) => {
      if (level.classLevel !== spellcasting.availableAtLevel + index) {
        context.addIssue({
          code: 'custom',
          path: ['levels', index, 'classLevel'],
          message: 'Spellcasting class levels must be complete and ordered.',
        })
      }

      if (
        level.slots.length === 0 ||
        level.slots.some(
          (slot, slotIndex) => slot.spellLevel <= (level.slots[slotIndex - 1]?.spellLevel ?? 0),
        )
      ) {
        context.addIssue({
          code: 'custom',
          path: ['levels', index, 'slots'],
          message: 'Spell slots must be present and ordered by unique spell level.',
        })
      }
    })
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
  spellcasting: spellcastingSchema.nullable().optional(),
})

export type ClassProgressionDocument = z.infer<typeof classProgressionSchema>
