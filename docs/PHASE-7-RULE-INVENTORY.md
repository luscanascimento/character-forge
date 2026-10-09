# Phase 7 feat and equipment rule inventory

**Reviewed:** 2026-10-09  
**Rules identity:** `2024` / `SRD-5.2.1`

## Sources and purpose

This inventory compares the licensed [SRD 5.2.1 PDF](https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf) with the live [D&D 5e SRD API 2024](https://www.dnd5eapi.co/api/2024) contract and the provider's [2024 database source](https://github.com/5e-bits/5e-srd-api/tree/main/packages/5e-database/src/2024). It defines the trusted boundary for Phase 7 before character equipment, feat effects, or Weapon Mastery selections are persisted.

The live observations below are schema observations, not copied narrative rules. Canonical semantics absent from the provider must be represented by a small, reviewed Character Forge manifest with SRD provenance, following ADR-010.

## Provider observations

The live 2024 catalog currently exposes 182 equipment resources:

- 38 weapons, all with a weapon category and mastery reference; 37 also expose range data, while Morningstar currently omits `range`;
- 13 armor resources, including one Shield; armor exposes base AC, Dexterity contribution, optional Dexterity cap, Strength minimum, and Stealth disadvantage;
- weapon damage dice/type, optional two-handed damage, range, properties, and mastery are structured independently;
- equipment can carry several category references, which are the stable facts needed for proficiency and option eligibility.

Every one of the twelve class resources exposes one `starting_equipment_options` choice, and each of the four background resources exposes one `equipment_options` choice. The observed option tree uses:

- `multiple` packages;
- `counted_reference` entries to equipment or equipment categories;
- `money` entries;
- nested `choice` entries, including category-backed Artisan's Tool, Musical Instrument, and Gaming Set choices.

Category references inside a package are not concrete owned items. They must remain a required nested selection and be resolved against the canonical equipment-category endpoint. A money-only alternative is a complete package and must not be converted into invented equipment.

The live feat catalog currently contains 17 feats across `origin`, `general`, `fighting-style`, and `epic-boon` types. It structures minimum level, named-feature prerequisites, repeatability, and one-of ability-score thresholds. It does not structure feat effects. In particular, Ability Score Improvement describes its score changes only in narrative text, and other feats can include ability increases plus effects that need separate typed semantics.

Class progression exposes the following relevant feature occurrences:

| Rule family               | Structured provider facts                                                                                                                            | Missing machine-readable facts                                                                                          |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Ability Score Improvement | Occurrences at levels 4/8/12/16 for most classes, extra Fighter occurrences at 6/14, and an extra Rogue occurrence at 10; canonical feat metadata    | The link from each occurrence to one feat selection and every persisted feat effect                                     |
| Weapon Mastery            | Level-1 feature references for Barbarian, Fighter, Paladin, Ranger, and Rogue; weapon-to-mastery references; Barbarian and Fighter capacity counters | Paladin, Ranger, and Rogue capacities; selected-weapon eligibility from weapon proficiency; later replacement lifecycle |
| Starting equipment        | Complete class/background choice trees, quantities, money, and category-backed choices                                                               | Character ownership, equipped state, combination policy, and effects                                                    |
| Armor and Shield          | Base AC, Dexterity behavior, Strength minimum, Stealth disadvantage, categories                                                                      | Equipped-item constraint and whether the character is trained for the selected armor/shield                             |
| Weapons                   | Damage, damage type, range, properties, categories, and mastery                                                                                      | Wielded configuration, attack ability choice, proficiency application, and mastery eligibility                          |

## Adopted implementation boundary

Phase 7 will proceed in dependency order:

1. Normalize equipment facts and starting-equipment choice trees without leaking provider DTOs or narrative parsing.
2. Add canonical feat eligibility from provider-owned feat type/prerequisite facts; do not claim a feat is fully supported until its effects have a typed implementation.
3. Persist canonical equipment ownership/equipped state and derive armor/shield AC from trusted equipment facts and proficiencies.
4. Add typed feat effects, beginning with Ability Score Improvement, before exposing its progression choices.
5. Add Weapon Mastery capacities and weapon eligibility only after owned weapons and structured weapon proficiencies are available.
6. Add canonical weapon attacks after wielded configuration, ability selection, and proficiency are explicit.

The initial equipment model will preserve non-destructive invalidation: catalog changes, class changes, or lost proficiencies retain saved references but produce structured violations until the user explicitly replaces or removes them. Initial creation may use either the class/background packages or manually chosen owned equipment; it must never infer one route from the other.

## Fail-closed requirements

- Unknown option types, invalid counts, empty packages, unresolved category choices, malformed armor facts, and malformed weapon facts are provider failures rather than partial normalized documents.
- A weapon may omit range only when the provider omits it; range is not invented from weapon type.
- Equipment categories and proficiencies are compared by stable ids, never display-name substrings.
- Feat prerequisites are evaluated against canonical class level, abilities, and active named features.
- Narrative feat descriptions are presentation content only and cannot change character state.
- Any locally owned feat, Weapon Mastery, or equipment semantic records its independent manifest version and SRD section/page provenance.
