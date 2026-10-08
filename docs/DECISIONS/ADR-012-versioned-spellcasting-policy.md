# ADR-012: Own versioned class spellcasting policies

- Status: accepted and implemented
- Date: 2026-10-07

## Context

The live 2024 provider structures spellcasting ability, cantrip and prepared-spell capacities, and slots by spell level. It does not structure the behavior that makes those numbers usable for selection and invalidation:

- Bard, Sorcerer, and Warlock replace one prepared spell when gaining a class level.
- Cleric and Druid can replace any prepared spells after a Long Rest.
- Paladin and Ranger replace one prepared spell after a Long Rest.
- Wizard prepares from its spellbook and can replace any prepared spells after a Long Rest.
- Warlock slots are a uniform Pact Magic pool recovered after a Short or Long Rest; Mystic Arcanum grants separate level 6–9 access.

Parsing those facts from mutable prose would violate ADR-009. Treating every provider `prepared_spells` field identically would produce invalid selection and replacement behavior.

## Decision

Character Forge owns spellcasting policy manifest `SRD-5.2.1-SPELL-1`. Each of the eight SRD spellcasting classes has a typed entry containing:

- the expected provider class and spellcasting-ability ids;
- whether prepared spells come from the class spell list or a spellbook;
- cantrip and prepared-spell replacement trigger plus an optional maximum replacement count, where `null` means any number within the current capacity;
- standard or Pact Magic slot-pool identity, base recovery trigger, uniform-slot behavior, and maximum slot level;
- special non-slot spell access; the initial special access entries are Warlock Mystic Arcanum at class levels 11/13/15/17 for spell levels 6/7/8/9;
- SRD document, section, page, and URL provenance.

The public class progression contract exposes a string-valued policy document rather than internal enums. The progression service verifies the manifest against normalized provider facts before returning it. Missing entries, ability disagreement, impossible cantrip-policy shape, slots above the class maximum, or a non-uniform Pact Magic table fail as content-provider errors.

The implemented policies are:

| Class    | Prepared source | Cantrip replacement  | Prepared-spell replacement | Base slots                      | SRD pages |
| -------- | --------------- | -------------------- | -------------------------- | ------------------------------- | --------- |
| Bard     | Class list      | One / class level    | One / class level          | Standard / Long Rest            | 32        |
| Cleric   | Class list      | One / class level    | Any / Long Rest            | Standard / Long Rest            | 36–37     |
| Druid    | Class list      | One / class level    | Any / Long Rest            | Standard / Long Rest            | 42        |
| Paladin  | Class list      | None in base feature | One / Long Rest            | Standard / Long Rest            | 54        |
| Ranger   | Class list      | None in base feature | One / Long Rest            | Standard / Long Rest            | 58        |
| Sorcerer | Class list      | One / class level    | One / class level          | Standard / Long Rest            | 64–65     |
| Warlock  | Class list      | One / class level    | One / class level          | Pact Magic / Short or Long Rest | 71–72     |
| Wizard   | Spellbook       | One / Long Rest      | Any / Long Rest            | Standard / Long Rest            | 77–78     |

Base recovery deliberately excludes additional class features such as Arcane Recovery and Magical Cunning. Those features do not change the identity or ordinary recovery trigger of the slot pool.

## Consequences

- Future spell-selection validation can apply class-specific replacement and source rules without parsing descriptions.
- Pact Magic cannot be mistaken for the standard full-caster slot table.
- Mystic Arcanum remains separate from slots, preventing level 6–9 Warlock access from disappearing merely because Pact Magic stops at level 5.
- Provider drift fails closed before incomplete policy reaches the browser.
- Persisted spell selections and their invalidation paths are still future work; this decision supplies the rule contract they require.
