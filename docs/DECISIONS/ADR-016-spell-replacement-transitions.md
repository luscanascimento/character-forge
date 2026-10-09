# ADR-016: Validate spell replacement as a transition between canonical states

- Status: accepted and implemented
- Date: 2026-10-08

## Context

ADR-012 records when each class may replace cantrips and prepared spells and how many replacements an event permits. Initial character construction has no prior spell state, so applying those limits to the existing single-document validation endpoint would either reject valid higher-level creation or require invented history.

Once a character exists, however, replacing spells after gaining a class level or finishing a Long Rest is a transition. The rule needs both the previously valid selections and the proposed valid selections to distinguish replacements from capacity gained through progression.

## Decision

Character Forge adds `POST /api/characters/validate-spell-replacement`. Its request contains canonical `previous` and `current` character documents plus one explicit trigger: `classLevelGained` or `longRest`.

Both character states pass through complete canonical evaluation before transition rules run. Violations from either state are prefixed with `previous.` or `current.` and no derived values are returned. A transition then requires:

- the same character UUID and single class in both states;
- exactly one additional class level for `classLevelGained`;
- the same class level for `longRest`;
- each changed spell group to match its manifest trigger; and
- the number of removed prior selections to be within the policy maximum, when one exists.

Only prior selections absent from the current state count as replacements. New selections added solely because the class-level capacity increased do not. A `null` maximum permits any number of replacements, while a missing cantrip policy prohibits base-feature cantrip replacement. Spellbook additions are ownership changes and are not counted as cantrip or prepared-spell replacements.

The existing `POST /api/characters/validate` endpoint remains the history-free character-construction boundary. The transition endpoint validates and calculates the proposed state but does not persist or mutate either document.

## Consequences

- Initial construction remains possible directly at any supported class level.
- Bard, Sorcerer, and Warlock one-per-level limits can be enforced without mistaking increased capacity for replacement.
- Cleric, Druid, Paladin, Ranger, and Wizard Long Rest behavior follows the same typed manifest.
- Future character-sheet lifecycle UI has a schema-validated API adapter without coupling replacement history to the local draft schema.
