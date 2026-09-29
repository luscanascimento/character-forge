# ADR-002: Store characters locally in IndexedDB

- Status: accepted
- Date: 2026-09-28

## Context

The first release has no account system and should let a user begin immediately. A server database would add authentication, privacy, operations, and security work without supporting an initial requirement.

## Decision

Persist character documents in browser IndexedDB. Each document will have a locally generated UUID, `schemaVersion`, rules identifiers, timestamps, and schema-validated data. Export/import provides portability.

The backend does not persist characters.

## Consequences

- The application remains account-free and privacy-preserving.
- Browser-data deletion can remove characters, so export must be clear and reliable.
- Local data is untrusted and requires validation/migrations on read.
- Cross-device synchronization is out of scope and would require a future ADR.
