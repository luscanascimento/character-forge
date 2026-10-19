# ADR-024: Derive Stealth disadvantage from equipped body armor

- Status: accepted
- Date: 2026-10-18

## Context

The normalized armor contract already preserves the provider's structured Stealth-disadvantage flag. Leaving it as catalog-only metadata would make Review omit an important active equipment consequence, while applying it to owned but unequipped armor would be incorrect.

## Decision

Canonical equipment resolution reports `hasStealthDisadvantage` only when exactly one valid body armor is equipped and that armor's trusted flag is true. Shields do not activate the flag. Invalid multiple-body-armor states continue to withhold a derived result through the existing complete-character validation boundary.

Review presents the active disadvantage as a distinct warning-style derived statistic. The value is descriptive character-sheet state; roll execution and advantage/disadvantage cancellation remain outside this phase.

## Consequences

- The browser never infers the effect from armor names or descriptions.
- Ownership and equipped state remain separate from active consequences.
- Future skill-roll UI can consume one canonical flag instead of re-reading catalog content.
