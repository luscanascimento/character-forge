import { afterEach, describe, expect, it, vi } from 'vitest'
import { FeatureRulesRequestError, getFeatureChoices } from './featureRulesApi'

describe('feature rules API', () => {
  afterEach(() => vi.restoreAllMocks())

  it('requests and validates manifest-backed class choices', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(featureChoiceResponse()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const document = await getFeatureChoices('paladin')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/classes/paladin/feature-choices',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    )
    expect(document.requirements[0]?.branches[0]?.options[0]?.id).toBe('archery')
    expect(document.requirements[0]?.branches[0]?.optionSource).toBe('featType')
    expect(document.requirements[0]?.branches[1]?.availability).toBe('locked')
  })

  it('returns a typed request error when feature rules are unavailable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 503 }))

    await expect(getFeatureChoices('paladin')).rejects.toMatchObject({
      name: 'FeatureRulesRequestError',
      status: 503,
    } satisfies Partial<FeatureRulesRequestError>)
  })
})

function featureChoiceResponse() {
  return {
    manifestVersion: 'SRD-5.2.1-CF-2',
    ruleset: '2024',
    rulesVersion: 'SRD-5.2.1',
    class: { id: 'paladin', name: 'Paladin' },
    requirements: [
      {
        id: 'paladin-fighting-style',
        subclassId: null,
        featureId: 'paladin-fighting-style',
        availableAtLevel: 2,
        count: 1,
        branches: [
          {
            id: 'fighting-style-feat',
            selectionCount: 1,
            optionSource: 'featType',
            availability: 'supported',
            dependency: null,
            options: [{ id: 'archery', name: 'Archery' }],
          },
          {
            id: 'blessed-warrior',
            selectionCount: 2,
            optionSource: 'classCantrips',
            availability: 'locked',
            dependency: 'spellcasting',
            options: [],
          },
        ],
      },
    ],
  }
}
