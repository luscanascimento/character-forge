import { describe, expect, it } from 'vitest'
import { classProgressionSchema } from './classProgression'

describe('class progression schema', () => {
  it('preserves the trusted level and subclass timeline', () => {
    const progression = classProgressionSchema.parse({
      class: { id: 'wizard', name: 'Wizard' },
      hitDie: 6,
      levels: Array.from({ length: 20 }, (_, index) => ({
        level: index + 1,
        proficiencyBonus: 2 + Math.floor(index / 4),
        features: index === 2 ? [{ id: 'wizard-subclass', name: 'Wizard Subclass' }] : [],
      })),
      subclasses: [
        {
          subclass: { id: 'evoker', name: 'Evoker' },
          availableAtLevel: 3,
          levels: [
            {
              level: 3,
              features: [{ id: 'sculpt-spells', name: 'Sculpt Spells' }],
            },
          ],
        },
      ],
      source: {
        provider: 'D&D 5e SRD API',
        ruleset: '2024',
        rulesVersion: 'SRD-5.2.1',
        fetchedAt: '2026-10-04T12:00:00Z',
      },
    })

    expect(progression.levels).toHaveLength(20)
    expect(progression.subclasses[0]?.availableAtLevel).toBe(3)
    expect(progression.subclasses[0]?.levels[0]?.features[0]?.id).toBe('sculpt-spells')
  })
})
