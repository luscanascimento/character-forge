# ADR-014: Record Wizard spellbook ownership before preparation

- Status: accepted and implemented
- Date: 2026-10-08

## Context

ADR-013 validates class-list casters, but a Wizard prepares from owned spellbook entries rather than directly from the complete Wizard list. Allowing Wizard prepared spells without recording that ownership would erase the class's central preparation boundary.

The SRD grants six level-1 Wizard spells in the initial spellbook and two additional eligible Wizard spells whenever a Wizard level is gained. Wizards may also copy more spells through play, so the level-derived total is a minimum rather than an exact capacity.

## Decision

Spellcasting policy manifest `SRD-5.2.1-SPELL-2` adds a Wizard-only spellbook policy containing six initial spells and two spells per additional Wizard level. A spellbook policy is required exactly when the prepared source is `spellbook`; other classes cannot expose one.

Version-1 character drafts add a backward-compatible `spells.spellbook` array that defaults to empty. Canonical Wizard validation requires:

- the selected-level cantrip count from the Wizard class list;
- at least `6 + 2 × (Wizard level − 1)` distinct spellbook entries;
- every owned entry to be a canonical Wizard spell between level 1 and the highest current base slot level;
- the selected-level prepared-spell count; and
- every prepared spell to be both canonically eligible and present in the recorded spellbook.

Additional eligible spellbook entries are accepted because copied spells have no fixed upper bound. The builder presents cantrips, spellbook ownership, and preparation as separate groups and retains invalidated references until explicit correction.

## Consequences

- Wizard preparation now has the same server-owned canonical boundary as other spell selection.
- Preparation cannot grant implicit ownership.
- The model supports copied spells without inventing a maximum.
- Acquisition history and replacement-event limits remain separate lifecycle work.
