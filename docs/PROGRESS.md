# Character Forge progress

## Current phase

**Phase 7 — Feats & Equipment: in progress.**

Phases 0–6 are implemented. Phase 6 closed with canonical spell progression, selection, calculations, class-specific policy, spellbook ownership, and replacement transitions without pulling equipment or character-sheet scope forward.

## Last completed work

- Defined a versioned, draft-capable `Character` aggregate with UUID/name identity, six ability scores, species/background references, and a class-progression collection whose validator currently requires exactly one class.
- Centralized the supported `2024` / `SRD-5.2.1` identity and reused it in application metadata and character validation.
- Added pure, bounded ability-modifier and proficiency-bonus rules, including correct floor division for negative modifiers and level 1–20 proficiency progression.
- Added structured `ValidationResult` / `RuleViolation` output for incomplete choices, invalid references, ability bounds, class count/level, and rules-version mismatches.
- Added `POST /api/characters/validate`, which stores nothing and returns derived values only for a wholly valid document.
- Recorded the draft-versus-validated-state boundary in ADR-004 and covered the domain and endpoint with focused tests.
- Added provider-neutral character-creation facts to normalized catalog details so rule code consumes a numeric hit die and structured proficiency references instead of presentation strings.
- Added trusted content resolution for selected class, species, and background, including structured violations when a saved reference no longer exists.
- Added unarmored AC and level-1 HP calculations plus fixed proficiency grants that deduplicate by id while retaining every source.
- Live-smoke-tested the full validation flow with Wizard, Elf, and Acolyte against the 2024 provider.
- Normalized class/background proficiency choices and species choices referenced through traits into stable ids, counts, prompts, and canonical option lists.
- Flattened the provider's nested Monk tool families without leaking its choice tree into catalog, draft, or domain contracts.
- Added proficiency selections to the draft aggregate and structured violations for missing, repeated, stale, disallowed, incorrectly counted, or duplicate selections.
- Canonicalized selected proficiency names from trusted content and documented why SRD 5.2.1 duplicates are rejected rather than replaced by a rule carried over from 2014.
- Extended the frontend catalog schema so normalized creation facts survive the API boundary for Phase 4.
- Live-smoke-tested the complete Wizard/Elf/Acolyte choice flow and recorded the normalization decision in ADR-005.
- Defined the schema-version-1 local envelope with UUID, fixed rules identity, timestamps, and structurally validated draft data.
- Added Zod schemas for stored drafts, canonical validation requests, and character evaluation responses.
- Added a native IndexedDB module with list/get/save/delete operations, update-time ordering, injected `IDBFactory`, and an explicit migration seam.
- Added typed failures for unavailable storage, malformed records, and unsupported schema versions without silently discarding or guessing data.
- Added a tested API adapter that strips persistence metadata before canonical server validation.
- Added `fake-indexeddb` as a test-only implementation of the native browser API; production has no storage wrapper dependency.
- Replaced the My Characters placeholder with a responsive, IndexedDB-backed local roster ordered by most recently updated.
- Added explicit loading, empty, malformed-record, unavailable-storage, and create-failure states with retry behavior that never silently deletes local data.
- Added a minimal versioned draft factory and create action that persists a UUID/timestamped blank character before opening its future builder route.
- Added focused UI coverage for roster ordering, builder navigation, draft creation, local-data messaging, and storage recovery.
- Replaced the character-specific forge placeholder with a responsive builder shell that loads the requested local draft and distinguishes loading, missing, malformed, and unavailable-storage states.
- Established an accessible six-step creation sequence while keeping unfinished steps visibly locked instead of pretending they are available.
- Implemented the first character-name step with explicit local saving, whitespace normalization, update timestamps, failure feedback, and roster-cache synchronization without introducing auto-save early.
- Added focused coverage for draft loading, progressive navigation, missing/error recovery, required-name behavior, and explicit persistence.
- Added a resumable Abilities step that unlocks after a saved name and keeps completed earlier steps editable.
- Added six accessible integer inputs with complete 1–30 bounds feedback, modifier previews, and explicit all-at-once persistence.
- Kept modifier previews presentation-only and documented that canonical validity and derived values remain owned by server evaluation.
- Added focused coverage for resume/navigation behavior, incomplete and out-of-range values, negative floor-division previews, formatted modifiers, and saved ability sets.
- Added a resumable Origins step that unlocks after abilities and fetches species/background choices through the normalized catalog client.
- Requested the complete bounded origin lists, exposed honest loading/provider-error states with retry, and retained the local draft when the catalog is unavailable.
- Persisted only canonical id/name references selected from trusted catalog results, with both choices required and existing choices restored on reopen.
- Added focused coverage for origin resume, catalog query bounds, required choices, stable reference persistence, and provider recovery.
- Added a resumable Class step that unlocks after saved origins and loads the complete bounded class list through the normalized catalog client.
- Persisted exactly one canonical class reference at level 1 without copying class rule facts into the local draft.
- Advanced saved origins into class selection while keeping every completed earlier step editable and existing class choices restored on reopen.
- Added focused coverage for class navigation, required selection, stable level-1 persistence, catalog query bounds, and provider recovery.
- Added a resumable Proficiencies step that unlocks after class selection and resolves the selected class, species, and background through normalized catalog details in parallel.
- Presented fixed proficiency grants separately and enforced every trusted choice id, exact count, allowed option, and cross-source duplicate constraint before local persistence.
- Preserved still-valid saved selections while surfacing stale choices and disallowed saved options with explicit removal controls instead of silently replacing local data.
- Persisted only canonical option ids and names from the current catalog requirements and added honest loading, incomplete-facts, provider-error, retry, and save-failure states.
- Added focused coverage for resume, navigation, canonical persistence, exact counts, duplicate selection, stale/disallowed data, detail query bounds, and provider recovery.
- Added a Review step that unlocks only after the currently resolved proficiency requirements are satisfied and resumes complete baseline drafts automatically.
- Routed the local document through the existing canonical validation adapter and presented trusted ability modifiers, proficiency bonus, unarmored AC, level-1 HP, hit die, and resolved proficiency sources.
- Presented structured rule violations without mutating the draft and linked recognized violation sources back to the relevant editable builder step.
- Added honest validation loading, incomplete-response, request-failure, and retry states plus a responsive review layout for identity, origins, class, abilities, derived statistics, and proficiencies.
- Added focused coverage for successful resume, trusted derived values, review unlocking, structured invalid results, retry, unchanged local persistence, and backward navigation.
- Added a schema-validated duplication helper that preserves the complete character while assigning a new UUID, fresh creation/update timestamps, and an intentional copied name.
- Added per-character Duplicate and Delete actions to the local roster, with successful copies ordered first and React Query caches synchronized after each operation.
- Added an accessible destructive confirmation for deletion; cancellation and storage failures retain the original card, and no optimistic deletion can hide unsaved failure state.
- Added focused schema, navigation, duplication, cancellation, deletion, and storage-failure coverage while retaining the existing malformed-record and unavailable-storage boundaries.
- Added a 650 ms auto-save for changed, valid values on every editable builder step while keeping invalid or incomplete form input local and never advancing the active step in the background.
- Kept Continue as the explicit progression action: changed values save immediately before advancing, unchanged persisted values advance without a redundant write, and save failures leave the user editing the same step.
- Serialized all builder writes through one mutation pipeline, preserved newer input typed while a write is pending, and made update timestamps monotonic across rapid saves.
- Added optimistic concurrency to the native IndexedDB transaction with an expected revision, typed stale-write conflicts, and clear reopen guidance instead of silently overwriting another tab.
- Recorded the auto-save and conflict policy in ADR-006 and added focused coverage for debounce, invalid drafts, conflicts, ordering, and step progression.
- Inventoried all twelve live 2024 class-level tables and all twelve subclass timelines, including the polymorphic class-specific counters and spellcasting fields intentionally excluded from the first Phase 5 slice.
- Added a provider-neutral class progression contract with the canonical class/hit die, a strict ordered 1–20 level table, proficiency bonuses, feature references, subclass availability, and sparse subclass feature levels.
- Added `GET /api/classes/{classId}/progression` with configured memory caching, source/rules metadata, slug validation, predictable not-found/provider failures, and no upstream DTO leakage.
- Rejected incomplete tables, unsupported hit dice, invalid proficiency bonuses, duplicate subclass levels, and mismatched class/subclass references at the provider boundary.
- Recorded scope and non-destructive level-change policy in ADR-007 and added focused adapter/endpoint/cache coverage.
- Added canonical fixed Hit Point progression for levels 1–20, using the class fixed die value, Constitution modifier, and the minimum-one increase for later levels.
- Extended character evaluation to return deterministic higher-level HP, documented the fixed-over-rolled product decision in ADR-008, and covered supported dice, low Constitution, level bounds, and endpoint output.
- Audited all 232 live 2024 feature resources and confirmed that choices and prerequisites are available only as narrative descriptions, not structured rule data.
- Recorded in ADR-009 that class level and subclass availability may use the normalized progression contract, while feature choices must not be inferred from prose or display names.
- Extended schema-version-1 class progressions with an optional subclass reference while defaulting older stored drafts to `null` through the existing migration seam.
- Added canonical subclass rules that require a trusted option at its availability level, reject selections from another class, and retain but invalidate a saved subclass when level drops below its requirement.
- Resolved subclass rules from the normalized class progression during character evaluation without accepting client-supplied availability facts.
- Connected the builder to the normalized class progression with a schema-validated client, levels 1–20, canonical proficiency-bonus labels, and recoverable provider-error states.
- Added level-aware subclass controls that explain locked availability, require an eligible choice, preserve a now-locked selection after level reduction, and remove it only through an explicit action.
- Added an informational class/subclass feature list for the selected level and kept narrative feature choices outside the interactive rule boundary.
- Included the selected subclass in review and added focused coverage for progression loading, level/subclass persistence, locked-state retention, explicit removal, and provider recovery.
- Audited the official SRD 5.2.1 rules and the provider's 2024 source schemas for Fighting Style, Expertise, Weapon Mastery, Ability Score Improvement, and their prerequisites.
- Recorded the hybrid rule-data boundary in ADR-010: provider-owned structured facts plus a narrow, typed, independently versioned Character Forge manifest for missing semantics.
- Added a source-by-source feature-rule inventory with explicit Phase 5, spellcasting, equipment, and feat-effect ownership so dependent choices are locked honestly instead of partially implemented.
- Extended normalized feat details with provider-owned type, minimum-level and named-feature prerequisites, repeatability, and alternative ability-score thresholds.
- Added fail-closed validation for malformed feat prerequisite shapes, impossible counts, duplicate abilities, and canonical level/ability bounds without leaking provider DTOs into frontend contracts.
- Added typed manifest `SRD-5.2.1-CF-1` with independently versioned rules identity and SRD section/page provenance.
- Defined canonical Fighting Style requirements for Fighter, Champion, Paladin, and Ranger, including one supported feat branch and explicitly locked Blessed Warrior/Druidic Warrior cantrip branches.
- Added fail-closed agreement checks between manifest feature ids and normalized class/subclass timelines, plus candidate feat checks against provider-owned type and named-feature prerequisites.
- Added `GET /api/classes/{classId}/feature-choices`, which combines the verified manifest with provider-owned feat ids/names while keeping locked spellcasting branches optionless.
- Extended schema-version-1 drafts compatibly with canonical feature-choice selections and defaulted older stored documents to an empty collection through the existing migration seam.
- Added canonical Fighting Style validation for active class/subclass requirements, supported branches, exact counts, distinct eligible options, and retained-but-invalid choices after a level or subclass change.
- Presented eligible Fighting Style feats in the Class step, persisted only ids/names returned by the hybrid rules endpoint, and kept Blessed Warrior and Druidic Warrior visibly locked behind Phase 6.
- Added focused endpoint, domain-rule, API-adapter, schema-migration, and builder coverage for the first hybrid feature-rule slice.
- Added manifest-backed Expertise requirements for Bard levels 2/9, Ranger levels 2/9, and Rogue levels 1/6 with exact provider feature ids, selection counts, and SRD provenance.
- Allowed one provider feature id to occur at multiple explicitly manifested acquisition levels without weakening fail-closed level agreement.
- Preserved structured skill identity across normalized catalog proficiency grants/options and canonical resolved grants instead of inferring Expertise eligibility from display names.
- Exposed each feature branch's option-source kind and derived canonical Expertise candidates only from the character's resolved skill proficiencies.
- Kept class-wide feature documents character-neutral: provider-owned Fighting Style options remain embedded, while character-specific proficient-skill options are resolved during character evaluation.
- Added canonical cross-requirement Expertise validation so the same resolved skill cannot receive Expertise twice.
- Integrated Expertise into the Proficiencies step after base choices resolve, with exact-count enforcement, canonical id/name persistence, live eligibility updates, and stale-choice removal controls.
- Preserved Expertise selections when a level drop makes them unavailable, surfaced them in review, and routed requirement-specific validation feedback back to Proficiencies.
- Added focused builder coverage for eligible-option derivation, persistence, review, and non-destructive invalidation after a level decrease.
- Reconciled the Phase 5 completion criteria against the supported rule boundary and kept Weapon Mastery and Ability Score Improvement assigned to Phase 7, where their equipment and feat-effect dependencies belong.
- Live-smoke-tested every manifested Fighting Style and Expertise requirement against the current provider and validated a complete level-2 Bard with canonical proficient-skill Expertise selections.
- Closed Phase 5 after the complete build, lint, test, format, dependency-audit, and provider-smoke gate passed.
- Audited spellcasting metadata and every class-level spellcasting row across all twelve live 2024 classes, including preparation-cadence gaps and the Warlock's Pact Magic shape.
- Added an optional provider-neutral spellcasting progression to the class contract with explicit class levels, spell levels, cantrip/prepared capacities, positive slot capacities, and spellcasting ability.
- Added fail-closed checks for incomplete caster tables, missing fields, invalid capacities, and class-detail/level-table disagreement while keeping noncasters explicitly without spellcasting progression.
- Extended the frontend progression schema and recorded the implemented boundary in ADR-011 without treating prose-only preparation, recovery, spellbook, or Mystic Arcanum behavior as canonical.
- Added canonical character-level spellcasting availability that resolves the selected class level into spellcasting ability, cantrip/prepared capacities, and positive spell-slot capacities.
- Kept noncasters and pre-spellcasting levels explicit with no derived spellcasting block, and exposed the trusted result through character validation without adding spell-selection persistence.
- Added canonical Spell Save DC (`8 + ability modifier + proficiency bonus`) and spell attack modifier calculations from the normalized class ability and selected class level.
- Preserved canonical provider ability ids through bounded ability-score resolution, rejected unknown ids at the provider boundary, and presented both spellcasting values in Review.
- Added versioned manifest `SRD-5.2.1-SPELL-1` with SRD provenance for all eight caster preparation sources, cantrip/prepared replacement triggers and limits, slot-pool identity, and base recovery.
- Modeled Warlock Pact Magic as a uniform level 1–5 pool recovered on a Short or Long Rest, with Mystic Arcanum represented separately at class levels 11/13/15/17 for spell levels 6/7/8/9.
- Verified each manifest policy against normalized provider ability and slot facts, exposed the typed policy through class progression, and fail closed on disagreement.
- Live-smoke-tested all twelve class progression endpoints: eight caster policies matched and four noncasters remained explicitly without spellcasting policy.
- Added schema-compatible cantrip and prepared-spell selections to version-1 local drafts, with empty defaults for existing documents.
- Added canonical server validation for exact selected-level counts, distinct ids, class-list membership, spell-level eligibility, and catalog names; invalidated selections remain in the draft for explicit correction.
- Added a seventh builder step that loads every page of the class spell list, persists canonical references, filters prepared options by the current slot level, and routes structured spell violations back to the editable step.
- Kept Wizard selections locked until spellbook ownership exists and rejected retained spell selections for noncasters without silently deleting either case.
- Advanced the spellcasting policy manifest to `SRD-5.2.1-SPELL-2` with Wizard-only initial and per-level spellbook acquisition facts.
- Added backward-compatible spellbook ownership to local drafts and canonical validation for the level-derived minimum, Wizard-list membership, spell level, distinct ids, names, and prepared-spell ownership.
- Unlocked Wizard cantrip, spellbook, and prepared-spell controls in the builder while retaining invalidated selections for explicit correction.
- Advanced the feature-rule manifest to `SRD-5.2.1-CF-2` and unlocked Blessed Warrior/Druidic Warrior through typed Cleric/Druid cantrip sources.
- Resolved canonical level-0 options from provider-filtered class lists and fail closed on insufficient, duplicate, or non-cantrip results.
- Added multi-selection Fighting Style controls for the exact two-cantrip branches and preserved branch identity alongside selected cantrips in review.
- Added pure spell-replacement transition rules for class-level and Long Rest events, counting removed prior selections without treating progression capacity as replacement.
- Added `POST /api/characters/validate-spell-replacement`, which canonically validates both states before enforcing same-character, same-class, level-shape, trigger, and maximum-replacement rules.
- Added a schema-validated frontend adapter for future character lifecycle UI without adding transition history to the creation-draft schema.
- Closed Phase 6 after the complete build, lint, test, format, dependency-audit, provider-smoke, and rule-boundary review passed.
- Audited Phase 7 against SRD 5.2.1 and the live provider, covering all 182 equipment resources, all class/background starting-package trees, all 17 feats, and deferred Weapon Mastery/Ability Score Improvement dependencies.
- Recorded the ownership-first Phase 7 boundary in ADR-017: catalog facts, character ownership/equipped state, feat effects, Weapon Mastery, and attacks advance in dependency order without parsing narrative text.
- Added provider-neutral equipment facts for categories, cost/weight, weapon damage/range/properties/mastery, and armor AC/Dexterity/Strength/Stealth behavior.
- Normalized class and background starting equipment into bounded recursive bundle, item, category, currency, and nested-choice contracts with stable ids and fail-closed unknown-shape handling.
- Extended the frontend catalog schema for the normalized equipment contracts and added focused provider/client coverage for packages, category choices, weapons, armor, and malformed data.
- Added `POST /api/characters/evaluate-feat`, which validates the complete character before evaluating a canonical feat's minimum level, alternative ability thresholds, and named-feature prerequisite.
- Mapped the provider's bounded named prerequisites to stable active progression feature ids and fail closed on unknown names instead of inferring feature ownership from display text.
- Kept prerequisite eligibility distinct from effect support: the typed response and frontend adapter cannot authorize general feat persistence while its state-changing effects remain unmodeled.
- Added backward-compatible equipment ownership to schema-version-1 drafts with canonical item references, quantities, equipped state, and empty defaults for existing local documents.
- Added canonical equipment resolution for stale, renamed, repeated, and missing catalog items plus explicit equipped body-armor and Shield cardinality.
- Derived Armor Class from trusted light/medium/heavy armor Dexterity rules and one Shield bonus, while requiring armor training through resolved stable proficiency ids.
- Recorded the ownership/equipped-state boundary in ADR-018 and live-smoke-tested a valid level-1 Fighter in Chain Mail through complete provider-backed character evaluation.
- Added an eighth, optional Equipment builder step with complete-catalog loading, search, owned quantities, equipped toggles, auto-save, and Review presentation.
- Preserved unavailable saved items visibly until explicit removal and covered canonical persistence, equipped state, and non-destructive stale-item correction in the frontend suite.

