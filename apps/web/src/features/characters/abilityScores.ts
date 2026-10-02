export const minimumAbilityScore = 1
export const maximumAbilityScore = 30

export function abilityModifierPreview(score: number): number | null {
  if (!Number.isInteger(score) || score < minimumAbilityScore || score > maximumAbilityScore) {
    return null
  }

  return Math.floor((score - 10) / 2)
}

export function formatModifier(modifier: number): string {
  return modifier >= 0 ? `+${modifier}` : String(modifier)
}
