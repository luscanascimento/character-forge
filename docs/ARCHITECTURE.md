# Architecture

## Shape

Character Forge is a small modular monolith with two deployable applications:

```text
Browser
  React UI
  IndexedDB (versioned character drafts)
       │ Character Forge REST contracts
       ▼
ASP.NET Core API
  Feature endpoints ── Character rules
       │
       └── SRD content adapter ── D&D 5e SRD API 2024
```

There is no authentication, server database, message broker, microservice boundary, repository layer, or speculative licensed/homebrew implementation.

## Frontend

`apps/web` is a strict TypeScript React application built by Vite.

- React Router owns navigation and lazy route boundaries.
- TanStack Query owns server state, including loading and unavailable-API states.
- Zod validates data crossing untrusted boundaries. It validates `/api/meta`, catalog responses, and local character migrations; import validation arrives with Phase 8.
- React Hook Form will be introduced only when builder forms justify it.
- Motion provides a small number of meaningful transitions and respects `prefers-reduced-motion`.
- CSS design tokens establish the charcoal, parchment, bronze, ember, typography, spacing, radius, and duration vocabulary. Components use semantic classes rather than utility walls.
- Components display rule results; they must not independently determine rule legality.

Compendium routes are lazy-loaded and keep server state in TanStack Query. Search/filter state lives in the URL so views are linkable and browser navigation remains useful. External descriptions are rendered as text; no provider HTML enters the DOM.

## Backend

`apps/api` is an ASP.NET Core .NET 10 REST API organized by feature. The current structure is deliberately shallow:

```text
Features/
  Catalog/
  Characters/
  Meta/
  Progression/
  Spellcasting/
Infrastructure/
  Srd/
Program.cs
```

New catalog functionality should live in its feature area, with shared infrastructure extracted only after a real second consumer appears. The API currently provides:

- `GET /api/meta` for the active Character Forge rules contract
- `GET /api/catalog/{category}` for normalized, searched, filtered, and paginated summaries
- `GET /api/catalog/{category}/{id}` for normalized detail
- `GET /api/classes/{classId}/progression` for normalized 1–20 class, subclass, and structured spellcasting timelines
- `GET /health`
- `POST /api/characters/validate` for non-persisting draft validation and calculations
- `/openapi/v1.json` in Development
- centralized exception handling with safe Problem Details
- configured-origin CORS (deny-by-default when no origins are configured)
- baseline response security headers and production HTTPS/HSTS
- a per-IP fixed-window limit on catalog reads

The SRD adapter uses a typed `HttpClient` created by `HttpClientFactory`, an eight-second configurable timeout, request cancellation, explicit external DTOs, and category-specific mapping. Provider transport failures, timeouts, invalid JSON, and non-success responses become safe `503` Problem Details. Missing detail resources remain `404`.

`CatalogService` caches normalized upstream lists and details in `IMemoryCache` for six hours by default. `ClassProgressionService` applies the same configured duration to normalized level timelines. Search, sorting, and pagination operate over cached catalog lists; cache entries carry their observed `fetchedAt` instant. There is no stale-data store across process restarts yet.

## Domain

The Phase 3 domain is complete. Its central aggregate carries explicit rules identity:

```text
ruleset: "2024"
rulesVersion: "SRD-5.2.1"
classProgressions: [ ... ]
proficiencyChoices: [ ... ]
```

The aggregate is draft-capable: incomplete or invalid choices remain representable and are explained by a structured `ValidationResult`. Catalog selections are retained as references with ids and display names. `classProgressions` is a collection so the document shape does not make one class irreversible, while the current validator explicitly requires exactly one entry and implements no multiclass behavior. Its optional subclass reference is backward-compatible within local schema version 1; canonical evaluation resolves availability from the server-owned progression contract and never trusts a client-supplied level requirement.

Pure ability-modifier and proficiency-bonus calculators enforce their numeric bounds. `POST /api/characters/validate` is the canonical rule boundary: it does not persist data and emits derived values only when the complete document is valid for 2024 / SRD 5.2.1. See ADR-004 for the distinction between a persisted draft and trusted domain state.

Character evaluation resolves the selected class, species, and background through `CatalogService` before calculating. Normalized catalog detail carries typed character-creation facts—hit die, direct proficiency grants, and proficiency-choice requirements—so the domain never parses presentation strings or accepts client-supplied rule facts. The adapter resolves referenced species traits and flattens the provider's equivalent nested option families into stable choice ids, counts, and option lists.

