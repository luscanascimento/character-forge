# Character Forge progress

## Current phase

**Phase 1 — Foundation: complete.**

Phase 0 and Phase 1 are implemented. Work must resume at **Phase 2 — SRD Catalog** without redoing foundation work.

## Last completed work

- Validated SRD 5.2.1 licensing and the live D&D 5e SRD API `/api/2024` resource surface.
- Recorded the API inventory, observed counts, missing-general-rules caveat, and upstream documentation discrepancy.
- Created the React/Vite/strict TypeScript and ASP.NET Core/.NET 10 workspace.
- Added React Router lazy routes, TanStack Query, Zod response validation, Motion, Lucide, responsive design tokens, and accessible reduced-motion behavior.
- Added a dark-fantasy homepage, original generated hero artwork, placeholder routes, local-first microcopy, and in-app legal attribution.
- Added `/api/meta`, `/health`, development OpenAPI, Problem Details, global exception handling, restricted configurable CORS, production HTTPS/HSTS, and baseline security headers.
- Added frontend behavioral tests and backend integration tests.

## Work in progress

None. The working checkpoint is the end of Phase 1.

## Next step

Start Phase 2 with a narrow vertical slice:

1. Re-read `README.md`, this file, `ROADMAP.md`, `ARCHITECTURE.md`, ADR-001 and ADR-003, and `SRD-API-RESEARCH.md`.
2. Define the first Character Forge catalog contract for class summaries.
3. Implement a typed `HttpClientFactory` client for `/api/2024/classes`, with timeout, cancellation, mapping, `IMemoryCache`, and predictable provider failures.
4. Add integration tests with a stubbed upstream handler.
5. Expose the normalized class-summary endpoint and build the first compendium list state.

Do not consume the external API directly from React and do not begin character domain rules yet.

## Pending decisions

- Cache duration and stale-data fallback policy should be decided from observed provider behavior during the first Phase 2 slice.
- Whether normalized provider snapshots need lightweight checked-in fixtures should be decided after the first two resource schemas are mapped.
- A project source-code license remains to be selected before public portfolio release.

## Known issues and limitations

- Catalog, Rule Engine, builder, IndexedDB, import/export, and print functionality are not implemented by design.
- Upstream 2024 documentation is partially inconsistent: the live API and source expose 2024 while introductory/readme prose still references 2014.
- The external API does not expose an immutable catalog snapshot version in normal responses.
- The hero has been converted to a 140 KB WebP; responsive variants can be considered during the Phase 9 performance audit if measurements justify them.

## Test status

- Frontend lint: passing (`oxlint`, no warnings)
- Frontend unit tests: 2 passing (`vitest run`)
- Frontend production build/typecheck: passing (`tsc -b && vite build`)
- Formatting: passing (`prettier --check .` and `dotnet format --verify-no-changes`)
- Backend Release build: passing with 0 warnings and 0 errors
- Backend integration tests: 3 passing
- Manual HTTP smoke checks: `/api/meta`, `/health`, OpenAPI, security headers, and origin-specific CORS passing
- Visual smoke checks: desktop 1440×1000 and mobile 375×812 reviewed; primary content and controls remain usable
- Dependency audit: npm and NuGet report no known vulnerabilities

## Last checkpoint

2026-09-28 (America/Sao_Paulo)
