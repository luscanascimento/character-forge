# Character Forge roadmap

## Vision

Build a delightful, mobile-first fifth-edition character forge whose rules are trustworthy, whose local-first privacy is obvious, and whose architecture remains small enough to understand. The initial legal content boundary is the 2024 rules in SRD 5.2.1.

Each phase depends on the completed phases before it unless stated otherwise. A feature is complete only when its relevant build, lint, tests, empty/loading/error states, mobile behavior, basic accessibility, and documentation are complete.

## Phase 0 — Discovery & Architecture (complete)

**Objectives:** validate the live API 2024 surface and SRD license; establish boundaries for content, rules, local storage, and ruleset versioning; document the plan.

**Completion criteria:** API research checkpoint, required attribution, architecture overview, progress log, and initial ADRs are reviewed and committed.

**Dependencies:** none.

## Phase 1 — Foundation (complete)

**Objectives:** create the React/Vite/TypeScript and ASP.NET Core/.NET 10 applications, quality tooling, routes, error handling, OpenAPI, health endpoint, design tokens, homepage, and minimum web-to-API integration.

**Completion criteria:** responsive homepage and placeholder routes work from 320 px upward; `/api/meta`, `/health`, and development OpenAPI respond; frontend and backend builds/tests pass; no Phase 2 catalog feature is started.

**Dependencies:** Phase 0.

## Phase 2 — SRD Catalog (complete)

**Objectives:** implement the dedicated D&D API client, external DTO mapping, memory cache, predictable provider errors, and compendium browse/detail experiences for the explicitly supported SRD categories.

**Completion criteria:** classes, species, backgrounds, feats, spells, and equipment flow through Character Forge contracts; search/filter behavior and unavailable-provider states are tested; source/version metadata accompanies normalized data.

**Dependencies:** Phase 1 and the endpoint inventory in `SRD-API-RESEARCH.md`.

## Phase 3 — Character Domain (complete)

**Objectives:** model a versioned character, ability scores, one initial class, species, background, proficiencies, derived statistics, and small cohesive rules.

**Completion criteria:** domain rules do not depend on UI or external DTOs; structured violations explain invalid combinations; progression, modifiers, AC, HP, and proficiency rules have focused unit tests.

**Dependencies:** normalized catalog contracts from Phase 2.

## Phase 4 — Character Builder MVP (next)

**Objectives:** build the progressive builder, IndexedDB persistence, My Characters, edits, duplication/deletion, and auto-save.

**Completion criteria:** a valid baseline character can be created, reopened, and edited without an account; local schema version 1 and a migration seam exist; invalid local data fails safely.

**Dependencies:** Phase 3.

## Phase 5 — Class Progression

**Objectives:** levels, class features, subclass availability, HP progression, proficiency bonus, and level-dependent choices.

**Completion criteria:** locked choices explain why; changing level never silently deletes now-invalid choices; rule tests cover the supported 1–20 progression.

**Dependencies:** Phases 3–4.

## Phase 6 — Spellcasting

**Objectives:** spell progression, cantrips, known/prepared distinctions, slots, class lists, prerequisites, save DC, and attack modifier.

**Completion criteria:** spell level is modeled independently from character/class level; availability emerges from progression rules; spell selection and invalidation paths are tested.

**Dependencies:** Phase 5 plus spell data from Phase 2.

## Phase 7 — Feats & Equipment

**Objectives:** feat prerequisites, armor, weapons, equipment choices, AC, attacks, and related modifiers.

**Completion criteria:** unmet prerequisites are visible and explained; equipment-derived calculations are rule-owned and tested.

**Dependencies:** Phases 3, 5, and normalized catalog data.

## Phase 8 — Character Sheet

**Objectives:** review, original sheet layout, A4 print CSS, validated JSON export/import.

**Completion criteria:** color and monochrome print previews are legible with predictable page breaks; import enforces schema and size limits; malformed files cannot break the app.

**Dependencies:** Phases 4–7.

## Phase 9 — Polish

**Objectives:** deliberate motion, original/licensed fantasy artwork, accessibility audit, performance audit, responsive refinements, and complete error/empty states.

**Completion criteria:** WCAG AA issues are addressed where reasonably applicable; reduced motion works; main flows are audited at 320 px, common mobile/tablet, laptop, and large desktop sizes.

**Dependencies:** all product phases.

## Phase 10 — Portfolio Quality

**Objectives:** high-value unit/integration/E2E coverage, CI, clean Dockerfiles where useful, security/dependency review, diagrams, screenshots, and deployment documentation.

**Completion criteria:** CI runs frontend lint/typecheck/test/build and backend restore/build/test; a small Playwright suite covers the primary journey; setup and limitations are reproducible by another developer.

**Dependencies:** stable primary product flow.

## Future, deliberately out of scope

- Multiclassing
- Homebrew providers and editors
- Additional legally licensed providers
- 2014 ruleset
- Additional sheet layouts
- Optional PWA/offline catalog mode

These require new ADRs only when scheduled; no speculative implementations should precede them.
