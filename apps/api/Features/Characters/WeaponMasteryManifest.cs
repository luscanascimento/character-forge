using System.Collections.ObjectModel;
using CharacterForge.Api.Features.Progression;

namespace CharacterForge.Api.Features.Characters;

public sealed record WeaponMasteryManifestEntry(
    string ClassId,
    string FeatureId,
    IReadOnlyList<int> Capacities,
    bool RequiresProviderCapacities,
    string SourceSection,
    int SourcePage);

public static class WeaponMasteryManifest
{
    public const string Version = "SRD-5.2.1-WM-1";
    public const string SourceDocument = "System Reference Document 5.2.1";
    public const string SourceUrl =
        "https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf";

    private static readonly ReadOnlyCollection<WeaponMasteryManifestEntry> Entries =
        Array.AsReadOnly([
            Entry("barbarian", "barbarian-weapon-mastery", [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4], true, "Barbarian — Level 1: Weapon Mastery", 30),
            Entry("fighter", "fighter-weapon-mastery", [3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6], true, "Fighter — Level 1: Weapon Mastery", 47),
            Entry("paladin", "paladin-weapon-mastery", Repeated(2), false, "Paladin — Level 1: Weapon Mastery", 54),
            Entry("ranger", "ranger-weapon-mastery", Repeated(2), false, "Ranger — Level 1: Weapon Mastery", 59),
            Entry("rogue", "rogue-weapon-mastery", Repeated(2), false, "Rogue — Level 1: Weapon Mastery", 61)
        ]);

    private static readonly IReadOnlyDictionary<string, string> SpecificProficiencyWeapons =
        new ReadOnlyDictionary<string, string>(new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["longswords"] = "longsword",
            ["rapiers"] = "rapier",
            ["scimitars"] = "scimitar",
            ["shortswords"] = "shortsword",
            ["whips"] = "whip",
            ["hand-crossbows"] = "hand-crossbow"
        });

    public static WeaponMasteryRule? Resolve(
        ClassProgressionDocument progression,
        int classLevel)
    {
        ArgumentNullException.ThrowIfNull(progression);

        var document = GetVerifiedProgression(progression);
        if (document is null)
        {
            return null;
        }

        if (classLevel is < CharacterRules.MinimumLevel or > CharacterRules.MaximumLevel)
        {
            throw new ArgumentOutOfRangeException(nameof(classLevel));
        }

        return new WeaponMasteryRule(
            document.Levels.Single(level => level.ClassLevel == classLevel).Capacity,
            document.ManifestVersion,
            document.SpecificProficiencyWeapons);
    }

    public static ClassWeaponMasteryProgression? GetVerifiedProgression(
        ClassProgressionDocument progression)
    {
        ArgumentNullException.ThrowIfNull(progression);

        var entry = Entries.SingleOrDefault(candidate => string.Equals(
            candidate.ClassId,
            progression.Class.Id,
            StringComparison.OrdinalIgnoreCase));
        if (entry is null)
        {
            if (progression.Levels.Any(level => level.WeaponMasteryCapacity is not null))
            {
                throw new WeaponMasteryContentException(
                    $"Class '{progression.Class.Id}' exposes an unsupported Weapon Mastery capacity.");
            }

            return null;
        }

        Verify(progression, entry);
        return new ClassWeaponMasteryProgression(
            Version,
            CharacterRules.MinimumLevel,
            entry.Capacities
                .Select((capacity, index) => new ClassWeaponMasteryLevel(index + 1, capacity))
                .ToArray(),
            SpecificProficiencyWeapons);
    }

    private static void Verify(
        ClassProgressionDocument progression,
        WeaponMasteryManifestEntry entry)
    {
        var occurrences = progression.Levels
            .Where(level => level.Features.Any(feature => string.Equals(
                feature.Id,
                entry.FeatureId,
                StringComparison.OrdinalIgnoreCase)))
            .Select(level => level.Level)
            .ToArray();
        if (!occurrences.SequenceEqual([1]))
        {
            throw new WeaponMasteryContentException(
                $"Class '{entry.ClassId}' does not match the Weapon Mastery feature occurrence in manifest '{Version}'.");
        }

        var providerCapacities = progression.Levels
            .Select(level => level.WeaponMasteryCapacity)
            .ToArray();
        var suppliesCapacities = providerCapacities.Any(capacity => capacity is not null);
        if (entry.RequiresProviderCapacities && !suppliesCapacities ||
            suppliesCapacities && providerCapacities
            .Select(capacity => capacity ?? -1)
            .SequenceEqual(entry.Capacities) is false)
        {
            throw new WeaponMasteryContentException(
                $"Class '{entry.ClassId}' does not match the Weapon Mastery capacities in manifest '{Version}'.");
        }
    }

    private static WeaponMasteryManifestEntry Entry(
        string classId,
        string featureId,
        IReadOnlyList<int> capacities,
        bool requiresProviderCapacities,
        string sourceSection,
        int sourcePage) => new(
        classId,
        featureId,
        capacities,
        requiresProviderCapacities,
        sourceSection,
        sourcePage);

    private static IReadOnlyList<int> Repeated(int capacity) =>
        Enumerable.Repeat(capacity, CharacterRules.MaximumLevel).ToArray();
}

public sealed class WeaponMasteryContentException(string message) : Exception(message);
