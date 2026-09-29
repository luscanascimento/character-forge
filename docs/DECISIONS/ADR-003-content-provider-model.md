# ADR-003: Isolate SRD content behind a provider adapter

- Status: accepted and implemented
- Date: 2026-09-28

## Context

The D&D 5e SRD API is an evolving external system. Its DTOs, availability, and documentation should not determine frontend or domain shapes. Future licensed or homebrew sources are plausible but are not current requirements.

## Decision

Use a dedicated `SrdApiClient` adapter. It owns `HttpClientFactory` configuration, timeout/cancellation behavior, external DTOs, response validation/mapping, and source metadata. `CatalogService` consumes normalized Character Forge content and owns caching, search, sorting, and pagination.

`ISrdContentSource` is the useful testing and dependency boundary for the real SRD adapter. Do not implement hypothetical licensed/homebrew provider classes.

The Rule Engine depends on normalized content and never on external API models.

## Consequences

- Upstream changes are contained and testable.
- The frontend is coupled only to Character Forge contracts.
- A future legal provider can integrate at the boundary without rewriting rule calculations.
- Some mapping code is required, but only where shapes or responsibilities genuinely differ.
