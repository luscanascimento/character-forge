# SRD 5.2.1 and API 2024 research

Checkpoint date: **2026-09-28**

Phase 2 implementation verification: **2026-09-28**

Phase 5 progression verification: **2026-10-04**

## Legal source

Wizards of the Coast publishes [SRD 5.2.1](https://www.dndbeyond.com/srd) under CC BY 4.0. The PDF's required attribution statement is reproduced verbatim in `ATTRIBUTIONS.md` and in the application's attributions page.

Only the SRD is licensed for reuse. D&D Beyond Basic Rules and non-SRD books are not interchangeable with SRD 5.2.1 and are outside this project's content scope.

## API source

The official community API sources used for discovery were:

- live version root: `https://www.dnd5eapi.co/api/2024`
- [API documentation](https://docs.dnd5eapi.co/)
- [5e-srd-api source and OpenAPI definitions](https://github.com/5e-bits/5e-srd-api)
- [5e-database source](https://github.com/5e-bits/5e-database)

The live root returned HTTP 200 and advertised the following resource collections. Counts are observations, not contracts, and can change upstream.

| Collection                | Observed count | Planned Character Forge use        |
| ------------------------- | -------------: | ---------------------------------- |
| ability-scores            |              6 | Domain/rules                       |
| alignments                |             10 | Optional narrative data            |
| backgrounds               |              4 | Catalog/builder                    |
| classes                   |             12 | Catalog/builder                    |
| conditions                |             15 | Compendium                         |
| damage-types              |             13 | Rules/reference                    |
| equipment                 |            182 | Catalog/builder                    |
| equipment-categories      |             30 | Catalog filters                    |
| feats                     |             17 | Catalog/builder                    |
| features                  |            232 | Class progression                  |
| languages                 |             19 | Builder choices                    |
| magic-items               |            262 | Out of MVP builder scope           |
| magic-schools             |              8 | Spell filters                      |
| monsters                  |            341 | Out of MVP character-builder scope |
| poisons                   |             14 | Out of MVP scope                   |
| proficiencies             |             74 | Rules/builder                      |
| skills                    |             18 | Rules/builder                      |
| species                   |              9 | Catalog/builder                    |
| spells                    |            339 | Catalog/spellcasting               |
| subclasses                |             12 | Class progression                  |
| subspecies                |             24 | Species choices where applicable   |
| traits                    |             67 | Species features                   |
| weapon-mastery-properties |              8 | Equipment/attacks                  |
| weapon-properties         |             10 | Equipment/attacks                  |

The API also currently exposes nested class-level and spell-list routes represented in the upstream OpenAPI/source even though they are not separate keys in the version root.

## Phase 2 consumed surface

Character Forge now consumes list and detail routes for `classes`, `species`, `backgrounds`, `feats`, `spells`, and `equipment`. The adapter was smoke-tested against the live service for representative entries in every category. It normalizes external payloads into summary/detail contracts and includes provider, ruleset, rules version, and observation time.

The spell list route supports upstream level and school filters. Class filtering uses the nested `/classes/{class}/spells` route; combined school/class filtering intersects the two provider result sets by stable SRD index. Name search, sorting, and pagination happen over the cached normalized list.

The 2024 list contract does not expose ritual or concentration values and does not advertise those filters. Character Forge does not fetch all 339 spell details just to manufacture them. These filters remain deferred until a richer spell index is justified by Phase 6.

Equipment payloads are polymorphic. Live verification found `description` represented as either a string or an array depending on resource/provider revision. The external adapter accepts both shapes while keeping the public Character Forge contract consistently `string[]`.

## Availability conclusion

The live API supplies the principal structured categories needed by the planned compendium and builder: classes, subclasses, species, subspecies, four SRD backgrounds, feats, spells, equipment, proficiencies, skills, traits, features, languages, and supporting rule references. It also supplies content beyond this MVP, such as monsters and magic items.

This does **not** prove every paragraph or table in the SRD PDF has a structured API equivalent. The API version root has no general-rules collection for 2024, and the provider evolves incrementally. Therefore:

1. Phase 2 will consume only explicitly observed endpoints.
2. Each external DTO will be validated against the current 2024 schema before mapping.
3. Missing SRD content will be recorded, not invented or copied from non-SRD books.
4. Character Forge will expose its own stable contracts instead of forwarding upstream JSON.

## Phase 3 character-creation facts

Live verification on 2026-09-29 confirmed that class detail exposes numeric `hit_die`, direct `proficiencies`, and nested `proficiency_choices`; background detail exposes direct proficiencies; and species proficiency choices can be nested inside referenced trait details. For example, Elf references the Keen Senses trait, whose detail contains a one-of-three skill choice.

Character Forge now normalizes numeric hit dice, direct proficiency grants, and proficiency-choice requirements as typed character-creation facts. Domain evaluation consumes only those normalized facts; display descriptions are never parsed as rules.

The implemented inventory covers direct reference choices on all twelve classes, the Soldier background, and referenced trait choices for Elf and Human. The Monk's outer one-of-two tool-family choice is semantically a union of reference options, so the adapter flattens it while preserving the outer count of one. Provider URLs are used to canonicalize inconsistent proficiency ids, including skill references and tool ids.

SRD 5.2.1 states that the Proficiency Bonus does not stack, but the official text contains no equivalent of SRD 5.1's general replacement rule for duplicate proficiencies. Character Forge therefore rejects a selectable proficiency that duplicates another selected or fixed grant; it does not manufacture an unrestricted replacement option.

## Upstream documentation status

The current official documentation has a dedicated [2024 introduction](https://docs.dnd5eapi.co/2024/introduction) and identifies `https://www.dnd5eapi.co/api/2024` as its base URL. Some repository prose encountered during initial discovery was older than the live/versioned definitions. Character Forge therefore keeps adapter tests around the exact schemas it consumes and treats observed resource counts as informational rather than contractual.

## Phase 5 class progression surface

Live verification on 2026-10-03 found exactly twenty resources at `/classes/{class}/levels` for each of the twelve 2024 classes. Every class level carries `level`, `prof_bonus`, and feature references. Some also carry `spellcasting`, while eleven class tables expose differently shaped `class_specific` counters such as Rage uses, Focus Points, Sneak Attack, or Sorcery Points.

Each class detail currently references one SRD subclass. `/subclasses/{subclass}/levels` returns only the levels where that subclass gains features, so the tables are intentionally sparse and differ by subclass. All observed 2024 subclasses first become available at level 3, but Character Forge derives availability from the first returned subclass level instead of hard-coding that observation.

The initial Phase 5 contract consumes only hit die, the complete class-level sequence, proficiency bonus, feature references, and subclass feature levels. Spellcasting is reserved for Phase 6, and polymorphic class-specific counters will receive explicit models only when their rules are implemented. Missing class levels, mismatched references, invalid proficiency bonuses, and malformed subclass timelines fail as provider errors rather than producing a partial progression.

### Feature requirements and choices

Live verification on 2026-10-04 inspected all 232 resources returned by `/features`. The 2024 feature-detail surface currently has only two root shapes: 174 class features with `index`, `name`, `description`, `level`, and `class`, and 58 subclass features with the same fields plus `subclass`. None of the resources exposes a structured choice, option set, count, or prerequisite.

Representative rules that require user input exist only in prose:

- Fighter Fighting Style says to choose a Fighting Style feat, but supplies no feat references or qualification data.
- Fighter Weapon Mastery says to choose three weapon kinds, but supplies no weapon references and its varying count lives in the separate class-specific table.
- Bard Expertise says to choose skill proficiencies, but supplies no eligible proficiency references.
- Ability Score Improvement refers to a qualifying feat, but exposes no prerequisite expression.
- The class Subclass feature says to choose a subclass, while the separately structured subclass level timeline supplies the actual available subclass reference and level.

Character Forge will therefore treat class level, feature availability, subclass references, and subclass availability levels as trusted structured facts. It will not parse feature names or descriptions into selectable rules. Feature-choice persistence and validation remain deferred until a structured SRD source exists or Character Forge owns a separately reviewed rules dataset.
