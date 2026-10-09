using CharacterForge.Api.Features.Catalog;
using CharacterForge.Api.Features.Characters;

namespace CharacterForge.Api.Tests;

public sealed class FeatEffectRulesTests
{
    private static readonly AbilityScores Abilities = new(8, 14, 13, 12, 10, 16);

    [Fact]
    public void ResolveAbilityScoreImprovement_AcceptsOneIncreaseOfTwo()
    {
        var result = FeatEffectRules.ResolveAbilityScoreImprovement(
            Abilities,
            new AbilityScoreImprovementEffect([new("str", 2)]));

        Assert.True(result.Validation.IsValid);
        Assert.Equal(10, result.ResultingAbilities?.Strength);
        Assert.Equal(14, result.ResultingAbilities?.Dexterity);
    }

    [Fact]
    public void ResolveAbilityScoreImprovement_AcceptsTwoDistinctIncreasesOfOne()
    {
        var result = FeatEffectRules.ResolveAbilityScoreImprovement(
            Abilities,
            new AbilityScoreImprovementEffect([new("con", 1), new("int", 1)]));

        Assert.True(result.Validation.IsValid);
        Assert.Equal(14, result.ResultingAbilities?.Constitution);
        Assert.Equal(13, result.ResultingAbilities?.Intelligence);
    }

    [Fact]
    public void ResolveAbilityScoreImprovement_RejectsMissingOrInvalidShapes()
    {
        var missing = FeatEffectRules.ResolveAbilityScoreImprovement(Abilities, null);
        var duplicate = FeatEffectRules.ResolveAbilityScoreImprovement(
            Abilities,
            new AbilityScoreImprovementEffect([new("dex", 1), new("dex", 1)]));
        var unknown = FeatEffectRules.ResolveAbilityScoreImprovement(
            Abilities,
            new AbilityScoreImprovementEffect([new("luck", 2)]));

        Assert.Contains(missing.Validation.Violations, violation =>
            violation.Code == "character.feat.effect.required");
        Assert.Contains(duplicate.Validation.Violations, violation =>
            violation.Code == "character.feat.effect.shape.invalid");
        Assert.Contains(unknown.Validation.Violations, violation =>
            violation.Code == "character.feat.effect.ability.invalid");
        Assert.Null(missing.ResultingAbilities);
        Assert.Null(duplicate.ResultingAbilities);
        Assert.Null(unknown.ResultingAbilities);
    }

    [Fact]
    public void ResolveAbilityScoreImprovement_EnforcesTheFeatMaximumOfTwenty()
    {
        var result = FeatEffectRules.ResolveAbilityScoreImprovement(
            Abilities with { Charisma = 19 },
            new AbilityScoreImprovementEffect([new("cha", 2)]));

        Assert.Contains(result.Validation.Violations, violation =>
            violation.Code == "character.feat.effect.ability.maximum");
        Assert.Null(result.ResultingAbilities);
    }

    [Fact]
    public void Manifest_VerifiesOnlyTheCanonicalAbilityScoreImprovementFacts()
    {
        var valid = AbilityScoreImprovement();
        var changed = valid with
        {
            Feat = valid.Feat! with { IsRepeatable = false }
        };

        FeatEffectManifest.Verify(valid);

        Assert.Equal("SRD-5.2.1-FEAT-1", FeatEffectManifest.Version);
        Assert.Equal(86, FeatEffectManifest.SourcePage);
        Assert.True(FeatEffectManifest.Supports("ability-score-improvement"));
        Assert.False(FeatEffectManifest.Supports("grappler"));
        Assert.Throws<FeatEffectContentException>(() => FeatEffectManifest.Verify(changed));
    }

    private static CatalogItemDetail AbilityScoreImprovement() => new(
        "ability-score-improvement",
        "Ability Score Improvement",
        "feats",
        [],
        [],
        [],
        Feat: new CatalogFeatFacts(
            "general",
            MinimumLevel: 4,
            RequiredFeature: null,
            IsRepeatable: true,
            AbilityScorePrerequisite: null));
}
