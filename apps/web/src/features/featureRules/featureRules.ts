import { z } from 'zod'
import { contentReferenceSchema } from '../characters/characterSchemas'

const branchSchema = z.object({
  id: z.string(),
  selectionCount: z.number().int().positive(),
  optionSource: z.enum(['featType', 'classCantrips', 'proficientSkills']),
  availability: z.enum(['supported', 'locked']),
  dependency: z.enum(['spellcasting']).nullable(),
  options: z.array(contentReferenceSchema),
})

const requirementSchema = z.object({
  id: z.string(),
  subclassId: z.string().nullable(),
  featureId: z.string(),
  availableAtLevel: z.number().int().min(1).max(20),
  count: z.number().int().positive(),
  branches: z.array(branchSchema).min(1),
})

export const featureChoiceDocumentSchema = z.object({
  manifestVersion: z.string(),
  ruleset: z.literal('2024'),
  rulesVersion: z.literal('SRD-5.2.1'),
  class: contentReferenceSchema,
  requirements: z.array(requirementSchema),
})

export type FeatureChoiceDocument = z.infer<typeof featureChoiceDocumentSchema>
export type FeatureChoiceRequirement = FeatureChoiceDocument['requirements'][number]
