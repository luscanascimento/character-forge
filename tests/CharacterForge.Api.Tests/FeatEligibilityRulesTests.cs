using CharacterForge.Api.Features.Catalog;
using CharacterForge.Api.Features.Characters;

namespace CharacterForge.Api.Tests;

public sealed class FeatEligibilityRulesTests
{
    private static readonly AbilityScores Abilities = new(12, 14, 10, 10, 10, 10);

    [Fact]
    public void Evaluate_AcceptsAlternativeAbilityAndActiveFeaturePrerequisites()
    {
        var feat = Facts(
            minimumLevel: 4,
            requiredFeature: "Fighting Style",
            abilityChoice: new CatalogAbilityScorePrerequisiteChoice(
                1,
                [
                    new(new CatalogReference("str", "STR"), 13),
                    new(new CatalogReference("dex", "DEX"), 13)
                ]));

        var result = FeatEligibilityRules.Evaluate(
            feat,
            4,
            Abilities,
            [new CatalogReference("fighter-fighting-style", "Fighting Style")]);

        Assert.True(result.IsValid);
        Assert.Empty(result.Violations);
    }

    [Fact]
    public void Evaluate_ReportsEveryUnmetPrerequisite()
    {
        var feat = Facts(
            minimumLevel: 8,
            requiredFeature: "Spellcasting",
            abilityChoice: new CatalogAbilityScorePrerequisiteChoice(
                2,
                [
                    new(new CatalogReference("str", "STR"), 13),
                    new(new CatalogReference("dex", "DEX"), 15)
                ]));

        var result = FeatEligibilityRules.Evaluate(feat, 4, Abilities, []);

        Assert.False(result.IsValid);
        Assert.Equal(3, result.Violations.Count);
        Assert.Contains(result.Violations, violation =>
            violation.Code == "character.feat.minimumLevel.unmet");
        Assert.Contains(result.Violations, violation =>
            violation.Code == "character.feat.abilityScore.unmet");
        Assert.Contains(result.Violations, violation =>
            violation.Code == "character.feat.requiredFeature.unmet");
    }

    [Fact]
    public void Evaluate_RequiresAnExactProviderFeatureName()
    {
        var result = FeatEligibilityRules.Evaluate(
            Facts(requiredFeature: "Spellcasting"),
            20,
            Abilities,
            [new CatalogReference("warlock-pact-magic", "Pact Magic")]);

        Assert.Contains(result.Violations, violation =>
            violation.Code == "character.feat.requiredFeature.unmet");
    }

    [Fact]
    public void Evaluate_FailsClosedForAnUnknownNamedFeaturePrerequisite()
    {
        Assert.Throws<FeatEligibilityContentException>(() => FeatEligibilityRules.Evaluate(
            Facts(requiredFeature: "Unknown Feature"),
            20,
            Abilities,
            []));
    }

    private static CatalogFeatFacts Facts(
        int? minimumLevel = null,
        string? requiredFeature = null,
        CatalogAbilityScorePrerequisiteChoice? abilityChoice = null) => new(
        "general",
        minimumLevel,
        requiredFeature,
        IsRepeatable: false,
        abilityChoice);
}
