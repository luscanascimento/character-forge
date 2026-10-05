import { describe, expect, it } from 'vitest'
import { catalogItemSchema } from './catalog'

describe('catalog item schema', () => {
  it('preserves normalized character creation facts', () => {
    const item = catalogItemSchema.parse({
      id: 'wizard',
      name: 'Wizard',
      category: 'classes',
      description: [],
      attributes: [],
      sections: [],
      textSections: [],
      characterCreation: {
        hitDie: 6,
        grantedProficiencies: [{ id: 'simple-weapons', name: 'Simple Weapons' }],
        proficiencyChoices: [
          {
            id: 'classes/wizard/proficiencies/0',
            prompt: 'Choose two skills',
            count: 2,
            options: [
              { id: 'skill-arcana', name: 'Skill: Arcana' },
              { id: 'skill-history', name: 'Skill: History' },
            ],
          },
        ],
      },
      source: {
        provider: 'D&D 5e SRD API',
        ruleset: '2024',
        rulesVersion: 'SRD-5.2.1',
        fetchedAt: '2026-09-29T12:00:00Z',
      },
    })

    expect(item.characterCreation?.hitDie).toBe(6)
    expect(item.characterCreation?.proficiencyChoices[0]?.options).toHaveLength(2)
  })

  it('preserves normalized feat prerequisites', () => {
    const item = catalogItemSchema.parse({
      id: 'grappler',
      name: 'Grappler',
      category: 'feats',
      description: [],
      attributes: [{ label: 'Type', value: 'General' }],
      sections: [],
      feat: {
        type: 'general',
        minimumLevel: 4,
        requiredFeature: null,
        isRepeatable: false,
        abilityScorePrerequisite: {
          count: 1,
          options: [
            { ability: { id: 'str', name: 'STR' }, minimumScore: 13 },
            { ability: { id: 'dex', name: 'DEX' }, minimumScore: 13 },
          ],
        },
      },
      source: {
        provider: 'D&D 5e SRD API',
        ruleset: '2024',
        rulesVersion: 'SRD-5.2.1',
        fetchedAt: '2026-10-04T12:00:00Z',
      },
    })

    expect(item.feat).toMatchObject({
      type: 'general',
      minimumLevel: 4,
      isRepeatable: false,
    })
    expect(item.feat?.abilityScorePrerequisite?.options).toHaveLength(2)
  })
})
