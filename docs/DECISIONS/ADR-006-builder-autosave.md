# ADR-006: Debounce valid builder edits and reject stale writes

- Status: accepted and implemented
- Date: 2026-10-03

## Context

Character Forge stores unfinished characters locally. Requiring an explicit save after every edit makes accidental loss more likely, but persisting every keystroke creates unnecessary IndexedDB traffic. The builder must also preserve incomplete form input without presenting it as a saved character value, and two open tabs must not silently overwrite one another.

Auto-save and step progression are different actions. A background write should protect work without moving the user, while Continue communicates an intentional transition to the next step.

## Decision

The active builder step auto-saves a changed, structurally valid value after 650 milliseconds without another edit. Incomplete or invalid step input stays in component state and is not persisted. Auto-save never changes the active step.

Continue validates the current step, saves a changed value immediately, and advances only after that write succeeds. If the canonical persisted value is unchanged, Continue advances without issuing a redundant write.

All step writes use one mutation pipeline. Only one write may be pending in a tab; an edit made during that write remains in the form and becomes the next debounced candidate after the first write succeeds. Update timestamps are monotonically advanced even when the injected or system clock does not move between writes.

Every update supplies the revision it read as `expectedUpdatedAt`. IndexedDB compares that revision and writes the replacement in the same read-write transaction. A mismatch, or a stored timestamp newer than the candidate, raises a typed conflict instead of overwriting the record. The builder tells the user to reopen the character; it does not silently merge tabs or choose a winner. Cross-tab broadcasts and automatic merging remain out of scope.

## Consequences

- Valid local work is protected shortly after editing without unexpected navigation.
- Invalid and partial choices remain editable but are honestly reported as unsaved.
- Explicit progression remains predictable and save failures keep the user on the current step.
- Pending writes cannot roll a newer same-tab edit back, and stale tabs cannot overwrite a newer IndexedDB revision.
- A future collaborative or automatic merge policy requires a separate decision and richer revision semantics.
