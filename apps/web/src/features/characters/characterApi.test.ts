import { afterEach, describe, expect, it, vi } from 'vitest'
import { createStoredCharacter } from '../../test/characterFixture'
import {
  CharacterValidationRequestError,
  evaluateFeatEligibility,
  validateCharacter,
  validateSpellReplacement,
} from './characterApi'

describe('character validation API', () => {
  afterEach(() => vi.restoreAllMocks())

  it('sends only the canonical character request and validates the response', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          validation: { isValid: false, violations: [] },
          derived: null,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    const result = await validateCharacter(createStoredCharacter())

    expect(result.derived).toBeNull()
    const request = fetchMock.mock.calls[0]
    expect(request?.[0]).toBe('/api/characters/validate')
    const body = JSON.parse((request?.[1]?.body as string) ?? '{}') as Record<string, unknown>
    expect(body).toMatchObject({
      id: 'f33771b4-ae75-47b6-bad0-df2a80896a67',
      ruleset: '2024',
      rulesVersion: 'SRD-5.2.1',
      name: 'Arannis',
    })
    expect(body).not.toHaveProperty('schemaVersion')
    expect(body).not.toHaveProperty('createdAt')
    expect(body).not.toHaveProperty('character')
    expect(body).toHaveProperty('equipment', { items: [] })
  })

  it('returns a typed request error for unavailable validation', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 503 }))

    await expect(validateCharacter(createStoredCharacter())).rejects.toMatchObject({
      name: 'CharacterValidationRequestError',
      status: 503,
    } satisfies Partial<CharacterValidationRequestError>)
  })

  it('sends canonical previous and current states for spell replacement validation', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          validation: { isValid: false, violations: [] },
          derived: null,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const previous = createStoredCharacter()
    const current = {
      ...previous,
      updatedAt: '2026-10-08T18:00:00.000Z',
      character: {
        ...previous.character,
        classProgressions: [
          {
            ...previous.character.classProgressions[0]!,
            level: 2,
          },
        ],
      },
    }

    await validateSpellReplacement(previous, current, 'classLevelGained')

    const request = fetchMock.mock.calls[0]
    expect(request?.[0]).toBe('/api/characters/validate-spell-replacement')
    const body = JSON.parse((request?.[1]?.body as string) ?? '{}') as Record<string, unknown>
    expect(body).toMatchObject({
      trigger: 'classLevelGained',
      previous: { id: previous.id, classProgressions: [{ level: 1 }] },
      current: { id: current.id, classProgressions: [{ level: 2 }] },
    })
    expect(body.previous).not.toHaveProperty('schemaVersion')
    expect(body.current).not.toHaveProperty('updatedAt')
  })

  it('sends a canonical character and feat id for eligibility evaluation', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          validation: { isValid: true, violations: [] },
          feat: {
            feat: { id: 'grappler', name: 'Grappler' },
            type: 'general',
            isRepeatable: false,
            meetsPrerequisites: true,
            effectsSupported: false,
            canSelect: false,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const character = createStoredCharacter()

    const result = await evaluateFeatEligibility(character, 'grappler')

    expect(result.feat).toMatchObject({
      feat: { id: 'grappler' },
      meetsPrerequisites: true,
      effectsSupported: false,
      canSelect: false,
    })
    const request = fetchMock.mock.calls[0]
    expect(request?.[0]).toBe('/api/characters/evaluate-feat')
    const body = JSON.parse((request?.[1]?.body as string) ?? '{}') as Record<string, unknown>
    expect(body).toMatchObject({
      featId: 'grappler',
      character: { id: character.id, rulesVersion: 'SRD-5.2.1' },
    })
    expect(body.character).not.toHaveProperty('schemaVersion')
  })

  it('sends and validates a typed Ability Score Improvement effect', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          validation: { isValid: true, violations: [] },
          feat: {
            feat: { id: 'ability-score-improvement', name: 'Ability Score Improvement' },
            type: 'general',
            isRepeatable: true,
            meetsPrerequisites: true,
            effectsSupported: true,
            canSelect: true,
            resultingAbilities: {
              strength: 8,
              dexterity: 14,
              constitution: 13,
              intelligence: 13,
              wisdom: 11,
              charisma: 16,
            },
            effectManifestVersion: 'SRD-5.2.1-FEAT-1',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const character = createStoredCharacter()
    const effect = {
      increases: [
        { abilityId: 'int' as const, increase: 1 },
        { abilityId: 'wis' as const, increase: 1 },
      ],
    }

    const result = await evaluateFeatEligibility(character, 'ability-score-improvement', effect)

    expect(result.feat).toMatchObject({
      effectsSupported: true,
      canSelect: true,
      resultingAbilities: { intelligence: 13, wisdom: 11 },
      effectManifestVersion: 'SRD-5.2.1-FEAT-1',
    })
    const request = fetchMock.mock.calls[0]
    const body = JSON.parse((request?.[1]?.body as string) ?? '{}') as Record<string, unknown>
    expect(body).toMatchObject({
      featId: 'ability-score-improvement',
      abilityScoreImprovement: effect,
    })
  })
})
