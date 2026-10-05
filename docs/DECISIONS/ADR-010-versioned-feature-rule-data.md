# ADR-010: Own a narrow, versioned feature-rule manifest

- Status: accepted
- Date: 2026-10-04

## Context

ADR-009 prohibited inferring choices and prerequisites from narrative feature descriptions. A follow-up audit compared SRD 5.2.1 with the provider's 2024 database schemas.

The provider already structures useful pieces: repeated feature references by level, feat types, some feat prerequisites, equipment/mastery references, and some class-specific counters. It does not connect those pieces into complete feature-choice requirements. Counts and eligibility for Expertise remain prose-only; several Weapon Mastery counts are absent; and Paladin/Ranger Fighting Style alternatives contain nested spell choices only in descriptions.

Using only the provider would leave valid SRD options unavailable. Copying the entire SRD into application data would duplicate large amounts of content and create an unnecessary second catalog.

## Decision

Adopt a hybrid rules boundary:

- The live provider remains authoritative for catalog identities, display names, option lists, feature occurrences, and every rule fact it exposes structurally.
- Character Forge owns a narrow typed manifest for missing choice semantics needed by canonical validation.
- The initial manifest version is `SRD-5.2.1-CF-1`, independent from document schema version and provider observation time.
- Each manifest entry records stable ids, normalized semantics, and SRD section/page provenance. It contains no copied narrative description.
- Provider facts and manifest facts must agree on referenced ids. A mismatch fails closed as a rules-content error.
- Updating an existing rule fact requires a manifest-version change and focused tests; adding a new entry requires provenance and focused tests.
- Spell selections, equipment eligibility/effects, and feat effects remain owned by their roadmap phases even when an earlier feature references them.
- The API exposes a normalized hybrid feature-choice document so the builder never has to reproduce manifest matching rules or infer them from feature names.
- Saved feature choices keep the manifest requirement id, branch id, and canonical provider option references. Progression changes retain but invalidate choices that are no longer active until the user removes them explicitly.
- Character-dependent option sources stay declarative in the class feature document. Expertise options are resolved from canonical skill grants only after proficiency choices are known, and a skill already selected by an earlier Expertise requirement is excluded.

## Consequences

- Level-dependent rules can be trustworthy without parsing mutable prose.
- The locally maintained surface stays small and reviewable instead of becoming a fork of the upstream catalog.
- The application can distinguish its rules-data revision from `SRD-5.2.1`, local character schema version, and provider fetch time.
- Some valid choices will remain locked until their dependent phase exists, but the UI can explain the precise dependency.
- The first implementation slice will normalize provider feat prerequisites before adding Fighting Style persistence and validation.

## Implementation note

Manifest `SRD-5.2.1-CF-1` now defines the Fighter, Champion, Paladin, and Ranger Fighting Style requirements. It verifies manifest feature ids and levels against normalized progression data, verifies candidate feats against provider-owned structured prerequisites, and keeps the Paladin/Ranger cantrip alternatives locked behind the spellcasting dependency.
