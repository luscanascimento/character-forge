# ADR-021: Persist explicit weapon attack configurations

- Status: accepted
- Date: 2026-10-18

## Context

Owned equipment establishes inventory, but it does not identify which weapons are currently wielded or which eligible ability a character uses for an attack. Weapon catalog facts already provide damage, optional two-handed damage, range, properties, categories, and mastery, while resolved proficiencies and effective abilities remain server-owned character facts.

Automatically creating an attack for every owned weapon would confuse possession with active use. Inferring Strength or Dexterity only from a display name would also bypass Finesse and ranged-weapon rules.

## Decision

A stored weapon attack contains a canonical weapon reference, an explicit `str` or `dex` ability id, and an explicit two-handed flag. The referenced weapon must be positively owned and equipped. Canonical evaluation verifies its name and normalized melee/ranged kind, permits the alternate ability only for Finesse weapons, and permits two-handed damage only when the provider supplies that profile.

The server derives attack modifier, damage modifier and dice/type, proficiency state, range, and any active mastery. Training reuses the same stable equipment-category and explicit weapon-proficiency mapping as Weapon Mastery. The browser exposes only eligible ability choices and persists configuration, but never calculates authoritative attack values.

## Consequences

- Inventory ownership, wielded state, and attack configuration remain distinct facts.
- Invalidated attacks stay stored and produce structured violations until explicitly corrected or removed.
- Effective abilities from active feat effects feed attacks without rewriting base ability scores.
- Ammunition, thrown ranges, dual wielding, loading, attack counts, and combat action sequencing remain outside this character-summary increment.