The evaluator calculates unarmored AC and deterministic fixed HP through level 20, validates every required proficiency choice, canonicalizes selected references, rejects stale/disallowed/duplicate selections, merges unavoidable fixed duplicates, and retains every source that supplied a grant. SRD 5.2.1 says proficiency bonuses do not stack but does not carry forward the 2014 rule that allowed arbitrary replacement of duplicate proficiencies, so Character Forge does not invent such replacements.

Phase 5 progression reads use a provider-neutral contract: a complete 1–20 class timeline, canonical proficiency bonuses and feature references, plus sparse subclass timelines with an explicit availability level. Hit die remains typed for HP rules. Polymorphic class-specific counters stay excluded, and feature names are never parsed to invent choices.

ADR-011 adds a separate nested spellcasting model to that response from the same provider fetch. It identifies the start level and spellcasting ability, then records `classLevel` separately from each positive slot's `spellLevel`, alongside structured cantrip and prepared-spell capacities. Complete casting tables are required through level 20; noncasters return no spellcasting model. Narrative-only preparation cadence, Wizard spellbook membership, slot recovery, always-prepared grants, and Mystic Arcanum remain outside the contract until typed rules with SRD provenance exist.

Canonical character evaluation resolves that progression at the selected class level and returns the spellcasting ability, cantrip/prepared capacities, and positive slots as derived values. It resolves the provider's canonical ability id against server-validated character scores, then calculates Spell Save DC as `8 + ability modifier + proficiency bonus` and spell attack modifier as `ability modifier + proficiency bonus`. Unknown ability ids fail at the provider boundary. Noncasters return no derived spellcasting block. The client never supplies these availability facts, and the rule still does not interpret availability as permission to persist arbitrary spell selections.

ADR-012 defines manifest `SRD-5.2.1-SPELL-1` for semantics absent from the provider: class-list versus spellbook preparation, replacement trigger/count, standard versus Pact Magic pools, base recovery, uniform Pact slots, and separate Mystic Arcanum access. `ClassProgressionService` verifies each caster's provider ability and slot shape against this manifest before adding the public policy document. The policy has explicit SRD section/page provenance and fails as a provider-content error on disagreement; no narrative text is parsed at runtime.

The builder validates this contract at its API boundary and uses it for level, subclass, and per-level feature presentation. A subclass that becomes unavailable after a level decrease remains in the local draft and is shown as locked until the user explicitly raises the level, replaces it, or removes it. Feature references remain informational because the provider's feature descriptions do not expose structured option or prerequisite rules (ADR-009).

ADR-010 defines the rule-data boundary for level-dependent choices: provider-owned structured catalog facts are combined with a narrow, typed Character Forge manifest for missing feature-choice semantics. The manifest has its own version, provenance, and focused tests; it fails closed on provider-reference mismatch and never copies or parses narrative descriptions. `/api/classes/{classId}/feature-choices` exposes the verified combination without moving provider DTOs or manifest internals into the browser. Dependent spell, equipment, and feat-effect rules remain in their roadmap phases.

Normalized proficiency facts retain an explicit skill/non-skill identity. Expertise candidates are derived from the same canonically resolved grants used by validation, so tools, weapons, and saving throws never become eligible through display-name parsing. Class feature documents declare `proficientSkills` as a character-dependent option source rather than embedding options that cannot be known without a draft.

Feat details now preserve provider-owned type, minimum-level and named-feature prerequisites, repeatability, and alternative ability-score thresholds as a provider-neutral typed contract. The SRD adapter rejects malformed option shapes, duplicate abilities, impossible choice counts, and scores or levels outside canonical bounds. These facts can qualify manifest-owned choices without making frontend code depend on provider DTOs.

Manifest `SRD-5.2.1-CF-1` defines the four SRD Fighting Style requirements: Fighter level 1, Champion level 7, Paladin level 2, and Ranger level 2. Each entry records the owning class/subclass feature id, exact acquisition level, one-choice cardinality, typed option sources, and SRD section/page provenance. Fighting Style feats are supported through the normalized feat-type source; Blessed Warrior and Druidic Warrior are represented as two-cantrip branches locked by the Phase 6 spellcasting dependency. Resolution verifies every manifest feature against the normalized class/subclass timeline and every candidate feat against its structured type and named-feature prerequisite.

