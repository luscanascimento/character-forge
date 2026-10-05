import { afterEach, describe, expect, it, vi } from 'vitest'
import { ClassProgressionRequestError, getClassProgression } from './classProgressionApi'

describe('class progression API', () => {
  afterEach(() => vi.restoreAllMocks())

  it('requests the encoded class route and validates the response', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(progressionResponse()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const progression = await getClassProgression('wizard')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/classes/wizard/progression',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    )
    expect(progression.class).toEqual({ id: 'wizard', name: 'Wizard' })
    expect(progression.levels).toHaveLength(20)
  })

  it('returns a typed request error when progression is unavailable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 503 }))

    await expect(getClassProgression('wizard')).rejects.toMatchObject({
      name: 'ClassProgressionRequestError',
      status: 503,
    } satisfies Partial<ClassProgressionRequestError>)
  })
})

function progressionResponse() {
  return {
    class: { id: 'wizard', name: 'Wizard' },
    hitDie: 6,
    levels: Array.from({ length: 20 }, (_, index) => ({
      level: index + 1,
      proficiencyBonus: 2 + Math.floor(index / 4),
      features: [],
    })),
    subclasses: [],
    source: {
      provider: 'D&D 5e SRD API',
      ruleset: '2024',
      rulesVersion: 'SRD-5.2.1',
      fetchedAt: '2026-10-04T12:00:00Z',
    },
  }
}
