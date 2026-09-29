# SRD 5.2.1 and API 2024 research

Checkpoint date: **2026-09-28**

Phase 2 implementation verification: **2026-09-28**

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

## Upstream documentation status

The current official documentation has a dedicated [2024 introduction](https://docs.dnd5eapi.co/2024/introduction) and identifies `https://www.dnd5eapi.co/api/2024` as its base URL. Some repository prose encountered during initial discovery was older than the live/versioned definitions. Character Forge therefore keeps adapter tests around the exact schemas it consumes and treats observed resource counts as informational rather than contractual.
