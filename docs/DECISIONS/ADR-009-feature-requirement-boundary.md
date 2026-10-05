# ADR-009: Do not infer feature choices from narrative content

- Status: accepted
- Date: 2026-10-04

## Context

Phase 5 needs level-dependent class features, subclass selection, and eventually feature choices such as Fighting Style, Weapon Mastery, Expertise, and qualifying feats. The 2024 provider exposes complete class and subclass timelines with stable feature references, but all 232 feature-detail resources expose their rules only as descriptions. They contain no structured option set, selection count, or prerequisite expression.

Parsing those descriptions or switching on display names would make validation depend on prose formatting and would silently turn provider presentation content into an unversioned rules engine. Persisting selections before their requirements can be validated would also allow the builder to present unsupported choices as canonical.

## Decision

- Use the normalized class progression as the trusted source for class level, proficiency bonus, feature availability, subclass references, and subclass availability level.
- Persist an optional subclass reference with the single class progression. Drafts without the new field remain valid schema-version-1 documents.
- When level decreases, retain a saved subclass and return a structured violation if it is no longer available.
- Do not create feature-choice contracts, persisted feature-choice selections, or builder controls from narrative feature descriptions.
- Keep the existing feature references as timeline/display facts only. ADR-010 adopts a separately reviewed, versioned Character Forge rules manifest for the narrow semantics the provider does not structure.
- Keep spellcasting, class-specific counters, feats, and equipment rules in their owning phases.

## Consequences

- Phase 5 can safely deliver level and subclass progression without pretending that prose is machine-verifiable.
- A level change never silently deletes the selected subclass.
- The builder can explain locked subclass availability using a numeric requirement supplied by the progression contract.
- Fighting styles, mastery selections, Expertise, Ability Score Improvement, and similar choices remain visibly outside the supported validation boundary.
- Completing supported Phase 5 feature choices requires the hybrid provider/manifest boundary in ADR-010 rather than an adapter-only change.
