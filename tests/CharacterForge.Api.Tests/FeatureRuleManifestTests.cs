using CharacterForge.Api.Features.Catalog;
using CharacterForge.Api.Features.FeatureRules;
using CharacterForge.Api.Features.Progression;

namespace CharacterForge.Api.Tests;

public sealed class FeatureRuleManifestTests
{
    [Fact]
    public void Manifest_HasIndependentRulesIdentity()
    {
        Assert.Equal("SRD-5.2.1-CF-1", FeatureRuleManifest.Version);
        Assert.Equal("2024", FeatureRuleManifest.Ruleset);
        Assert.Equal("SRD-5.2.1", FeatureRuleManifest.RulesVersion);
    }

    [Fact]
    public void Manifest_DefinesEverySrdFightingStyleRequirement()
    {
        Assert.Collection(
            FeatureRuleManifest.Requirements,
            requirement => AssertRequirement(
                requirement,
                "fighter-fighting-style",
                "fighter",
                subclassId: null,
                level: 1,
                page: 47),
            requirement => AssertRequirement(
                requirement,
                "champion-additional-fighting-style",
                "fighter",
                subclassId: "champion",
                level: 7,
                page: 49),
            requirement => AssertRequirement(
                requirement,
                "paladin-fighting-style",
                "paladin",
                subclassId: null,
                level: 2,
                page: 54),
            requirement => AssertRequirement(
                requirement,
                "ranger-fighting-style",
                "ranger",
                subclassId: null,
                level: 2,
                page: 59));
    }

    [Fact]
    public void Manifest_KeepsSpellGrantingAlternativesLockedBehindSpellcasting()
    {
        var alternatives = FeatureRuleManifest.Requirements
            .SelectMany(requirement => requirement.Branches)
            .Where(branch => branch.OptionSource.Kind == FeatureOptionSourceKind.ClassCantrips)
            .ToArray();

        Assert.Equal(["blessed-warrior", "druidic-warrior"], alternatives.Select(branch => branch.Id));
        Assert.All(alternatives, branch =>
        {
            Assert.Equal(2, branch.SelectionCount);
            Assert.Equal(FeatureChoiceAvailability.Locked, branch.Availability);
            Assert.Equal(FeatureRuleDependency.Spellcasting, branch.Dependency);
        });
        Assert.Equal(["cleric", "druid"], alternatives.Select(branch => branch.OptionSource.Filter));
    }

    [Fact]
    public void GetVerifiedRequirements_AcceptsMatchingClassAndSubclassFeatures()
    {
        var requirements = FeatureRuleManifest.GetVerifiedRequirements(FighterProgression());

        Assert.Equal(
            ["fighter-fighting-style", "champion-additional-fighting-style"],
            requirements.Select(requirement => requirement.Id));
    }

    [Fact]
    public void GetVerifiedRequirements_RejectsAMissingProviderFeature()
    {
        var progression = FighterProgression() with
        {
            Levels = Levels((1, "second-wind"))
        };

        Assert.Throws<FeatureRuleContentException>(() =>
            FeatureRuleManifest.GetVerifiedRequirements(progression));
    }

    [Fact]
    public void GetVerifiedRequirements_RejectsAnotherRulesVersion()
    {
        var progression = FighterProgression() with
        {
            Source = new CatalogSource(
                "Test provider",
                "2014",
                "SRD-5.1",
                DateTimeOffset.UnixEpoch)
        };

        Assert.Throws<FeatureRuleContentException>(() =>
            FeatureRuleManifest.GetVerifiedRequirements(progression));
    }

    [Fact]
    public void VerifyFeatOption_AcceptsProviderFactsMatchingTheManifestBranch()
    {
        var branch = FeatureRuleManifest.Requirements[0].Branches[0];
        var feat = FightingStyleFeat("archery", "fighting-style", "Fighting Style");

        FeatureRuleManifest.VerifyFeatOption(branch, feat);
    }

    [Theory]
    [InlineData("general", "Fighting Style")]
    [InlineData("fighting-style", "Another Feature")]
    public void VerifyFeatOption_RejectsProviderFactsThatDisagreeWithTheManifest(
        string type,
        string requiredFeature)
    {
        var branch = FeatureRuleManifest.Requirements[0].Branches[0];
        var feat = FightingStyleFeat("invalid", type, requiredFeature);

        Assert.Throws<FeatureRuleContentException>(() =>
            FeatureRuleManifest.VerifyFeatOption(branch, feat));
    }

    private static void AssertRequirement(
        FeatureChoiceRequirement requirement,
        string id,
        string classId,
        string? subclassId,
        int level,
        int page)
    {
        Assert.Equal(id, requirement.Id);
        Assert.Equal(id, requirement.FeatureId);
        Assert.Equal(classId, requirement.ClassId);
        Assert.Equal(subclassId, requirement.SubclassId);
        Assert.Equal(level, requirement.AvailableAtLevel);
        Assert.Equal(1, requirement.Count);
        Assert.Equal(page, requirement.Provenance.Page);
        Assert.Equal("System Reference Document 5.2.1", requirement.Provenance.Document);

        var featBranch = requirement.Branches[0];
        Assert.Equal("fighting-style-feat", featBranch.Id);
        Assert.Equal(1, featBranch.SelectionCount);
        Assert.Equal(FeatureChoiceAvailability.Supported, featBranch.Availability);
        Assert.Null(featBranch.Dependency);
        Assert.Equal(FeatureOptionSourceKind.FeatType, featBranch.OptionSource.Kind);
        Assert.Equal("fighting-style", featBranch.OptionSource.Filter);
        Assert.Equal("Fighting Style", featBranch.OptionSource.RequiredFeature);
    }

    private static ClassProgressionDocument FighterProgression() => new(
        new CatalogReference("fighter", "Fighter"),
        HitDie: 10,
        Levels((1, "fighter-fighting-style")),
        [
            new SubclassProgression(
                new CatalogReference("champion", "Champion"),
                AvailableAtLevel: 3,
                [
                    new SubclassLevelProgression(3, []),
                    new SubclassLevelProgression(
                        7,
                        [new CatalogReference("champion-additional-fighting-style", "Additional Fighting Style")])
                ])
        ]);

    private static IReadOnlyList<ClassLevelProgression> Levels(
        params (int Level, string FeatureId)[] features) => Enumerable.Range(1, 20)
        .Select(level => new ClassLevelProgression(
            level,
            2 + ((level - 1) / 4),
            features
                .Where(feature => feature.Level == level)
                .Select(feature => new CatalogReference(feature.FeatureId, feature.FeatureId))
                .ToArray()))
        .ToArray();

    private static CatalogItemDetail FightingStyleFeat(
        string id,
        string type,
        string requiredFeature) => new(
        id,
        id,
        CatalogCategory.Feats.ToSlug(),
        [],
        [],
        [],
        Feat: new CatalogFeatFacts(
            type,
            MinimumLevel: null,
            requiredFeature,
            IsRepeatable: false,
            AbilityScorePrerequisite: null));
}
