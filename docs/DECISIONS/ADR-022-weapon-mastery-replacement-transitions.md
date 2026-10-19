# ADR-022: Validate Weapon Mastery replacement as a Long Rest transition

- Status: accepted
- Date: 2026-10-18

## Context

An active Weapon Mastery feature permits one mastered weapon kind to be replaced after a Long Rest. A single character document cannot prove whether a choice was retained, added through capacity, or replaced, and mutable event history does not belong in the creation draft.

## Decision

Character Forge adds `POST /api/characters/validate-weapon-mastery-replacement`. The request carries canonical previous and current character states plus the explicit `longRest` trigger. Both states must first pass complete canonical evaluation.

The transition requires the same character, class, and class level. It compares stable weapon ids case-insensitively, preserves the active capacity, and permits at most one removed choice paired with one added choice. An unchanged state is valid. A character without active Weapon Mastery choices cannot use the transition.

## Consequences

- Replacement limits are enforceable without storing rest history in local drafts.
- Both sides retain the existing ownership, training, catalog identity, and exact-capacity validation.
- A schema-validated frontend adapter is available for future character-lifecycle UI.
