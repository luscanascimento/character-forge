# ADR-015: Resolve spell-granting Fighting Styles from canonical class cantrip lists

- Status: accepted and implemented
- Date: 2026-10-08

## Context

ADR-010 represented Blessed Warrior and Druidic Warrior as typed two-cantrip branches but kept them locked until Phase 6 owned canonical spell-list selection. The spellcasting foundation now distinguishes spell level from class level, exposes filtered class lists, and validates canonical references without parsing feature prose.

These Fighting Styles are alternatives to a Fighting Style feat. Blessed Warrior grants two Cleric cantrips to a Paladin, while Druidic Warrior grants two Druid cantrips to a Ranger. They use the owning class's existing spellcasting ability, so they must not create a second spellcasting progression or change prepared-spell capacity.

## Decision

Feature-rule manifest `SRD-5.2.1-CF-2` marks both `classCantrips` branches as supported. Each branch retains its exact selection count and source-class filter:

- `blessed-warrior`: exactly two level-0 Cleric spells;
- `druidic-warrior`: exactly two level-0 Druid spells.

The feature-rule service queries the provider's canonical spell catalog with both `level=0` and the source class filter. It rejects duplicate, non-cantrip, or insufficient results before exposing sorted id/name references. Character evaluation continues to validate the selected branch through the generic feature-choice rules: exact count, distinct ids, active requirement, allowed options, and canonical names.

The selections remain in `featureChoices`, because they are granted by a mutually exclusive Fighting Style branch rather than by the base class's cantrip capacity. Spell Save DC and spell attack modifier continue to use the owning Paladin or Ranger spellcasting ability already resolved from progression.

## Consequences

- Blessed Warrior and Druidic Warrior are selectable without copying spell data into the manifest.
- A class-filter or spell-level provider regression fails closed.
- The base Paladin/Ranger cantrip count remains unchanged.
- The builder supports multi-option Fighting Style branches and displays the branch plus its chosen cantrips in review.
