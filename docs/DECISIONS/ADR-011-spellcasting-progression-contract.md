# ADR-011: Normalize structured spellcasting progression before selection rules

- Status: accepted and implemented
- Date: 2026-10-07

## Context

The provider's 2024 class detail identifies a spellcasting start level and ability. Each spellcasting class-level row supplies cantrips known, prepared level-1+ spells, and slot counts for spell levels 1–9. These are useful structured facts, but the surrounding prose still owns important behavior: when a prepared list can change, how many entries can change, the Wizard's spellbook boundary, standard versus Pact Magic slot recovery, and the Warlock's higher-level Mystic Arcanum spells.

Treating every class as the same kind of prepared caster would therefore turn incomplete provider data into false canonical rules. Leaving spellcasting inside the provider DTO would instead force clients to understand field names that are not part of the Character Forge contract.

## Decision

Extend the normalized class progression document with an optional spellcasting model:

- `availableAtLevel` and the canonical spellcasting ability come from class detail.
- Each spellcasting row has an explicit `classLevel`, cantrip and prepared-spell capacities, and positive slot capacities.
- Every slot capacity carries its own `spellLevel`; spell level is never inferred from character level, class level, or array position by consumers.
- Zero-capacity slots are omitted from the public contract so the positive entries directly express availability.
- A non-spellcasting class returns `spellcasting: null`.
- A casting class must supply every row from its declared start level through 20, all eleven observed progression fields, non-negative capacities, and at least one slot at each supported level. A mismatch fails at the provider boundary.
- Selection replacement cadence, spellbook contents, slot recovery, always-prepared grants, and Mystic Arcanum remain outside this first contract until Character Forge owns explicit typed rules with SRD provenance.

The spellcasting model travels with the existing class progression response because it comes from the same class detail and level-table fetch. It remains a separate nested contract rather than being flattened into generic class-level counters.

## Consequences

- The API and frontend can reason about spell level independently from class level.
- Structured cantrip, prepared-spell, and slot capacities are usable without leaking provider field names.
- Malformed or partial upstream tables cannot silently produce partial spell availability.
- The contract does not yet authorize spell selection: class-specific preparation and recovery behavior still needs an explicit rule source.
- Warlock slot rows remain accurately represented as positive capacities at their current slot level, but no standard/Pact recovery claim is made yet.
