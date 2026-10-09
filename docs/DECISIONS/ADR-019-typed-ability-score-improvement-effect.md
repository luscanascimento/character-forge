# ADR-019: Type Ability Score Improvement before persisting feat choices

- Status: accepted and implemented
- Date: 2026-10-09

## Context

The provider structures Ability Score Improvement as a repeatable general feat with a level prerequisite, but its state-changing benefit exists only in narrative text. Treating the description as executable rules would violate the Phase 7 boundary, while marking the feat selectable from prerequisite data alone would accept characters without validating the chosen increases or the feat-specific score maximum.

Feat-choice persistence also needs a later explicit link to each active class-progression occurrence. Adding that ownership shape in the same increment would conflate effect semantics with acquisition and risk double-applying increases to the draft's existing ability scores.

## Decision

Manifest `SRD-5.2.1-FEAT-1` owns the narrow Ability Score Improvement effect, with provenance at SRD 5.2.1 page 86. It verifies that the live canonical feat still has the expected id, name, general type, level-4 minimum, repeatability, and absence of other structured prerequisites.

`POST /api/characters/evaluate-feat` accepts an optional typed `abilityScoreImprovement` proposal. For the canonical feat it requires exactly one ability increased by 2 or two distinct abilities increased by 1, accepts only the six canonical ability ids, and prevents either resulting score from exceeding 20. A valid response includes the resulting six scores and the effect-manifest version.

Prerequisite eligibility, effect support, effect validity, and final selectability remain separate response facts. Other feats remain effect-unsupported, and submitting an Ability Score Improvement effect for one of them is a structured validation error. The endpoint previews a proposal and does not mutate or persist the character.

## Consequences

- Ability Score Improvement semantics no longer depend on provider prose at runtime.
- Provider drift fails closed before the typed effect can be selected.
- The frontend has a schema-validated request and response contract ready for a future progression choice UI.
- Canonical feat ownership, repeated acquisition, and the base-versus-effective ability boundary remain required before feat choices enter stored drafts.
