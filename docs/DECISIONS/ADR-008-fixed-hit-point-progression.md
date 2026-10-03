# ADR-008: Use fixed hit point progression

- Status: accepted and implemented
- Date: 2026-10-03

## Context

SRD 5.2.1 allows a character gaining a level to roll the class Hit Die or use the fixed value listed by class. A rolled history would require storing every roll, distinguishing manual overrides, and defining editing behavior when levels or Constitution change. The current character aggregate contains none of that state.

Returning a higher-level `hitPointMaximum` without choosing one method would falsely present an arbitrary roll as a trusted derived value. Returning no value leaves a core Phase 5 calculation incomplete even though the rules provide a deterministic option.

## Decision

Character Forge uses fixed hit point progression for the initial supported character model:

- level 1 uses the maximum class Hit Die plus the Constitution modifier;
- each later level adds the fixed die value (`hitDie / 2 + 1`) plus the Constitution modifier;
- each later-level increase has the SRD minimum of 1 Hit Point;
- the current Constitution modifier applies across the complete 1–20 calculation.

The rule accepts only supported d6, d8, d10, and d12 class Hit Dice and levels 1–20. Canonical character evaluation now returns a fixed Hit Point maximum at every supported level.

Rolled Hit Points and manual overrides are out of scope. Supporting either requires explicit persisted history and a new decision; the UI must not present a random roll as though it were reproducible derived data.

## Consequences

- Hit Point maximum remains deterministic, recomputable, and explainable from trusted class facts and ability scores.
- Level and Constitution changes do not require hidden roll mutation or destructive history repair.
- Characters that use rolled Hit Points cannot yet be represented exactly.
