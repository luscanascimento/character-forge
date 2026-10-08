# ADR-013: Validate canonical spell selections without destructive cleanup

- Status: accepted and implemented
- Date: 2026-10-07

## Context

ADR-011 supplies selected-level cantrip, prepared-spell, and slot capacities. ADR-012 distinguishes class-list preparation from Wizard spellbook preparation. Persisting only spell ids would still allow wrong-class spells, inaccessible spell levels, duplicate entries, stale names, or selections left behind after a class or level change.

Automatically deleting an invalid selection would also hide why a formerly valid draft changed. The builder already uses explicit correction for retained subclasses, proficiencies, and feature choices.

## Decision

Version-1 character drafts gain a `spells` object with `cantrips` and `preparedSpells` arrays of canonical content references. Missing objects default to empty arrays, so no schema-version migration is required.

For a class whose verified `preparedSpellSource` is `classSpellList`, canonical evaluation resolves the complete class-filtered spell catalog and requires:

- exactly the cantrip and prepared-spell counts in the selected class-level row;
- distinct ids within each group;
- level 0 for cantrips;
- levels 1 through the highest currently available base slot for prepared spells;
- membership in the active class list and an exact canonical catalog name.

Warlock Mystic Arcanum remains separate from this prepared-spell capacity. Wizard spell selection remains locked because a class-list check cannot substitute for spellbook ownership. Noncasters accept an empty spell block but reject retained selections.

The browser exposes Spells as a dedicated builder step and retrieves every catalog page for the selected class. When a class or level change makes a saved selection invalid, the reference remains visible as unavailable until the user explicitly removes or replaces it. The API validates but does not mutate submitted characters.

## Consequences

- Persisted class-list selections have a single canonical validation path shared with the rest of character evaluation.
- Provider pagination cannot silently truncate available spell options in the builder.
- Level and class changes are non-destructive and explainable.
- Wizard cantrips and prepared spells remain unavailable until the spellbook model is implemented.
- Replacement timing from ADR-012 is available as policy data but is not yet modeled as a character lifecycle event.
