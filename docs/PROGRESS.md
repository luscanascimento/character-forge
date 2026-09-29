# Character Forge progress

## Current phase

**Phase 3 — Character Domain: in progress.**

Phases 0–2 are implemented. Two Phase 3 domain slices are complete; work must continue with proficiency choices without starting the builder or persistence.

## Last completed work

- Defined a versioned, draft-capable `Character` aggregate with UUID/name identity, six ability scores, species/background references, and a class-progression collection whose validator currently requires exactly one class.
- Centralized the supported `2024` / `SRD-5.2.1` identity and reused it in application metadata and character validation.
- Added pure, bounded ability-modifier and proficiency-bonus rules, including correct floor division for negative modifiers and level 1–20 proficiency progression.
- Added structured `ValidationResult` / `RuleViolation` output for incomplete choices, invalid references, ability bounds, class count/level, and rules-version mismatches.
- Added `POST /api/characters/validate`, which stores nothing and returns derived values only for a wholly valid document.
- Recorded the draft-versus-validated-state boundary in ADR-004 and covered the domain and endpoint with focused tests.
- Added provider-neutral character-creation facts to normalized catalog details so rule code consumes a numeric hit die and structured proficiency references instead of presentation strings.
- Added trusted content resolution for selected class, species, and background, including structured violations when a saved reference no longer exists.
- Added unarmored AC and level-1 HP calculations plus fixed proficiency grants that deduplicate by id while retaining every source.
- Live-smoke-tested the full validation flow with Wizard, Elf, and Acolyte against the 2024 provider.

## Work in progress

Phase 3 remains open. Ability modifiers, proficiency bonus, unarmored AC, level-1 HP, and fixed proficiency grants are implemented. Variable proficiency choices are not.

## Next step

Continue Phase 3 with the next test-first domain slice:

1. Normalize proficiency-choice requirements from class/background details and referenced species traits without leaking provider option DTOs.
2. Add selected proficiency choices to the draft aggregate and validate required counts, allowed options, duplicates, and stale choice ids.
3. Decide and test the 2024 replacement behavior when two sources grant the same skill or tool proficiency.
4. Extend derived proficiency output only after every required choice is valid.
5. Do not begin the builder, IndexedDB, later-level class progression, equipment effects, or spellcasting.

## Pending decisions

- Whether the frontend may mirror any presentation-only calculation must be decided only after the canonical server rule exists and can be contract-tested.
- Species trait resolution and caching must be designed before nested proficiency choices enter domain evaluation.
- Duplicate proficiency replacement behavior must be confirmed against SRD 5.2.1 before choice validation is finalized.
- A project source-code license remains to be selected before public portfolio release.
- Checked-in provider snapshots are not currently justified; small representative inline fixtures cover consumed schema variants. Revisit only if upstream contract testing becomes hard to understand.

## Known issues and limitations

- Proficiency choices, armored/equipment AC, HP after level 1, builder, IndexedDB, import/export, and print functionality are not implemented yet.
- Ritual and concentration are shown on spell detail but are not list filters because the upstream list response omits those fields.
- Some categories do not include narrative descriptions in the upstream 2024 detail response; the UI states that honestly instead of inventing or copying content.
- Cache is process-local and has no stale-on-error persistence after an API restart.
- The external API does not expose an immutable catalog snapshot version in normal responses.
- The hero has been converted to a 140 KB WebP; responsive variants can be considered during the Phase 9 performance audit if measurements justify them.

## Test status

- Frontend lint: passing (`oxlint`, no warnings)
- Frontend unit tests: 6 passing across 3 files (`vitest run`)
- Frontend production build/typecheck: passing (`tsc -b && vite build`)
- Formatting: passing (`prettier --check` and `dotnet format --verify-no-changes`)
- Backend build: passing with 0 warnings and 0 errors
- Backend unit/integration tests: 60 passing
- Live provider smoke checks: classes, species, backgrounds, feats, filtered spells, equipment list/detail, and character validation responses passing
- Dependency audit: npm and NuGet report no known vulnerabilities
- Existing Phase 1 visual smoke checks: desktop 1440×1000 and mobile 375×812 passed; Phase 2 has responsive CSS and behavior coverage but awaits screenshot-based visual regression tooling in Phase 10

## Last checkpoint

2026-09-29 (America/Sao_Paulo)
