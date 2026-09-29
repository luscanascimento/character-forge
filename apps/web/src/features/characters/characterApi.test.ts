import { afterEach, describe, expect, it, vi } from 'vitest'
import { createStoredCharacter } from '../../test/characterFixture'
import { CharacterValidationRequestError, validateCharacter } from './characterApi'

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
  })

  it('returns a typed request error for unavailable validation', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 503 }))

    await expect(validateCharacter(createStoredCharacter())).rejects.toMatchObject({
      name: 'CharacterValidationRequestError',
      status: 503,
    } satisfies Partial<CharacterValidationRequestError>)
  })
})