## Work in progress

Phase 7 now has its source-backed boundary, normalized equipment catalog foundation, canonical feat-prerequisite evaluation, server-owned inventory/armor evaluation, and builder equipment interaction. Typed feat effects, attacks, and Weapon Mastery selections remain separate increments.

## Next step

Add typed feat effects beginning with Ability Score Improvement before exposing its progression choices.

## Pending decisions

- A project source-code license remains to be selected before public portfolio release.
- Checked-in provider snapshots are not currently justified; small representative inline fixtures cover consumed schema variants. Revisit only if upstream contract testing becomes hard to understand.

## Known issues and limitations

- Strength-minimum speed effects, Stealth disadvantage, weapon attacks, rolled/manual HP, narrative-only class feature choices, import/export, and print functionality are not implemented yet.
- Ritual and concentration are shown on spell detail but are not list filters because the upstream list response omits those fields.
- Some categories do not include narrative descriptions in the upstream 2024 detail response; the UI states that honestly instead of inventing or copying content.
- Cache is process-local and has no stale-on-error persistence after an API restart.
- The external API does not expose an immutable catalog snapshot version in normal responses.
- The hero has been converted to a 140 KB WebP; responsive variants can be considered during the Phase 9 performance audit if measurements justify them.

## Test status

- Frontend lint: passing (`oxlint`, no warnings)
- Frontend unit tests: 94 passing across 13 files (`vitest run`)
- Frontend production build/typecheck: passing (`tsc -b && vite build`)
- Formatting: passing (`prettier --check` and `dotnet format --verify-no-changes`)
- Backend build: passing with 0 warnings and 0 errors
- Backend unit/integration tests: 171 passing
- Live provider smoke checks: classes, class/subclass/spellcasting progression, feature-choice manifests including Blessed Warrior/Druidic Warrior class-cantrip lists, species/trait choices, backgrounds, feats, filtered spells, equipment list/detail, complete character validation including equipped Chain Mail AC, and a valid Bard level-gain spell replacement with Expertise
- Dependency audit: npm and NuGet report no known vulnerabilities
- Existing Phase 1 visual smoke checks: desktop 1440×1000 and mobile 375×812 passed; Phase 2 has responsive CSS and behavior coverage but awaits screenshot-based visual regression tooling in Phase 10

## Last checkpoint

2026-10-09 (America/Sao_Paulo)
