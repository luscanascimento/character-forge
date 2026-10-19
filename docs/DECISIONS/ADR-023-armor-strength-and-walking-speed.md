# ADR-023: Derive armor Strength penalties from canonical species speed

- Status: accepted
- Date: 2026-10-18

## Context

Armor detail exposes a numeric Strength minimum, and species detail exposes walking speed. The movement penalty depends on both trusted facts and the character's effective Strength, so it cannot be represented accurately by a static armor label or a browser-only calculation.

## Decision

Character Forge normalizes species walking speed into character-creation facts and requires a positive supported value during canonical evaluation. When exactly one valid body armor is equipped and the character's effective Strength is below its canonical minimum, walking speed is reduced by 10 feet. Meeting the minimum, wearing no body armor, or equipping a Shield alone preserves the species speed.

The derived result is returned beside Armor Class and displayed in Review. Ability Score Improvement effects apply before the comparison because all downstream calculations consume effective abilities.

## Consequences

- Species speed and armor minimums remain provider-owned numeric facts.
- A Strength increase can remove the penalty without rewriting equipment or base abilities.
- Other speed types, temporary modifiers, and class-feature exceptions remain outside this increment.
