# ADR-020: Resolve Weapon Mastery from class capacity, ownership, and training

- Status: accepted
- Date: 2026-10-13

## Context

Weapon Mastery spans three trusted sources. Class progressions identify the granting feature; the provider exposes complete per-level capacities for Barbarian and Fighter but omits the fixed capacities for Paladin, Ranger, and Rogue; equipment detail identifies each weapon and its mastery property. A valid character choice additionally depends on owned equipment and resolved weapon proficiency.

The feature descriptions contain the missing fixed capacities only as prose. Treating every catalog weapon as eligible would also allow mastery of weapons the character neither owns nor knows how to use.

## Decision

Character Forge uses versioned manifest `SRD-5.2.1-WM-1` for the five supported class progressions and their exact level 1–20 capacities. Barbarian and Fighter entries must agree with every provider-owned capacity row. Paladin, Ranger, and Rogue use the manifest's fixed capacity of two because the provider omits that structured counter. Every entry verifies the exact level-1 feature occurrence.

A stored mastery choice contains only a canonical weapon reference. Canonical evaluation requires the exact active capacity, distinct selections, positive ownership in inventory, a normalized weapon/mastery record, a canonical name, and proficiency through either a normalized equipment-category id or an explicit stable proficiency-to-weapon id mapping. The latter covers provider pairs such as `rapiers` → `rapier` without singularizing names or ids. Derived output pairs each valid weapon with its provider-owned mastery property.

The Equipment builder exposes only owned, trained weapons as new choices. Selections invalidated by a class, inventory, proficiency, or catalog change remain visible until explicit removal.

## Consequences

- Capacity semantics missing from provider data remain narrow, versioned, and source-attributed.
- The browser never infers eligibility from weapon names or narrative descriptions.
- Inventory ownership remains the shared prerequisite for mastery and future weapon attacks.
- Long Rest replacement transitions and attack calculations remain separate future increments.
