# ADR-025: Apply typed Archery and Defense Fighting Style effects

- Status: accepted
- Date: 2026-10-18

## Context

Fighting Style selections are already canonical, persisted feature choices backed by provider-verified fighting-style feats. Their benefits remain narrative-only upstream. Two supported styles map directly onto existing derived values: Archery adds 2 to ranged-weapon attack rolls, and Defense adds 1 Armor Class while Light, Medium, or Heavy armor is worn.

## Decision

Versioned manifest `SRD-5.2.1-FS-1` owns the Archery and Defense semantics with SRD 5.2.1 page provenance. Active effects are resolved only from selections in the canonical `fighting-style-feat` branch. The same non-repeatable feat cannot be selected through multiple Fighting Style occurrences.

Archery contributes 2 only to attacks whose normalized weapon kind is `ranged`; it does not change damage or melee attacks. Defense contributes 1 only when exactly one valid body armor is equipped; a Shield alone and the unarmored state do not qualify.

## Consequences

- Provider names and descriptions never drive combat calculations at runtime.
- Existing attack and armor pipelines remain the owners of final modifiers.
- Great Weapon Fighting and Two-Weapon Fighting remain unsupported until attack configuration models the hands and extra-attack facts their effects require.
