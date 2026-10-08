namespace CharacterForge.Api.Features.Spellcasting;

public sealed record SpellReplacementPolicyDocument(
    string Trigger,
    int? MaximumReplacements);

public sealed record SpecialSpellAccessDocument(
    int AvailableAtClassLevel,
    int SpellLevel,
    int Uses,
    string Recovery,
    string ReplacementTrigger,
    bool RequiresSameSpellLevel);

public sealed record SpellbookOwnershipDocument(
    int InitialSpells,
    int SpellsPerAdditionalClassLevel);

public sealed record SpellcastingPolicyDocument(
    string ManifestVersion,
    string PreparedSpellSource,
    SpellReplacementPolicyDocument? CantripReplacement,
    SpellReplacementPolicyDocument PreparedSpellReplacement,
    string SlotPool,
    string BaseSlotRecovery,
    bool UsesUniformSlotLevel,
    int MaximumSlotLevel,
    IReadOnlyList<SpecialSpellAccessDocument> SpecialSpellAccess,
    SpellbookOwnershipDocument? Spellbook = null);
