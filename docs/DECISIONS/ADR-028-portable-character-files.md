# ADR-028: Portable character files

**Status:** Accepted  
**Date:** 2026-10-19

## Context

IndexedDB keeps drafts private and account-free, but browser data can be cleared and cannot move naturally between devices. Phase 8 requires JSON export/import without allowing malformed, oversized, stale, or colliding files to damage the local roster.

The stored-character envelope already has a schema version, fixed rules identity, UUID, and timestamps. Treating arbitrary JSON as a raw IndexedDB record would still risk silent replacement when an imported UUID matches an existing character.

## Decision

Use a dedicated version-1 transfer envelope:

```json
{
  "format": "character-forge-character",
  "exportVersion": 1,
  "exportedAt": "ISO-8601 timestamp",
  "character": "complete schema-versioned stored character"
}
```

Imports are limited to 1 MB and pass through JSON parsing, the strict transfer-envelope schema, and the existing stored-character migration/validation boundary. Only the active `2024` / `SRD-5.2.1` identity and supported schema version are accepted.

Every successful import receives a fresh local UUID and fresh creation/update timestamps while preserving the complete character draft. Import therefore always creates a new roster entry and never overwrites an existing character. Invalid input performs no storage write.

Exports are readable, indented JSON with a recognizable `.character-forge.json` filename. They contain no server state because character persistence remains browser-local.

## Consequences

- Export files are portable backups rather than database replicas.
- Future transfer formats can migrate independently from the stored-character schema.
- Supporting another rules or schema version requires an explicit migration path; imports fail closed until one exists.
- Imported characters retain their names and choices, but not the source browser's local identity or timestamps.
