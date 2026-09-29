import { z } from 'zod'

export const appMetaSchema = z.object({
  name: z.string(),
  ruleset: z.literal('2024'),
  rulesVersion: z.literal('SRD-5.2.1'),
  status: z.literal('ready'),
})

export type AppMeta = z.infer<typeof appMetaSchema>
