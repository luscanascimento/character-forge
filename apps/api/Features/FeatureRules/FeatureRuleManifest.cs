using System.Collections.ObjectModel;
using CharacterForge.Api.Features.Catalog;
using CharacterForge.Api.Features.Characters;
using CharacterForge.Api.Features.Progression;

namespace CharacterForge.Api.Features.FeatureRules;

public static class FeatureRuleManifest
{
    public const string Version = "SRD-5.2.1-CF-1";
    public const string Ruleset = CharacterRules.Ruleset;
    public const string RulesVersion = CharacterRules.RulesVersion;

    private const string SourceDocument = "System Reference Document 5.2.1";
    private const string SourceUrl = "https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf";

    private static readonly ReadOnlyCollection<FeatureChoiceRequirement> Entries = Array.AsReadOnly([
        FightingStyle(
            id: "fighter-fighting-style",
            classId: "fighter",
            featureId: "fighter-fighting-style",
            level: 1,
            section: "Fighter — Level 1: Fighting Style",
            page: 47),
        FightingStyle(
            id: "champion-additional-fighting-style",
            classId: "fighter",
            subclassId: "champion",
            featureId: "champion-additional-fighting-style",
            level: 7,
            section: "Champion — Level 7: Additional Fighting Style",
            page: 49),
        FightingStyle(
            id: "paladin-fighting-style",
            classId: "paladin",
            featureId: "paladin-fighting-style",
            level: 2,
            section: "Paladin — Level 2: Fighting Style",
            page: 54,
            alternative: LockedCantripBranch("blessed-warrior", "cleric")),
        FightingStyle(
            id: "ranger-fighting-style",
            classId: "ranger",
            featureId: "ranger-fighting-style",
            level: 2,
            section: "Ranger — Level 2: Fighting Style",
            page: 59,
            alternative: LockedCantripBranch("druidic-warrior", "druid"))
    ]);

    static FeatureRuleManifest() => ValidateManifest();

    public static IReadOnlyList<FeatureChoiceRequirement> Requirements => Entries;

    public static IReadOnlyList<FeatureChoiceRequirement> GetVerifiedRequirements(
        ClassProgressionDocument progression)
    {
        ArgumentNullException.ThrowIfNull(progression);

        if (progression.Source is not null
            && (!string.Equals(progression.Source.Ruleset, Ruleset, StringComparison.Ordinal)
                || !string.Equals(progression.Source.RulesVersion, RulesVersion, StringComparison.Ordinal)))
        {
            throw new FeatureRuleContentException(
                $"Progression content does not match the rules identity for manifest '{Version}'.");
        }

        var requirements = Entries
            .Where(requirement => string.Equals(
                requirement.ClassId,
                progression.Class.Id,
                StringComparison.OrdinalIgnoreCase))
            .ToArray();

        foreach (var requirement in requirements)
        {
            VerifyFeatureOccurrence(progression, requirement);
        }

        return Array.AsReadOnly(requirements);
    }

    public static void VerifyFeatOption(
        FeatureChoiceBranch branch,
        CatalogItemDetail feat)
    {
        ArgumentNullException.ThrowIfNull(branch);
        ArgumentNullException.ThrowIfNull(feat);

        if (branch.OptionSource.Kind != FeatureOptionSourceKind.FeatType
            || !string.Equals(feat.Category, CatalogCategory.Feats.ToSlug(), StringComparison.Ordinal)
            || feat.Feat is null
            || !string.Equals(feat.Feat.Type, branch.OptionSource.Filter, StringComparison.Ordinal)
            || !string.Equals(
                feat.Feat.RequiredFeature,
                branch.OptionSource.RequiredFeature,
                StringComparison.Ordinal))
        {
            throw new FeatureRuleContentException(
                $"Feat '{feat.Id}' does not match feature-rule branch '{branch.Id}' in manifest '{Version}'.");
        }
    }

