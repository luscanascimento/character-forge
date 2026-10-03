# ADR-007: Normalize class progression separately from spellcasting

- Status: accepted and implemented
- Date: 2026-10-03

## Context

The 2024 provider exposes one 1–20 level table per class and a sparse level table per subclass. Class levels combine stable feature references and proficiency bonuses with spellcasting tables and class-specific counters whose shapes vary by class. Subclass detail also repeats narrative feature text separately from its level resources.

Forwarding those payloads would couple Character Forge to provider field names and would pull Phase 6 spellcasting into Phase 5. The builder also needs an explicit policy for choices that become unavailable when a character's level decreases.

## Decision

Expose class progression through `GET /api/classes/{classId}/progression` as a provider-neutral contract containing:

- the canonical class reference and hit die;
- exactly twenty ordered class levels with canonical proficiency bonus and feature references;
- every SRD subclass for that class, its first available level, and its sparse ordered feature levels;
- the observed provider, ruleset, rules version, and fetch time.

The adapter rejects incomplete 1–20 class tables, invalid proficiency bonuses, unsupported hit dice, duplicate subclass levels, and class/subclass reference mismatches as provider failures. The normalized result is cached with the existing SRD cache duration.

Spellcasting fields and class-specific counters are not part of this first contract. They require separate normalized rule models when their owning phases need them. Feature descriptions and level-dependent choice semantics will be resolved from feature resources in a later Phase 5 slice instead of being inferred from names.

Changing a level must never silently delete a persisted subclass, feature, or choice. Future progression validation will retain the saved reference and return a structured violation that explains its current level requirement; the UI may offer an explicit removal or replacement action.

## Consequences

- The frontend can present a trustworthy level and subclass timeline without understanding provider DTOs.
- Hit die and proficiency facts needed for HP/progression rules stay typed and can be checked against canonical domain rules.
- Spellcasting and per-class resource mechanics remain intentionally deferred instead of leaking into a generic dictionary.
- Feature-choice normalization and level-change validation remain required before progression controls can safely persist new selections.
