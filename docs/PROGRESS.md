# Character Forge progress

## Current phase

**Phase 4 — Character Builder MVP: in progress.**

Phases 0–3 are implemented. The Phase 4 storage boundary and local character-list experience are complete; work must continue with the progressive builder without expanding later rules early.

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
- Normalized class/background proficiency choices and species choices referenced through traits into stable ids, counts, prompts, and canonical option lists.
- Flattened the provider's nested Monk tool families without leaking its choice tree into catalog, draft, or domain contracts.
- Added proficiency selections to the draft aggregate and structured violations for missing, repeated, stale, disallowed, incorrectly counted, or duplicate selections.
- Canonicalized selected proficiency names from trusted content and documented why SRD 5.2.1 duplicates are rejected rather than replaced by a rule carried over from 2014.
- Extended the frontend catalog schema so normalized creation facts survive the API boundary for Phase 4.
- Live-smoke-tested the complete Wizard/Elf/Acolyte choice flow and recorded the normalization decision in ADR-005.
- Defined the schema-version-1 local envelope with UUID, fixed rules identity, timestamps, and structurally validated draft data.
- Added Zod schemas for stored drafts, canonical validation requests, and character evaluation responses.
- Added a native IndexedDB module with list/get/save/delete operations, update-time ordering, injected `IDBFactory`, and an explicit migration seam.
- Added typed failures for unavailable storage, malformed records, and unsupported schema versions without silently discarding or guessing data.
- Added a tested API adapter that strips persistence metadata before canonical server validation.
- Added `fake-indexeddb` as a test-only implementation of the native browser API; production has no storage wrapper dependency.
- Replaced the My Characters placeholder with a responsive, IndexedDB-backed local roster ordered by most recently updated.
- Added explicit loading, empty, malformed-record, unavailable-storage, and create-failure states with retry behavior that never silently deletes local data.
- Added a minimal versioned draft factory and create action that persists a UUID/timestamped blank character before opening its future builder route.
- Added focused UI coverage for roster ordering, builder navigation, draft creation, local-data messaging, and storage recovery.

## Work in progress

Phase 4 remains open. Persistence and My Characters are implemented; the progressive builder, auto-save, duplication, and deletion UI are not.

## Next step

Continue Phase 4 with a narrow builder-foundation slice:

1. Replace the `/forge/:characterId` placeholder with a builder shell that loads the requested local draft.
2. Add missing-character, malformed/unavailable-storage, and loading states without mutating the stored draft.
3. Establish accessible progressive navigation and implement only the first basic-details step.
4. Keep server validation canonical and cover draft loading/navigation with focused frontend tests.
5. Do not add auto-save, duplication/deletion actions, later-level progression, equipment effects, or spellcasting in the same slice.

## Pending decisions

- Whether the frontend should mirror any presentation-only calculation remains deferred; the canonical server result must stay authoritative.
- The auto-save debounce and conflict behavior across multiple open tabs remain to be defined when editing begins.
- A project source-code license remains to be selected before public portfolio release.
- Checked-in provider snapshots are not currently justified; small representative inline fixtures cover consumed schema variants. Revisit only if upstream contract testing becomes hard to understand.

## Known issues and limitations

- Armored/equipment AC, HP after level 1, builder UI, auto-save, import/export, and print functionality are not implemented yet.
- Ritual and concentration are shown on spell detail but are not list filters because the upstream list response omits those fields.
- Some categories do not include narrative descriptions in the upstream 2024 detail response; the UI states that honestly instead of inventing or copying content.
- Cache is process-local and has no stale-on-error persistence after an API restart.
- The external API does not expose an immutable catalog snapshot version in normal responses.
- The hero has been converted to a 140 KB WebP; responsive variants can be considered during the Phase 9 performance audit if measurements justify them.

## Test status

- Frontend lint: passing (`oxlint`, no warnings)
- Frontend unit tests: 21 passing across 8 files (`vitest run`)
- Frontend production build/typecheck: passing (`tsc -b && vite build`)
- Formatting: passing (`prettier --check` and `dotnet format --verify-no-changes`)
- Backend build: passing with 0 warnings and 0 errors
- Backend unit/integration tests: 70 passing
- Live provider smoke checks: classes, species/trait choices, backgrounds, feats, filtered spells, equipment list/detail, and complete character validation responses passing
- Dependency audit: npm and NuGet report no known vulnerabilities
- Existing Phase 1 visual smoke checks: desktop 1440×1000 and mobile 375×812 passed; Phase 2 has responsive CSS and behavior coverage but awaits screenshot-based visual regression tooling in Phase 10

## Last checkpoint

2026-10-01 (America/Sao_Paulo)
