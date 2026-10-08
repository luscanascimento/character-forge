using System.Collections.ObjectModel;
using CharacterForge.Api.Features.Characters;
using CharacterForge.Api.Features.Progression;

namespace CharacterForge.Api.Features.Spellcasting;

public enum PreparedSpellSource
{
    ClassSpellList,
    Spellbook
}

public enum SpellReplacementTrigger
{
    ClassLevelGained,
    LongRest
}

public enum SpellSlotPool
{
    Standard,
    PactMagic
}

public enum SpellRecoveryTrigger
{
    LongRest,
    ShortOrLongRest
}

public sealed record SpellReplacementPolicy(
    SpellReplacementTrigger Trigger,
    int? MaximumReplacements);

public sealed record SpecialSpellAccess(
    int AvailableAtClassLevel,
    int SpellLevel,
    int Uses,
    SpellRecoveryTrigger Recovery,
    SpellReplacementTrigger ReplacementTrigger,
    bool RequiresSameSpellLevel);

public sealed record SpellcastingRuleProvenance(
    string Document,
    string Section,
    int Page,
    string Url);

public sealed record ClassSpellcastingPolicy(
    string ClassId,
    string AbilityId,
    PreparedSpellSource PreparedSpellSource,
    SpellReplacementPolicy? CantripReplacement,
    SpellReplacementPolicy PreparedSpellReplacement,
    SpellSlotPool SlotPool,
    SpellRecoveryTrigger BaseSlotRecovery,
    bool UsesUniformSlotLevel,
    int MaximumSlotLevel,
    IReadOnlyList<SpecialSpellAccess> SpecialSpellAccess,
    IReadOnlyList<SpellcastingRuleProvenance> Provenance);

public sealed class SpellcastingRuleContentException(string message) : Exception(message);

public static class SpellcastingRuleManifest
{
    public const string Version = "SRD-5.2.1-SPELL-1";
    public const string Ruleset = CharacterRules.Ruleset;
    public const string RulesVersion = CharacterRules.RulesVersion;

    private const string SourceDocument = "System Reference Document 5.2.1";
    private const string SourceUrl = "https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf";

    private static readonly SpellReplacementPolicy OneAtClassLevel = new(
        SpellReplacementTrigger.ClassLevelGained,
        MaximumReplacements: 1);
    private static readonly SpellReplacementPolicy OneAtLongRest = new(
        SpellReplacementTrigger.LongRest,
        MaximumReplacements: 1);
    private static readonly SpellReplacementPolicy AnyAtLongRest = new(
        SpellReplacementTrigger.LongRest,
        MaximumReplacements: null);

    private static readonly ReadOnlyCollection<ClassSpellcastingPolicy> Entries = Array.AsReadOnly([
        Standard("bard", "cha", PreparedSpellSource.ClassSpellList, OneAtClassLevel, OneAtClassLevel, 9, 32),
        Standard("cleric", "wis", PreparedSpellSource.ClassSpellList, OneAtClassLevel, AnyAtLongRest, 9, 36, 37),
        Standard("druid", "wis", PreparedSpellSource.ClassSpellList, OneAtClassLevel, AnyAtLongRest, 9, 42),
        Standard("paladin", "cha", PreparedSpellSource.ClassSpellList, null, OneAtLongRest, 5, 54),
        Standard("ranger", "wis", PreparedSpellSource.ClassSpellList, null, OneAtLongRest, 5, 58),
        Standard("sorcerer", "cha", PreparedSpellSource.ClassSpellList, OneAtClassLevel, OneAtClassLevel, 9, 64, 65),
        PactMagic(),
        Standard("wizard", "int", PreparedSpellSource.Spellbook, OneAtLongRest, AnyAtLongRest, 9, 77, 78)
    ]);

    static SpellcastingRuleManifest() => ValidateManifest();

    public static IReadOnlyList<ClassSpellcastingPolicy> Policies => Entries;

    public static SpellcastingPolicyDocument? GetVerifiedPolicy(
        ClassProgressionDocument progression)
    {
        ArgumentNullException.ThrowIfNull(progression);

        if (progression.Source is not null &&
            (!string.Equals(progression.Source.Ruleset, Ruleset, StringComparison.Ordinal) ||
             !string.Equals(progression.Source.RulesVersion, RulesVersion, StringComparison.Ordinal)))
        {
            throw new SpellcastingRuleContentException(
                $"Progression content does not match spellcasting manifest '{Version}'.");
        }

        var entry = Entries.SingleOrDefault(entry => string.Equals(
            entry.ClassId,
            progression.Class.Id,
            StringComparison.OrdinalIgnoreCase));

        if (progression.Spellcasting is null)
        {
            if (entry is not null)
            {
                throw Mismatch(progression.Class.Id);
            }

            return null;
        }

        if (entry is null ||
            !string.Equals(
                entry.AbilityId,
                progression.Spellcasting.Ability.Id,
                StringComparison.OrdinalIgnoreCase) ||
            progression.Spellcasting.Levels.Count == 0 ||
            progression.Spellcasting.Levels.Any(level => level.PreparedSpells <= 0) ||
            (entry.CantripReplacement is null) != progression.Spellcasting.Levels.All(level => level.CantripsKnown == 0))
        {
            throw Mismatch(progression.Class.Id);
        }

        var slots = progression.Spellcasting.Levels.SelectMany(level => level.Slots).ToArray();
        if (slots.Length == 0 || slots.Any(slot => slot.SpellLevel > entry.MaximumSlotLevel) ||
            (entry.UsesUniformSlotLevel && progression.Spellcasting.Levels.Any(level => level.Slots.Count != 1)))
        {
            throw Mismatch(progression.Class.Id);
        }

        return Document(entry);
    }

