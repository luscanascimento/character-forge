# ADR-018: Separate equipment ownership from equipped armor effects

- Status: accepted and implemented
- Date: 2026-10-09

## Context

Starting-equipment packages describe one way a character can acquire an initial inventory, but they are not durable ownership state. Characters can later buy, lose, or replace items. Armor Class also depends on which owned body armor and Shield are equipped, the item's canonical Dexterity rule, and the character's armor training.

Persisting copied armor statistics would make local drafts stale when catalog facts change. Treating every owned armor item as active would make inventories with alternatives impossible. Silently calculating armor for an untrained character would omit the rule consequences Character Forge does not yet model.

## Decision

Schema-version-1 drafts gain a backward-compatible `equipment.items` collection. Each entry stores only a canonical item reference, quantity, and explicit equipped flag. Older drafts default to an empty inventory through the existing migration seam.

Canonical evaluation resolves every distinct item through the equipment catalog and enforces:

- one entry per canonical item id, with quantity 1–999;
- canonical existence and exact catalog name;
- at most one equipped suit of light, medium, or heavy body armor;
- at most one equipped Shield contributing to Armor Class; and
- stable-id armor/Shield training from the character's resolved proficiency grants.

Untrained equipped armor is rejected in the current supported boundary rather than returning derived values that omit its other consequences. Strength minimum and Stealth disadvantage remain trusted catalog facts but do not change Armor Class.

Armor Class uses the equipped body armor's base plus its permitted Dexterity modifier, or `10 + Dexterity modifier` when no body armor is equipped. One equipped Shield adds its catalog base bonus. The client never submits armor statistics.

## Consequences

- Inventory survives independently from class/background starting-package history.
- Equipped state is explicit and non-destructive; unequipping never deletes ownership.
- Catalog changes produce structured stale-reference violations instead of silently rewriting a draft.
- Armor Class now reflects canonical armor and Shield facts for supported, trained configurations.
- Weapon attacks, carrying capacity, Strength-minimum speed effects, Stealth disadvantage presentation, and the builder equipment UI remain separate Phase 7 increments.
