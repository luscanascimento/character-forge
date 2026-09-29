# ADR-002: Store characters locally in IndexedDB

- Status: accepted; implementation in progress
- Date: 2026-09-28

## Context

The first release has no account system and should let a user begin immediately. A server database would add authentication, privacy, operations, and security work without supporting an initial requirement.

## Decision

Persist character documents in browser IndexedDB. Each document has a locally generated UUID, `schemaVersion`, rules identifiers, timestamps, and structurally validated draft data. Domain-invalid drafts may be stored so incomplete work is not lost; canonical rule validation remains a separate server boundary. Export/import provides portability.

The version-1 implementation uses the native IndexedDB API behind a list/get/save/delete module. Every read passes through Zod and an explicit migration function. Unsupported versions and malformed records produce typed failures; they are never coerced into the current version.

The backend does not persist characters.

## Consequences

- The application remains account-free and privacy-preserving.
- Browser-data deletion can remove characters, so export must be clear and reliable.
- Local data is untrusted and requires validation/migrations on read.
- Draft structure and domain validity remain distinct, matching ADR-004.
- Cross-device synchronization is out of scope and would require a future ADR.
