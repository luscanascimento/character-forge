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
        equipmentChoices: [
          {
            id: 'classes/wizard/equipment/0',
            prompt: 'Choose a spellcasting focus',
            count: 1,
            options: [
              {
                kind: 'choice',
                quantity: 1,
                choice: {
                  id: 'classes/wizard/equipment/0/options/0/choice',
                  prompt: 'Choose an Arcane Focus',
                  count: 1,
                  options: [],
                  equipmentCategory: { id: 'arcane-foci', name: 'Arcane Foci' },
                },
              },
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
    expect(
      item.characterCreation?.equipmentChoices[0]?.options[0]?.choice?.equipmentCategory?.id,
    ).toBe('arcane-foci')
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

  it('preserves normalized weapon and armor facts', () => {
    const source = {
      provider: 'D&D 5e SRD API',
      ruleset: '2024',
      rulesVersion: 'SRD-5.2.1',
      fetchedAt: '2026-10-09T12:00:00Z',
    }
    const weapon = catalogItemSchema.parse({
      id: 'longsword',
      name: 'Longsword',
      category: 'equipment',
      description: [],
      attributes: [],
      sections: [],
      source,
      equipment: {
        categories: [{ id: 'weapons', name: 'Weapons' }],
        cost: { quantity: 15, unit: 'gp' },
        weight: 3,
        weapon: {
          damage: { dice: '1d8', type: { id: 'slashing', name: 'Slashing' } },
          twoHandedDamage: {
            dice: '1d10',
            type: { id: 'slashing', name: 'Slashing' },
          },
          range: { normal: 5, long: null },
          properties: [{ id: 'versatile', name: 'Versatile' }],
          mastery: { id: 'sap', name: 'Sap' },
        },
        armor: null,
      },
    })
    const armor = catalogItemSchema.parse({
      id: 'chain-mail',
      name: 'Chain Mail',
      category: 'equipment',
      description: [],
      attributes: [],
      sections: [],
      source,
      equipment: {
        categories: [{ id: 'armor', name: 'Armor' }],
        cost: { quantity: 75, unit: 'gp' },
        weight: 55,
        weapon: null,
        armor: {
          baseArmorClass: 16,
          addsDexterity: false,
          maximumDexterityBonus: null,
          strengthMinimum: 13,
          imposesStealthDisadvantage: true,
        },
      },
    })

    expect(weapon.equipment?.weapon?.mastery.id).toBe('sap')
    expect(armor.equipment?.armor?.baseArmorClass).toBe(16)
  })
})
