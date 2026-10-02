# Character Forge progress

## Current phase

**Phase 4 — Character Builder MVP: in progress.**

Phases 0–3 are implemented. The Phase 4 storage boundary, local character list, and first three builder steps are complete; work must continue through the remaining progressive steps without expanding later rules early.

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
- Replaced the character-specific forge placeholder with a responsive builder shell that loads the requested local draft and distinguishes loading, missing, malformed, and unavailable-storage states.
- Established an accessible six-step creation sequence while keeping unfinished steps visibly locked instead of pretending they are available.
- Implemented the first character-name step with explicit local saving, whitespace normalization, update timestamps, failure feedback, and roster-cache synchronization without introducing auto-save early.
- Added focused coverage for draft loading, progressive navigation, missing/error recovery, required-name behavior, and explicit persistence.
- Added a resumable Abilities step that unlocks after a saved name and keeps completed earlier steps editable.
- Added six accessible integer inputs with complete 1–30 bounds feedback, modifier previews, and explicit all-at-once persistence.
- Kept modifier previews presentation-only and documented that canonical validity and derived values remain owned by server evaluation.
- Added focused coverage for resume/navigation behavior, incomplete and out-of-range values, negative floor-division previews, formatted modifiers, and saved ability sets.
- Added a resumable Origins step that unlocks after abilities and fetches species/background choices through the normalized catalog client.
- Requested the complete bounded origin lists, exposed honest loading/provider-error states with retry, and retained the local draft when the catalog is unavailable.
- Persisted only canonical id/name references selected from trusted catalog results, with both choices required and existing choices restored on reopen.
- Added focused coverage for origin resume, catalog query bounds, required choices, stable reference persistence, and provider recovery.

## Work in progress

Phase 4 remains open. Persistence, My Characters, the builder shell, name, abilities, and origins are implemented; class/proficiency selection, auto-save, duplication, and deletion UI are not.

## Next step

Continue Phase 4 with a narrow class-selection slice:

1. Unlock Class after saved origins and resume existing drafts at the first unfinished supported step.
2. Load class choices through the normalized catalog boundary with honest loading and provider-error states.
3. Persist exactly one stable class reference at level 1 without copying class rule facts into the draft.
4. Cover navigation, selection, provider failures, and saved progression with focused frontend tests.
5. Do not add proficiency selection, auto-save, duplication/deletion actions, later-level progression, equipment effects, or spellcasting in the same slice.

## Pending decisions

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
- Frontend unit tests: 45 passing across 10 files (`vitest run`)
- Frontend production build/typecheck: passing (`tsc -b && vite build`)
- Formatting: passing (`prettier --check` and `dotnet format --verify-no-changes`)
- Backend build: passing with 0 warnings and 0 errors
- Backend unit/integration tests: 70 passing
- Live provider smoke checks: classes, species/trait choices, backgrounds, feats, filtered spells, equipment list/detail, and complete character validation responses passing
- Dependency audit: npm and NuGet report no known vulnerabilities
- Existing Phase 1 visual smoke checks: desktop 1440×1000 and mobile 375×812 passed; Phase 2 has responsive CSS and behavior coverage but awaits screenshot-based visual regression tooling in Phase 10

## Last checkpoint

2026-10-02 (America/Sao_Paulo)
