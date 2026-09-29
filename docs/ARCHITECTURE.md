# Architecture

## Shape

Character Forge is a small modular monolith with two deployable applications:

```text
Browser
  React UI
  IndexedDB (future characters)
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
- Zod validates data crossing untrusted boundaries. It validates `/api/meta` and all catalog responses and will later validate imports/local migrations.
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
  Meta/
Infrastructure/
  Srd/
Program.cs
```

New catalog functionality should live in its feature area, with shared infrastructure extracted only after a real second consumer appears. The API currently provides:

- `GET /api/meta` for the active Character Forge rules contract
- `GET /api/catalog/{category}` for normalized, searched, filtered, and paginated summaries
- `GET /api/catalog/{category}/{id}` for normalized detail
- `GET /health`
- `POST /api/characters/validate` for non-persisting draft validation and calculations
- `/openapi/v1.json` in Development
- centralized exception handling with safe Problem Details
- configured-origin CORS (deny-by-default when no origins are configured)
- baseline response security headers and production HTTPS/HSTS
- a per-IP fixed-window limit on catalog reads

The SRD adapter uses a typed `HttpClient` created by `HttpClientFactory`, an eight-second configurable timeout, request cancellation, explicit external DTOs, and category-specific mapping. Provider transport failures, timeouts, invalid JSON, and non-success responses become safe `503` Problem Details. Missing detail resources remain `404`.

`CatalogService` caches normalized upstream lists and details in `IMemoryCache` for six hours by default. Search, sorting, and pagination operate over cached lists; cache entries carry their observed `fetchedAt` instant. There is no stale-data store across process restarts yet.

## Domain

The Phase 3 domain is complete. Its central aggregate carries explicit rules identity:

```text
ruleset: "2024"
rulesVersion: "SRD-5.2.1"
classProgressions: [ ... ]
proficiencyChoices: [ ... ]
```

The aggregate is draft-capable: incomplete or invalid choices remain representable and are explained by a structured `ValidationResult`. Catalog selections are retained as references with ids and display names. `classProgressions` is a collection so the document shape does not make one class irreversible, while the current validator explicitly requires exactly one entry and implements no multiclass behavior.

Pure ability-modifier and proficiency-bonus calculators enforce their numeric bounds. `POST /api/characters/validate` is the canonical rule boundary: it does not persist data and emits derived values only when the complete document is valid for 2024 / SRD 5.2.1. See ADR-004 for the distinction between a persisted draft and trusted domain state.

Character evaluation resolves the selected class, species, and background through `CatalogService` before calculating. Normalized catalog detail carries typed character-creation facts—hit die, direct proficiency grants, and proficiency-choice requirements—so the domain never parses presentation strings or accepts client-supplied rule facts. The adapter resolves referenced species traits and flattens the provider's equivalent nested option families into stable choice ids, counts, and option lists.

The evaluator calculates unarmored AC and level-1 HP, validates every required proficiency choice, canonicalizes selected references, rejects stale/disallowed/duplicate selections, merges unavoidable fixed duplicates, and retains every source that supplied a grant. SRD 5.2.1 says proficiency bonuses do not stack but does not carry forward the 2014 rule that allowed arbitrary replacement of duplicate proficiencies, so Character Forge does not invent such replacements.

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

Character writes will remain browser-local:

```text
Builder intent → domain/rule validation API → versioned character document → IndexedDB
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

Characters will use IndexedDB in Phase 4. Each stored/exported document includes a UUID, rules identity, `schemaVersion`, timestamps, and validated character data. Access will go through a small persistence module that owns migrations and treats IndexedDB content as untrusted input.

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
