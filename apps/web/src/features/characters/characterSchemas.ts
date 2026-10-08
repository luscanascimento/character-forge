import { z } from 'zod'

export const currentCharacterSchemaVersion = 1 as const
export const activeRuleset = '2024' as const
export const activeRulesVersion = 'SRD-5.2.1' as const

const catalogIdSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(80)

export const contentReferenceSchema = z.object({
  id: catalogIdSchema,
  name: z.string().min(1),
})

export const abilityScoresSchema = z.object({
  strength: z.number().int().finite(),
  dexterity: z.number().int().finite(),
  constitution: z.number().int().finite(),
  intelligence: z.number().int().finite(),
  wisdom: z.number().int().finite(),
  charisma: z.number().int().finite(),
})

export const characterDraftSchema = z.object({
  name: z.string(),
  abilities: abilityScoresSchema.nullable(),
  species: contentReferenceSchema.nullable(),
  background: contentReferenceSchema.nullable(),
  classProgressions: z.array(
    z.object({
      class: contentReferenceSchema.nullable(),
      level: z.number().int().finite(),
      subclass: contentReferenceSchema.nullable().default(null),
    }),
  ),
  proficiencyChoices: z.array(
    z.object({
      choiceId: z.string().min(1).max(240),
      selections: z.array(contentReferenceSchema),
    }),
  ),
  featureChoices: z
    .array(
      z.object({
        requirementId: z.string().min(1).max(240),
        branchId: z.string().min(1).max(240),
        selections: z.array(contentReferenceSchema),
      }),
    )
    .default([]),
})

const documentIdentitySchema = z.object({
  id: z.string().uuid(),
  ruleset: z.literal(activeRuleset),
  rulesVersion: z.literal(activeRulesVersion),
})

export const storedCharacterV1Schema = documentIdentitySchema.extend({
  schemaVersion: z.literal(currentCharacterSchemaVersion),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  character: characterDraftSchema,
})

export const characterRequestSchema = documentIdentitySchema.extend(characterDraftSchema.shape)

const ruleViolationSchema = z.object({
  code: z.string(),
  message: z.string(),
  source: z.string(),
  severity: z.string(),
  requirement: z.string(),
})

const proficiencySourceSchema = z.object({
  category: z.string(),
  selection: contentReferenceSchema,
})

export const characterEvaluationSchema = z.object({
  validation: z.object({
    violations: z.array(ruleViolationSchema),
    isValid: z.boolean(),
  }),
  derived: z
    .object({
      abilityModifiers: abilityScoresSchema,
      proficiencyBonus: z.number().int(),
      armorClass: z.number().int(),
      hitPointMaximum: z.number().int().nullable(),
      hitDie: z.number().int().positive(),
      grantedProficiencies: z.array(
        z.object({
          proficiency: contentReferenceSchema,
          sources: z.array(proficiencySourceSchema),
          isSkill: z.boolean(),
        }),
      ),
      spellcasting: z
        .object({
          ability: contentReferenceSchema,
          cantripsKnown: z.number().int().min(0).max(6),
          preparedSpells: z.number().int().min(0).max(22),
          slots: z.array(
            z.object({
              spellLevel: z.number().int().min(1).max(9),
              count: z.number().int().min(1).max(4),
            }),
          ),
        })
        .nullable()
        .optional(),
    })
    .nullable(),
})

export type CharacterDraft = z.infer<typeof characterDraftSchema>
export type StoredCharacterV1 = z.infer<typeof storedCharacterV1Schema>
export type CharacterRequest = z.infer<typeof characterRequestSchema>
export type CharacterEvaluation = z.infer<typeof characterEvaluationSchema>

type NewStoredCharacterOptions = {
  id?: string
  now?: Date
}

export function createStoredCharacterDraft({
  id = globalThis.crypto.randomUUID(),
  now = new Date(),
}: NewStoredCharacterOptions = {}): StoredCharacterV1 {
  const timestamp = now.toISOString()

  return storedCharacterV1Schema.parse({
    schemaVersion: currentCharacterSchemaVersion,
    id,
    ruleset: activeRuleset,
    rulesVersion: activeRulesVersion,
    createdAt: timestamp,
    updatedAt: timestamp,
    character: {
      name: '',
      abilities: null,
      species: null,
      background: null,
      classProgressions: [{ class: null, level: 1, subclass: null }],
      proficiencyChoices: [],
      featureChoices: [],
    },
  })
}

export function duplicateStoredCharacter(
  source: StoredCharacterV1,
  { id = globalThis.crypto.randomUUID(), now = new Date() }: NewStoredCharacterOptions = {},
): StoredCharacterV1 {
  const timestamp = now.toISOString()
  const sourceName = source.character.name.trim()

  return storedCharacterV1Schema.parse({
    ...source,
    id,
    createdAt: timestamp,
    updatedAt: timestamp,
    character: {
      ...source.character,
      name: `${sourceName || 'Untitled character'} (Copy)`,
    },
  })
}

export function toCharacterRequest(document: StoredCharacterV1): CharacterRequest {
  return characterRequestSchema.parse({
    id: document.id,
    ruleset: document.ruleset,
    rulesVersion: document.rulesVersion,
    ...document.character,
  })
}
