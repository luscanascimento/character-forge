using CharacterForge.Api.Features.Characters;

namespace CharacterForge.Api.Tests;

public sealed class ExpertiseEligibilityRulesTests
{
    private static readonly ContentReference Arcana = new("skill-arcana", "Skill: Arcana");
    private static readonly ContentReference Lute = new("instrument-lute", "Lute");

    [Fact]
    public void Evaluate_DerivesExpertiseOptionsOnlyFromResolvedSkillProficiencies()
    {
        var character = Character() with
        {
            FeatureChoices =
            [
                new FeatureChoiceSelection(
                    "bard-expertise-2",
                    "expertise-skills",
                    [Arcana])
            ]
        };

        var evaluation = CharacterEvaluator.Evaluate(character, Context());

        Assert.True(evaluation.Validation.IsValid);
        Assert.NotNull(evaluation.Derived);
        Assert.True(evaluation.Derived.GrantedProficiencies.Single(item =>
            item.Proficiency.Id == Arcana.Id).IsSkill);
        Assert.False(evaluation.Derived.GrantedProficiencies.Single(item =>
            item.Proficiency.Id == Lute.Id).IsSkill);
    }

    [Fact]
    public void Evaluate_RejectsExpertiseInANonSkillProficiency()
    {
        var character = Character() with
        {
            FeatureChoices =
            [
                new FeatureChoiceSelection(
                    "bard-expertise-2",
                    "expertise-skills",
                    [Lute])
            ]
        };

        var evaluation = CharacterEvaluator.Evaluate(character, Context());

        Assert.False(evaluation.Validation.IsValid);
        Assert.Contains(evaluation.Validation.Violations, violation =>
            violation.Code == "character.featureChoice.selection.invalid");
    }

    private static Character Character() => CharacterValidatorTests.CreateValidCharacter(level: 2) with
    {
        ClassProgressions =
        [
            new ClassProgression(
                new ContentReference("bard", "Bard"),
                2)
        ],
        ProficiencyChoices = []
    };

    private static CharacterRulesContext Context()
    {
        var source = new ProficiencySource(
            "classes",
            new ContentReference("bard", "Bard"));

        return new CharacterRulesContext(
            HitDie: 8,
            ProficiencyGrants:
            [
                new ProficiencyGrant(Arcana, source, IsSkill: true),
                new ProficiencyGrant(Lute, source, IsSkill: false)
            ],
            ProficiencyChoices: [],
            Subclasses: [],
            FeatureChoices:
            [
                new FeatureChoiceRequirementRule(
                    "bard-expertise-2",
                    SubclassId: null,
                    AvailableAtLevel: 2,
                    Count: 1,
                    [new FeatureChoiceBranchRule(
                        "expertise-skills",
                        SelectionCount: 1,
                        IsAvailable: true,
                        Options: [],
                        UsesProficientSkills: true)])
            ]);
    }
}
