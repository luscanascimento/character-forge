# ADR-027: Phase 7 completion boundary

**Status:** Accepted  
**Date:** 2026-10-19

## Context

Phase 7 now owns the structured equipment catalog, character inventory and equipped state, armor calculations, weapon attacks, Weapon Mastery selections and replacements, feat prerequisites, Ability Score Improvement, and the Archery and Defense Fighting Style effects.

The remaining SRD feat and Fighting Style descriptions depend on state that the current character aggregate does not represent, including free-hand state, attack sequences, bonus-action choices, reactions, resource use, targets, and dice-roll execution. The upstream provider exposes those effects as narrative text rather than typed rule facts.

## Decision

Close Phase 7 at the currently supported, source-backed boundary.

Character Forge will continue to show unsupported feats as catalog content, but it will not persist or apply their effects. A future feature may add one only after all required character and event state is explicit, its semantics are represented by a typed and versioned manifest, and canonical validation can fail closed.

The completion audit treats the following as complete Phase 7 behavior:

- prerequisite evaluation remains separate from effect support;
- Ability Score Improvement is the only general feat with a persisted typed effect;
- Archery and Defense are the only Fighting Style feats with active combat effects;
- unsupported narrative effects never influence derived values;
- retained equipment, mastery, attack, and feat choices invalidate non-destructively when their prerequisites disappear.

## Consequences

- Phase 8 can build a sheet from canonical evaluated values without implying broader feat support.
- The known-limitations list must continue naming unsupported feat effects.
- Adding another effect requires new modeled state and focused rules tests, not description parsing or display-name inference.
