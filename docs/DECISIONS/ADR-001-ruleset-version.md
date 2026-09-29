# ADR-001: Pin characters to 2024 / SRD 5.2.1

- Status: accepted
- Date: 2026-09-28

## Context

The 2014 and 2024 fifth-edition rules differ materially. The external API exposes year-versioned routes, while the redistributable modern rules are published as SRD 5.2.1. Silent mixing would make rule results and saved characters ambiguous.

## Decision

The initial application supports exactly:

- `ruleset: "2024"`
- `rulesVersion: "SRD-5.2.1"`

These identifiers are part of API metadata and will be stored in every character document/export. External requests use `/api/2024`. Rule code and content mappings must not fall back to 2014 data.

## Consequences

- Saved data can be interpreted against an explicit rules contract.
- Supporting 2014 or a later SRD requires deliberate mapping/rules work rather than a flag alone.
- The upstream API's own release/version metadata is insufficient; Character Forge records its rules identity separately.