Phase 5 closes at this boundary. Weapon Mastery remains with the Phase 7 equipment/proficiency model, Ability Score Improvement remains with Phase 7 feat effects, and the locked spell-granting Fighting Style branches remain with Phase 6. This keeps deferred choices visible without treating an incomplete dependency model as canonical validation.

External API DTOs, domain models, and public response contracts may differ when the boundary protects rules or stability. They should not be triplicated when their shapes and reasons to change are genuinely identical.

## Data flow

Catalog reads follow this path:

```text
React query
  → Character Forge endpoint
  → normalized catalog query
  → memory cache
  → SRD content adapter
  → external 2024 DTO
  → normalized Character Forge contract with provider/rules metadata
```

The frontend never calls `dnd5eapi.co` directly. Provider timeouts, cancellation, malformed responses, and temporary unavailability become predictable Character Forge errors. No automatic backend retry is applied yet: provider reads are idempotent, but six-hour caching and explicit user retry avoid multiplying traffic during an outage.

Character writes remain browser-local:

```text
Valid builder edit → debounced auto-save or explicit Continue → versioned character document → IndexedDB
Completed local draft → canonical domain/rule validation API → trusted review values
```

Business rules have one canonical server implementation. Presentation-only calculations may be mirrored later only if explicitly proven safe and contract-tested against the canonical result.

## Rule Engine

The Rule Engine is an application/domain boundary, not one large class. It will be composed from focused rules/calculators as complexity becomes real, for example:

- ability and proficiency calculations
- class-level/subclass requirements
- spellcasting progression and spell availability
- feat prerequisite evaluation
- armor class and hit points
- complete-character validation

Rule checks return explanations suitable for UI, not only booleans:

```text
ValidationResult
  isValid
  violations[]

RuleViolation
  code
  message
  source
  severity
  requirement
```

Spell level is independent from character or class level. A spell becomes available through spellcasting progression, class spell lists, features, and choices—not hard-coded spell-name checks.

## Content providers

Content source and rules are separate concerns. `ISrdContentSource` is the smallest useful adapter contract around the one real provider, the D&D 5e SRD API 2024. It exists as a test and application boundary, not as a speculative provider hierarchy. No licensed or homebrew provider class will be implemented until such a provider exists.

The SRD adapter owns HTTP behavior and external DTO normalization. The Rule Engine consumes normalized content and has no dependency on upstream URLs or JSON field names.

## Local storage

Phase 4 stores character drafts in IndexedDB through a small native persistence module. The version-1 envelope contains a UUID, fixed rules identity, `schemaVersion`, creation/update timestamps, and structurally validated draft data. Domain-invalid but well-formed drafts remain representable; canonical legality still comes from `POST /api/characters/validate`.

All reads pass through Zod and an explicit `migrateStoredCharacter` seam before application code receives them. Unknown versions and malformed records fail with typed errors instead of being guessed or silently rewritten. The module exposes only list/get/save/delete operations, sorts lists by update time, and reports unavailable or blocked IndexedDB predictably. Updates compare the caller's expected timestamp in the same read-write transaction and reject stale-tab conflicts rather than silently overwriting a newer revision. Production uses the browser API directly; tests inject an in-memory standards-compatible `IDBFactory`.

No character data is stored on the server in the initial product. No account or token infrastructure will be created.

## Printing

Phase 8 will create an original semantic HTML sheet and dedicated `@media print` styles. Browser printing is the initial PDF path. The sheet targets A4, predictable breaks, monochrome legibility, and color enhancement without depending on background printing. Server-side PDF generation remains out of scope until browser printing demonstrably fails requirements.

## Testing strategy

- Backend unit tests concentrate on domain rules as they arrive.
- Backend integration tests cover public endpoints and external-adapter behavior with controlled HTTP handlers, including provider shape differences and predictable failures.
- Frontend tests cover high-value behavior: navigation, explanations, persistence, import/export, and failures.
- A small Playwright suite arrives after the primary builder journey exists.
- Large snapshots and tests of implementation details are avoided.

## Security and privacy

The absence of accounts is a deliberate reduction in attack surface. Production origins are explicit; external/user JSON is validated; no external HTML is rendered; errors do not expose stack traces; logs use structured properties; and no analytics, tracking cookies, or personal-data collection exist in the initial release.
