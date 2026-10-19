using CharacterForge.Api.Features.Characters;

namespace CharacterForge.Api.Tests;

public sealed class FightingStyleEffectRulesTests
{
    [Fact]
    public void Resolve_ActivatesArcheryAndDefenseFromCanonicalFeatChoices()
    {
        var result = FightingStyleEffectRules.Resolve([
            Choice("fighter-fighting-style", "archery", "Archery"),
            Choice("champion-additional-fighting-style", "defense", "Defense")
        ]);

        Assert.True(result.Validation.IsValid);
        Assert.True(result.HasArchery);
        Assert.True(result.HasDefense);
    }

    [Fact]
    public void Resolve_RejectsARepeatedFightingStyleFeat()
    {
        var result = FightingStyleEffectRules.Resolve([
            Choice("fighter-fighting-style", "archery", "Archery"),
            Choice("champion-additional-fighting-style", "archery", "Archery")
        ]);

        Assert.Contains(result.Validation.Violations, violation =>
            violation.Code == "character.fightingStyle.duplicate");
    }

    [Fact]
    public void Resolve_IgnoresCantripAndExpertiseBranches()
    {
        var result = FightingStyleEffectRules.Resolve([
            new FeatureChoiceSelection(
                "paladin-fighting-style",
                "blessed-warrior",
                [new ContentReference("guidance", "Guidance")]),
            new FeatureChoiceSelection(
                "bard-expertise-2",
                "expertise-skills",
                [new ContentReference("skill-archery", "Skill: Archery")])
        ]);

        Assert.True(result.Validation.IsValid);
        Assert.False(result.HasArchery);
        Assert.False(result.HasDefense);
    }

    private static FeatureChoiceSelection Choice(
        string requirementId,
        string featId,
        string featName) => new(
        requirementId,
        "fighting-style-feat",
        [new ContentReference(featId, featName)]);
}
