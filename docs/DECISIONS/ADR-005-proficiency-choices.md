# ADR-005: Normalize proficiency choices before domain validation

- Status: accepted and implemented
- Date: 2026-09-29

## Context

The 2024 provider represents proficiency choices in several external shapes. Classes and the Soldier background expose choice arrays, species such as Elf and Human reference traits that contain a choice object, and the Monk nests tool families inside an outer choice. Persisting that provider tree would couple character documents and rules to an evolving API.

SRD 5.2.1 states that a Proficiency Bonus does not stack. Unlike SRD 5.1, it does not define a general rule allowing a duplicate proficiency from another source to be replaced with any proficiency of the same kind.

## Decision

Normalize every supported proficiency requirement to a provider-neutral contract containing a stable choice id, prompt, required count, and canonical option references. Equivalent nested option families are flattened into one option list while preserving the outer required count.

The draft character stores each choice id with selected proficiency references. Canonical validation:

- requires every currently applicable choice exactly once;
- requires the declared number of distinct selections;
- accepts only canonical options for that choice;
- rejects stale choice ids and duplicate selections across choices or fixed grants;
- uses canonical names from normalized content rather than trusting display names from the draft.

Fixed grants that overlap are merged because the bonus cannot stack. Character Forge does not offer an unrestricted replacement choice that SRD 5.2.1 does not specify.

## Consequences

- Character documents remain independent of provider option DTOs.
- Species detail resolution fetches referenced traits and caches the resulting normalized species detail through `CatalogService`.
- A provider-shape change is contained in the adapter and its focused fixtures.
- Supporting a future explicit replacement rule requires a new normalized rule fact rather than a UI-only exception.
