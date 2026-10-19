# ADR-026: Separate subclass discovery from rule availability

- Status: accepted
- Date: 2026-10-18

## Context

The 2024 Player's Handbook lists four subclasses for each of its twelve classes, but SRD 5.2.1 and the configured D&D 5e SRD API expose only one subclass progression per class. Showing only the provider result makes the product look accidentally incomplete. Treating the other names as selectable would be worse: the server could not validate their level features or choices, and copying non-SRD rules into the repository is outside the content boundary.

## Decision

The frontend owns a bounded discovery directory containing only the stable names and ids of all 48 subclasses. It combines those names with the progression response by id:

- a matching SRD progression is selectable once its server-provided level requirement is met;
- an entry without a matching progression remains visible, locked, and explicitly labeled as unavailable in the SRD;
- unexpected future provider-backed entries are still rendered, even when the local discovery directory has not yet been updated.

The directory contains no descriptions, features, level requirements, or mechanics. It cannot authorize persistence or canonical evaluation. The backend progression contract remains the sole source of subclass rule availability.

## Consequences

- Users can see the complete 2024 subclass lineup without mistaking the current implementation boundary for the product catalog.
- The application does not fabricate rule support or silently accept an unvalidated subclass.
- Supporting another subclass later requires a lawful structured rule source and canonical backend progression, not merely changing its UI state.
- The directory needs a deliberate update if a future rules edition changes its subclass lineup.