    private static FeatureChoiceRequirement FightingStyle(
        string id,
        string classId,
        string featureId,
        int level,
        string section,
        int page,
        string? subclassId = null,
        FeatureChoiceBranch? alternative = null)
    {
        var branches = new List<FeatureChoiceBranch>
        {
            new(
                "fighting-style-feat",
                SelectionCount: 1,
                new FeatureOptionSource(
                    FeatureOptionSourceKind.FeatType,
                    "fighting-style",
                    RequiredFeature: "Fighting Style"),
                FeatureChoiceAvailability.Supported)
        };

        if (alternative is not null)
        {
            branches.Add(alternative);
        }

        return new FeatureChoiceRequirement(
            id,
            classId,
            subclassId,
            featureId,
            level,
            Count: 1,
            Array.AsReadOnly(branches.ToArray()),
            new FeatureRuleProvenance(SourceDocument, section, page, SourceUrl));
    }

    private static FeatureChoiceBranch LockedCantripBranch(string id, string spellClassId) => new(
        id,
        SelectionCount: 2,
        new FeatureOptionSource(FeatureOptionSourceKind.ClassCantrips, spellClassId),
        FeatureChoiceAvailability.Locked,
        FeatureRuleDependency.Spellcasting);

    private static void VerifyFeatureOccurrence(
        ClassProgressionDocument progression,
        FeatureChoiceRequirement requirement)
    {
        IEnumerable<(int Level, IReadOnlyList<CatalogReference> Features)> levels;
        if (requirement.SubclassId is null)
        {
            levels = progression.Levels.Select(level => (level.Level, level.Features));
        }
        else
        {
            var subclasses = progression.Subclasses
                .Where(subclass => string.Equals(
                    subclass.Subclass.Id,
                    requirement.SubclassId,
                    StringComparison.OrdinalIgnoreCase))
                .ToArray();
            if (subclasses.Length != 1)
            {
                throw Mismatch(requirement);
            }

            levels = subclasses[0].Levels.Select(level => (level.Level, level.Features));
        }

        var occurrences = levels
            .SelectMany(level => level.Features.Select(feature => (level.Level, Feature: feature)))
            .Where(entry => string.Equals(
                entry.Feature.Id,
                requirement.FeatureId,
                StringComparison.OrdinalIgnoreCase))
            .ToArray();

        if (occurrences.Length != 1 || occurrences[0].Level != requirement.AvailableAtLevel)
        {
            throw Mismatch(requirement);
        }
    }

    private static FeatureRuleContentException Mismatch(FeatureChoiceRequirement requirement) => new(
        $"Progression content does not match feature rule '{requirement.Id}' in manifest '{Version}'.");

    private static void ValidateManifest()
    {
        if (Entries.Select(entry => entry.Id).Distinct(StringComparer.Ordinal).Count() != Entries.Count)
        {
            throw new InvalidOperationException($"Feature rule manifest '{Version}' contains duplicate requirement ids.");
        }

        foreach (var requirement in Entries)
        {
            if (requirement.AvailableAtLevel is < CharacterRules.MinimumLevel or > CharacterRules.MaximumLevel
                || requirement.Count < 1
                || requirement.Branches.Count < requirement.Count
                || requirement.Provenance.Page < 1
                || requirement.Branches.Select(branch => branch.Id).Distinct(StringComparer.Ordinal).Count()
                    != requirement.Branches.Count)
            {
                throw new InvalidOperationException($"Feature rule manifest '{Version}' contains an invalid requirement.");
            }

            foreach (var branch in requirement.Branches)
            {
                var hasValidAvailability = branch.Availability switch
                {
                    FeatureChoiceAvailability.Supported => branch.Dependency is null,
                    FeatureChoiceAvailability.Locked => branch.Dependency is not null,
                    _ => false
                };
                if (branch.SelectionCount < 1
                    || string.IsNullOrWhiteSpace(branch.OptionSource.Filter)
                    || !hasValidAvailability)
                {
                    throw new InvalidOperationException($"Feature rule manifest '{Version}' contains an invalid branch.");
                }
            }
        }
    }
}
