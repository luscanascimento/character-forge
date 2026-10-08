# Phase 5 feature-rule inventory

**Reviewed:** 2026-10-04  
**Rules identity:** `2024` / `SRD-5.2.1`

## Sources and purpose

This inventory compares the licensed [SRD 5.2.1 PDF](https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf) with the 2024 data contract in the [5e-bits monorepo](https://github.com/5e-bits/5e-srd-api/tree/main/packages/5e-database/src/2024). It determines which feature-choice facts can remain provider-owned and which require a small reviewed Character Forge rules manifest.

The former standalone `5e-database` repository was archived after its data moved into the monorepo. The live API remains useful as a content provider, but its feature descriptions are still narrative-only and its normal responses still carry no immutable content snapshot id.

## Decision matrix

| Rule family                                         | Structured provider facts                                                                                                   | Missing machine-readable facts                                                                                                   | Character Forge boundary                                                                                                                         |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Fighting Style                                      | Feature occurrences by class/level; feat `type`; feat minimum-level and named-feature prerequisites                         | The one-choice requirement; Paladin's Blessed Warrior and Ranger's Druidic Warrior alternatives and their nested cantrip choices | Local manifest identifies the requirement and alternatives; feat/cantrip options still come from normalized provider catalogs                    |
| Expertise                                           | Feature occurrences at Bard 2/9, Ranger 9, and Rogue 1/6; existing selected skill proficiencies                             | Counts, eligibility limited to proficient skills without Expertise, and Ranger 2's Expertise nested inside Deft Explorer         | Local manifest supplies requirement/count metadata; canonical validation derives eligible options from the character's trusted proficiency state |
| Weapon Mastery                                      | Feature occurrences; equipment weapon/mastery references; full level-table counts for Barbarian and Fighter                 | Counts for Paladin, Ranger, and Rogue; weapon-proficiency eligibility; no character equipment/proficiency selection model yet    | Record the gap now; interactive selection remains in Phase 7 with equipment rather than inventing a partial Phase 5 flow                         |
| Ability Score Improvement                           | Repeated feature occurrences; feat types; minimum-level and ability-score prerequisite options for the current feat catalog | The feature-to-qualified-feat requirement and the complete persisted effects of ability increases or other feats                 | Normalize feat prerequisites first; interactive selection and effects remain in Phase 7                                                          |
| Spell-granting alternatives and class spell choices | Spell lists, levels, classes, and class spellcasting tables                                                                 | Prepared/known distinctions and nested cantrip/spell replacement rules                                                           | Remain in Phase 6; Phase 5 may show them as locked with that reason                                                                              |

## Adopted data policy

Character Forge will own a small, typed, versioned feature-rule manifest for semantics that are present in SRD 5.2.1 but absent from the provider's structured fields.

The manifest will:

- contain only normalized rule facts such as stable feature id, requirement kind, count, option source, availability, and SRD section/page provenance;
- never copy narrative descriptions or silently parse provider prose;
- use `SRD-5.2.1-CF-1` as its first independent data version;
- combine with provider-owned canonical ids, names, lists, and prerequisite structures rather than duplicating them;
- reject unknown or mismatched references instead of falling back to display names;
- require focused tests for every added entry and a new manifest version whenever an existing fact changes.

`ATTRIBUTIONS.md` already carries the exact CC BY 4.0 attribution required by SRD 5.2.1. The manifest must not include material from D&D Beyond Basic Rules or non-SRD books.

## Implementation order

1. Normalize feat types and prerequisites that the provider already structures.
2. Add the versioned manifest and canonical Fighting Style requirements, with spell-granting alternatives visibly locked until Phase 6 can validate their cantrips.
3. Add Expertise requirements using the character's resolved skill proficiencies.
4. Close the supported Phase 5 subset explicitly; carry Weapon Mastery and Ability Score Improvement selections into Phase 7, where their dependent equipment and feat-effect models belong.

This order gives the builder honest level-dependent choices without pretending that all prose-only mechanics are already modeled.

Steps 1 and 2 established manifest `SRD-5.2.1-CF-1` with the Fighter, Champion, Paladin, and Ranger Fighting Style requirements. ADR-015 advances it to `SRD-5.2.1-CF-2`: the hybrid endpoint still joins feat branches to provider-owned feat ids/names and now joins Blessed Warrior/Druidic Warrior to provider-filtered Cleric/Druid cantrips. Drafts persist and canonically validate both branch shapes; the spell-granting alternatives remain Phase 6-owned rather than retroactively expanding Phase 5.

Step 3 is implemented. The manifest records Bard Expertise at levels 2/9, Ranger Expertise through Deft Explorer at level 2 and the named feature at level 9, and Rogue Expertise at levels 1/6. Normalized proficiency facts retain structured skill identity; canonical evaluation derives eligible options from resolved skill grants and rejects a skill that already has Expertise. The Proficiencies step persists canonical choices, retains now-invalid selections after level changes, and presents valid Expertise in review.

Step 4 is complete. Phase 5 closes at the supported boundary above: Weapon Mastery remains assigned to the Phase 7 weapon/equipment and proficiency model, while Ability Score Improvement remains assigned to complete feat/effect persistence in that phase. Neither is partially represented as an interactive Phase 5 choice.
