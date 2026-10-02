import { describe, expect, it } from 'vitest'
import { abilityModifierPreview, formatModifier } from './abilityScores'

describe('ability score presentation', () => {
  it.each([
    [1, -5],
    [8, -1],
    [9, -1],
    [10, 0],
    [11, 0],
    [12, 1],
    [30, 10],
  ])('previews the modifier for score %i', (score, modifier) => {
    expect(abilityModifierPreview(score)).toBe(modifier)
  })

  it.each([0, 31, 10.5, Number.NaN])('refuses a preview outside display bounds', (score) => {
    expect(abilityModifierPreview(score)).toBeNull()
  })

  it('formats non-negative modifiers with an explicit sign', () => {
    expect(formatModifier(2)).toBe('+2')
    expect(formatModifier(0)).toBe('+0')
    expect(formatModifier(-1)).toBe('-1')
  })
})
