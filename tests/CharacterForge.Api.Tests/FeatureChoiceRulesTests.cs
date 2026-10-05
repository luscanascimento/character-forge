using CharacterForge.Api.Features.Characters;

namespace CharacterForge.Api.Tests;

public sealed class FeatureChoiceRulesTests
{
    private static readonly ContentReference Archery = new("archery", "Archery");
    private static readonly FeatureChoiceRequirementRule FighterStyle = new(
        "fighter-fighting-style",
        SubclassId: null,
        AvailableAtLevel: 1,
        Count: 1,
        [new FeatureChoiceBranchRule("fighting-style-feat", 1, true, [Archery])]);

    [Fact]
    public void Validate_AcceptsCanonicalSupportedFeatChoice()
    {
        var result = FeatureChoiceRules.Validate(
            [new FeatureChoiceSelection("fighter-fighting-style", "fighting-style-feat", [Archery])],
            [FighterStyle],
            Progression("fighter", 1));

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Validate_RequiresEveryActiveFeatureChoice()
    {
        var result = FeatureChoiceRules.Validate([], [FighterStyle], Progression("fighter", 1));

        Assert.Contains(result.Violations, violation =>
            violation.Code == "character.featureChoice.count" &&
            violation.Source == "featureChoices.fighter-fighting-style");
    }

    [Fact]
    public void Validate_RejectsLockedAndUnknownOptions()
    {
        var rules = new[]
        {
            FighterStyle with
            {
                Branches =
                [
                    .. FighterStyle.Branches,
                    new FeatureChoiceBranchRule("blessed-warrior", 2, false, [])
                ]
            }
        };

        var locked = FeatureChoiceRules.Validate(
            [new FeatureChoiceSelection("fighter-fighting-style", "blessed-warrior", [Archery])],
            rules,
            Progression("fighter", 1));
        var unknown = FeatureChoiceRules.Validate(
            [new FeatureChoiceSelection(
                "fighter-fighting-style",
                "fighting-style-feat",
                [new ContentReference("invalid", "Invalid")])],
            rules,
            Progression("fighter", 1));

        Assert.Contains(locked.Violations, violation =>
            violation.Code == "character.featureChoice.branch.locked");
        Assert.Contains(unknown.Violations, violation =>
            violation.Code == "character.featureChoice.selection.invalid");
    }

    [Fact]
    public void Validate_RetainsButInvalidatesChoiceAfterLevelDecrease()
    {
        var levelTwoRule = FighterStyle with { AvailableAtLevel = 2 };
        var selection = new FeatureChoiceSelection(
            levelTwoRule.Id,
            "fighting-style-feat",
            [Archery]);

        var result = FeatureChoiceRules.Validate(
            [selection],
            [levelTwoRule],
            Progression("paladin", 1));

        Assert.Contains(result.Violations, violation =>
            violation.Code == "character.featureChoice.unavailable");
        Assert.Equal("archery", selection.Selections![0].Id);
    }

    [Fact]
    public void Validate_ActivatesSubclassRequirementOnlyForMatchingSubclass()
    {
        var championRule = FighterStyle with
        {
            Id = "champion-additional-fighting-style",
            SubclassId = "champion",
            AvailableAtLevel = 7
        };

        var champion = FeatureChoiceRules.Validate(
            [],
            [championRule],
            Progression("fighter", 7, "champion"));
        var otherSubclass = FeatureChoiceRules.Validate(
            [],
            [championRule],
            Progression("fighter", 7, "banneret"));

        Assert.False(champion.IsValid);
        Assert.True(otherSubclass.IsValid);
    }

    [Fact]
    public void Validate_RejectsSkillThatAlreadyHasExpertiseFromEarlierRequirement()
    {
        var expertise = FighterStyle with
        {
            Id = "bard-expertise-2",
            Branches =
            [
                new FeatureChoiceBranchRule(
                    "expertise-skills",
                    1,
                    true,
                    [Archery],
                    UsesProficientSkills: true)
            ]
        };
        var laterExpertise = expertise with
        {
            Id = "bard-expertise-9",
            AvailableAtLevel = 9
        };

        var result = FeatureChoiceRules.Validate(
            [
                new FeatureChoiceSelection(expertise.Id, "expertise-skills", [Archery]),
                new FeatureChoiceSelection(laterExpertise.Id, "expertise-skills", [Archery])
            ],
            [expertise, laterExpertise],
            Progression("bard", 9));

        Assert.Contains(result.Violations, violation =>
            violation.Code == "character.featureChoice.expertise.duplicate");
    }

    private static ClassProgression Progression(string classId, int level, string? subclassId = null) =>
        new(
            new ContentReference(classId, classId),
            level,
            subclassId is null ? null : new ContentReference(subclassId, subclassId));
}
