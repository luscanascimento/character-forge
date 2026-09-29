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
  Feature endpoints ── Rule Engine (future)
       │
       └── SRD content adapter ── D&D 5e SRD API 2024
```

There is no authentication, server database, message broker, microservice boundary, repository layer, or speculative licensed/homebrew implementation.

## Frontend

`apps/web` is a strict TypeScript React application built by Vite.

- React Router owns navigation and lazy route boundaries.
- TanStack Query owns server state, including loading and unavailable-API states.
- Zod validates data crossing untrusted boundaries. It is already used for `/api/meta` and will later validate imports/local migrations.
- React Hook Form will be introduced only when builder forms justify it.
- Motion provides a small number of meaningful transitions and respects `prefers-reduced-motion`.
- CSS design tokens establish the charcoal, parchment, bronze, ember, typography, spacing, radius, and duration vocabulary. Components use semantic classes rather than utility walls.
- Components display rule results; they must not independently determine rule legality.

Route placeholders are intentional Phase 1 boundaries, not implemented features.

## Backend

`apps/api` is an ASP.NET Core .NET 10 REST API organized by feature. The current structure is deliberately shallow:

```text
Features/
  Meta/
Infrastructure/
Program.cs
```

New catalog functionality should live in its feature area, with shared infrastructure extracted only after a real second consumer appears. The API currently provides:

- `GET /api/meta` for the active Character Forge rules contract
- `GET /health`
- `/openapi/v1.json` in Development
- centralized exception handling with safe Problem Details
- configured-origin CORS (deny-by-default when no origins are configured)
- baseline response security headers and production HTTPS/HSTS

## Domain

The domain does not exist yet; it begins in Phase 3 after normalized catalog contracts are stable. The central aggregate will carry explicit rules identity:

```text
ruleset: "2024"
rulesVersion: "SRD-5.2.1"
classProgressions: [ ... ]
```

The initial UI supports one class, but the persisted/domain shape must avoid making one-class-only an irreversible invariant. It should not implement multiclass behavior prematurely.

External API DTOs, domain models, and public response contracts may differ when the boundary protects rules or stability. They should not be triplicated when their shapes and reasons to change are genuinely identical.

## Data flow

Catalog reads will follow this path in Phase 2:

```text
React query
  → Character Forge endpoint
  → normalized catalog query
  → memory cache
  → SRD content adapter
  → external 2024 DTO
  → normalized Character Forge contract
```

The frontend never calls `dnd5eapi.co` directly. Provider timeouts, cancellation, malformed responses, and temporary unavailability become predictable Character Forge errors. Retries are bounded and used only for transient, idempotent GET failures.

Character writes will remain browser-local:

```text
Builder intent → domain/rule validation API → versioned character document → IndexedDB
```

The exact balance between local previews and authoritative server validation will be decided in Phase 3. Business rules must have one canonical implementation; presentation-only calculations may be mirrored only if explicitly proven safe and tested against the canonical result.

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

Content source and rules are separate concerns. Phase 2 will introduce the smallest useful adapter contract around the one real provider, the D&D 5e SRD API 2024. No licensed or homebrew provider class will be implemented until such a provider exists.

The SRD adapter owns HTTP behavior and external DTO normalization. The Rule Engine consumes normalized content and has no dependency on upstream URLs or JSON field names.

## Local storage

Characters will use IndexedDB in Phase 4. Each stored/exported document includes a UUID, rules identity, `schemaVersion`, timestamps, and validated character data. Access will go through a small persistence module that owns migrations and treats IndexedDB content as untrusted input.

No character data is stored on the server in the initial product. No account or token infrastructure will be created.

## Printing

Phase 8 will create an original semantic HTML sheet and dedicated `@media print` styles. Browser printing is the initial PDF path. The sheet targets A4, predictable breaks, monochrome legibility, and color enhancement without depending on background printing. Server-side PDF generation remains out of scope until browser printing demonstrably fails requirements.

## Testing strategy

- Backend unit tests concentrate on domain rules as they arrive.
- Backend integration tests cover public endpoints and external-adapter behavior with controlled HTTP handlers.
- Frontend tests cover high-value behavior: navigation, explanations, persistence, import/export, and failures.
- A small Playwright suite arrives after the primary builder journey exists.
- Large snapshots and tests of implementation details are avoided.

## Security and privacy

The absence of accounts is a deliberate reduction in attack surface. Production origins are explicit; external/user JSON is validated; no external HTML is rendered; errors do not expose stack traces; logs use structured properties; and no analytics, tracking cookies, or personal-data collection exist in the initial release.
