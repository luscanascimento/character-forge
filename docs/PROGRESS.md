# Character Forge progress

## Current phase

**Phase 2 — SRD Catalog: complete.**

Phases 0–2 are implemented. Work must resume at **Phase 3 — Character Domain** without redoing catalog or foundation work.

## Last completed work

- Revalidated the official 2024 documentation, live endpoints, upstream OpenAPI, and representative payloads for every consumed category.
- Added a typed `HttpClientFactory` SRD adapter with explicit external DTOs, eight-second configurable timeout, cancellation, malformed-response handling, and normalized mapping.
- Added six-hour configurable `IMemoryCache` entries for lists/details, provider observation timestamps, and explicit `2024` / `SRD-5.2.1` metadata on public contracts.
- Added safe catalog endpoints for classes, species, backgrounds, feats, spells, and equipment, including search, sorting, pagination, input limits, `404`, validation Problem Details, and predictable `503` provider failures.
- Added spell filters for level, school, and class. Combined school/class queries intersect official upstream result sets without downloading every spell detail.
- Added a per-IP catalog limit of 120 requests per minute and suppressed successful `HttpClient` request noise while retaining structured failure logs.
- Built the responsive dark-fantasy compendium, category navigation, URL-backed search/filters, loading/empty/error states, reduced-motion transitions, and detail views that never render provider HTML.
- Added backend adapter/endpoint tests and frontend compendium behavior tests. Live smoke tests pass for representative content in all six categories.
- Documented why ritual/concentration spell filters remain deferred: the upstream list contract exposes neither field, and eager-fetching 339 details would be wasteful.

## Work in progress

None. The working checkpoint is the end of Phase 2.

## Next step

Start Phase 3 with a narrow, test-first domain slice:

1. Re-read `README.md`, this file, `ROADMAP.md`, `ARCHITECTURE.md`, ADR-001, and the normalized catalog contracts.
2. Define the versioned `Character` aggregate boundary with `ruleset: "2024"`, `rulesVersion: "SRD-5.2.1"`, identity, six ability scores, species/background references, and a class-progression collection whose first implementation supports exactly one class.
3. Implement focused ability-modifier and proficiency-bonus calculations plus structured `ValidationResult` / `RuleViolation` types.
4. Add unit tests for ability score bounds/modifiers, proficiency progression, missing choices, and rules-version mismatches.
5. Expose only the minimum validation/calculation API needed to prove the domain boundary; do not begin the builder, IndexedDB, class progression features, or spellcasting.

## Pending decisions

- The exact versioned character document shape and the boundary between persisted draft data and validated domain state must be settled in Phase 3.
- Whether the frontend may mirror any presentation-only calculation must be decided only after the canonical server rule exists and can be contract-tested.
- A project source-code license remains to be selected before public portfolio release.
- Checked-in provider snapshots are not currently justified; small representative inline fixtures cover consumed schema variants. Revisit only if upstream contract testing becomes hard to understand.

## Known issues and limitations

- The Rule Engine, builder, IndexedDB, import/export, and print functionality are not implemented by design.
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
- Backend adapter/integration tests: 15 passing
- Live provider smoke checks: classes, species, backgrounds, feats, filtered spells, and equipment list/detail responses passing
- Dependency audit: npm and NuGet report no known vulnerabilities
- Existing Phase 1 visual smoke checks: desktop 1440×1000 and mobile 375×812 passed; Phase 2 has responsive CSS and behavior coverage but awaits screenshot-based visual regression tooling in Phase 10

## Last checkpoint

2026-09-28 (America/Sao_Paulo)