    private static ClassSpellcastingPolicy Standard(
        string classId,
        string abilityId,
        PreparedSpellSource source,
        SpellReplacementPolicy? cantripReplacement,
        SpellReplacementPolicy preparedReplacement,
        int maximumSlotLevel,
        params int[] pages) => new(
            classId,
            abilityId,
            source,
            cantripReplacement,
            preparedReplacement,
            SpellSlotPool.Standard,
            SpellRecoveryTrigger.LongRest,
            UsesUniformSlotLevel: false,
            maximumSlotLevel,
            [],
            Provenance(classId, pages));

    private static ClassSpellcastingPolicy PactMagic() => new(
        "warlock",
        "cha",
        PreparedSpellSource.ClassSpellList,
        OneAtClassLevel,
        OneAtClassLevel,
        SpellSlotPool.PactMagic,
        SpellRecoveryTrigger.ShortOrLongRest,
        UsesUniformSlotLevel: true,
        MaximumSlotLevel: 5,
        [
            Arcanum(11, 6),
            Arcanum(13, 7),
            Arcanum(15, 8),
            Arcanum(17, 9)
        ],
        Provenance("warlock", 71, 72));

    private static SpecialSpellAccess Arcanum(int classLevel, int spellLevel) => new(
        classLevel,
        spellLevel,
        Uses: 1,
        SpellRecoveryTrigger.LongRest,
        SpellReplacementTrigger.ClassLevelGained,
        RequiresSameSpellLevel: true);

    private static IReadOnlyList<SpellcastingRuleProvenance> Provenance(
        string classId,
        params int[] pages) => pages.Select(page => new SpellcastingRuleProvenance(
            SourceDocument,
            $"{Title(classId)} — Level 1: Spellcasting",
            page,
            SourceUrl)).ToArray();

    private static SpellcastingPolicyDocument Document(ClassSpellcastingPolicy entry) => new(
        Version,
        Identifier(entry.PreparedSpellSource),
        entry.CantripReplacement is null ? null : Document(entry.CantripReplacement),
        Document(entry.PreparedSpellReplacement),
        Identifier(entry.SlotPool),
        Identifier(entry.BaseSlotRecovery),
        entry.UsesUniformSlotLevel,
        entry.MaximumSlotLevel,
        entry.SpecialSpellAccess.Select(access => new SpecialSpellAccessDocument(
            access.AvailableAtClassLevel,
            access.SpellLevel,
            access.Uses,
            Identifier(access.Recovery),
            Identifier(access.ReplacementTrigger),
            access.RequiresSameSpellLevel)).ToArray());

    private static SpellReplacementPolicyDocument Document(SpellReplacementPolicy policy) => new(
        Identifier(policy.Trigger),
        policy.MaximumReplacements);

    private static void ValidateManifest()
    {
        if (Entries.Count != 8 ||
            Entries.Select(entry => entry.ClassId).Distinct(StringComparer.Ordinal).Count() != Entries.Count ||
            Entries.Any(entry =>
                !AbilityRules.IsSupportedId(entry.AbilityId) ||
                entry.MaximumSlotLevel is < 1 or > 9 ||
                entry.Provenance.Count == 0 ||
                entry.Provenance.Any(source => source.Page <= 0) ||
                entry.PreparedSpellReplacement.MaximumReplacements is <= 0 ||
                entry.CantripReplacement?.MaximumReplacements is <= 0) ||
            Entries.Count(entry => entry.SlotPool == SpellSlotPool.PactMagic) != 1)
        {
            throw new InvalidOperationException(
                $"Spellcasting manifest '{Version}' contains an invalid entry.");
        }

        var pactMagic = Entries.Single(entry => entry.SlotPool == SpellSlotPool.PactMagic);
        if (pactMagic.ClassId != "warlock" ||
            !pactMagic.UsesUniformSlotLevel ||
            pactMagic.BaseSlotRecovery != SpellRecoveryTrigger.ShortOrLongRest ||
            pactMagic.SpecialSpellAccess.Count != 4 ||
            pactMagic.SpecialSpellAccess.Select(access => access.SpellLevel).Distinct().Count() != 4)
        {
            throw new InvalidOperationException(
                $"Spellcasting manifest '{Version}' contains an invalid Pact Magic entry.");
        }
    }

    private static SpellcastingRuleContentException Mismatch(string classId) => new(
        $"Class '{classId}' does not match spellcasting manifest '{Version}'.");

    private static string Identifier<T>(T value) where T : struct, Enum
    {
        var name = value.ToString();
        return char.ToLowerInvariant(name[0]) + name[1..];
    }

    private static string Title(string value) =>
        char.ToUpperInvariant(value[0]) + value[1..];
}
