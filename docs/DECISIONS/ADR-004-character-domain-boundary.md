# ADR-004: Keep draft shape separate from validity

- Status: accepted
- Date: 2026-09-29

## Context

The builder must eventually preserve incomplete choices while still relying on one canonical rules implementation. A character shape that can only represent a fully valid character would force partial form state into a second, unrelated model. A model that silently accepts unsupported rules versions or multiclass calculations would make results untrustworthy.

## Decision

The initial `Character` aggregate is a versioned draft-capable document containing:

- a UUID and name;
- `ruleset: "2024"` and `rulesVersion: "SRD-5.2.1"`;
- all six ability scores;
- species and background catalog references containing stable ids and display names;
- a `classProgressions` collection containing class references and levels.
- proficiency-choice selections keyed by stable normalized choice ids.

The collection keeps the document extensible, but the current validator requires exactly one class. Unsupported rules identities, incomplete choices, invalid references, ability scores outside 1–30, and class levels outside 1–20 produce structured `RuleViolation` values instead of exceptions. Pure calculators reject values outside their rule bounds.

`POST /api/characters/validate` is the canonical validation/calculation boundary. It never stores character data and returns derived values only for a wholly valid document. The browser may retain invalid drafts in Phase 4, but it must not treat them as validated domain state.

The builder may calculate a bounded ability-modifier preview for scores from 1–30 so users can understand an input before the full draft is valid. The UI must label that value as a preview, use the same pure floor-division formula, and never treat it as a canonical evaluated result. Server validation remains authoritative.

Rule facts are not part of the draft. The application resolves selected catalog references into a trusted `CharacterRulesContext` before evaluation, preventing a client from changing values such as a class hit die.

## Consequences

- The builder can preserve and explain incomplete drafts without duplicating the domain's legality rules.
- A saved document and a validated character use the same shape but have different trust levels.
- Multiclassing remains representable as future data without being implemented or accepted today.
- Adding timestamps and `schemaVersion` remains a Phase 4 persistence-envelope concern.
- Small presentation previews can make incomplete drafts understandable without moving character validity into the browser.
