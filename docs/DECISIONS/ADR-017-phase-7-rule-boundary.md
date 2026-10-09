# ADR-017: Stage feat and equipment rules behind normalized ownership

- Status: accepted
- Date: 2026-10-09

## Context

Phase 7 joins several rule families whose provider coverage is uneven. Equipment detail is highly structured, and class/background starting packages are structured recursive choices. Feat eligibility is partly structured, but feat effects remain narrative. Weapon Mastery connects class capacities, weapon proficiency, owned weapons, and each weapon's mastery property.

Implementing those concerns as one generic choice model would either leak provider option trees into the browser or make narrative text authoritative. Exposing Ability Score Improvement or Weapon Mastery before their effects and eligibility are canonical would create apparently valid characters whose derived rules are incomplete.

## Decision

Character Forge will stage Phase 7 in dependency order:

- Normalize provider-owned equipment facts and starting-equipment choices into bounded contracts.
- Represent owned and equipped items explicitly; starting packages are one way to create ownership, not permanent ownership state.
- Resolve armor, Shield, weapon, and mastery eligibility from stable equipment-category and proficiency ids.
- Evaluate feat prerequisites from canonical character state and provider-owned structured facts.
- Keep a feat unavailable for character selection until its state-changing effects have a typed, versioned implementation.
- Add missing Weapon Mastery capacities and feat effects only through narrow manifests carrying SRD provenance and fail-closed agreement checks.
- Retain invalidated selections and surface structured violations instead of silently deleting or replacing them.

Catalog descriptions remain presentation-only. No rule may be derived from prose, display-name matching, or an assumed provider default.

## Consequences

- Equipment ownership becomes the shared foundation for AC, attacks, starting packages, and Weapon Mastery.
- Provider category references must be normalized and preserved rather than flattened to text.
- Ability Score Improvement cannot be exposed merely because its feat catalog record exists.
- The builder can explain unsupported or invalid choices without accepting partially modeled effects.
- Phase 7 can ship in independently tested increments while preserving the canonical server boundary.

## Implementation note

The first implementation increments normalize equipment detail and starting-package choice trees, then add `POST /api/characters/evaluate-feat`. Feat evaluation resolves canonical character state and progression before checking provider-owned minimum-level, ability-score, and named-feature prerequisites. ADR-019 adds the first typed effect through manifest `SRD-5.2.1-FEAT-1`: Ability Score Improvement proposals are validated and previewed without yet authorizing draft persistence or progression choices. Other general feat effects remain unsupported.
