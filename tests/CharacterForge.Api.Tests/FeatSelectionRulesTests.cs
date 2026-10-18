using CharacterForge.Api.Features.Characters;

namespace CharacterForge.Api.Tests;

public sealed class FeatSelectionRulesTests
{
    private static readonly ContentReference AbilityScoreImprovement =
        new("ability-score-improvement", "Ability Score Improvement");

    [Fact]
    public void Resolve_AppliesActiveOccurrencesInLevelOrderToBaseAbilities()
    {
        var result = FeatSelectionRules.Resolve(
            [
                Selection("wizard-ability-score-improvement-8", new AbilityScoreIncreaseSelection("wis", 2)),
                Selection("wizard-ability-score-improvement-4", new AbilityScoreIncreaseSelection("int", 2))
            ],
            Occurrences(),
            classLevel: 8,
            new AbilityScores(8, 14, 13, 16, 12, 10));

        Assert.True(result.Validation.IsValid);
        Assert.Equal(18, result.EffectiveAbilities.Intelligence);
        Assert.Equal(14, result.EffectiveAbilities.Wisdom);
    }

    [Fact]
    public void Resolve_RequiresEveryActiveOccurrence()
    {
        var result = FeatSelectionRules.Resolve(
            [],
            Occurrences(),
            classLevel: 4,
            new AbilityScores(8, 14, 13, 16, 12, 10));

        var violation = Assert.Single(result.Validation.Violations);
        Assert.Equal("character.feat.choice.required", violation.Code);
        Assert.Equal("feats.wizard-ability-score-improvement-4", violation.Source);
    }

    [Fact]
    public void Resolve_RetainsButInvalidatesAnOccurrenceAfterLevelReduction()
    {
        var result = FeatSelectionRules.Resolve(
            [Selection("wizard-ability-score-improvement-8", new AbilityScoreIncreaseSelection("wis", 2))],
            Occurrences(),
            classLevel: 4,
            new AbilityScores(8, 14, 13, 16, 12, 10),
            requireActiveChoices: false);

        Assert.Contains(result.Validation.Violations, violation =>
            violation.Code == "character.feat.occurrence.unavailable");
        Assert.Equal(12, result.EffectiveAbilities.Wisdom);
    }

    [Fact]
    public void Resolve_EnforcesCanonicalFeatIdentityAndTheCumulativeMaximum()
    {
        var invalidReference = FeatSelectionRules.Resolve(
            [new FeatSelection(
                "wizard-ability-score-improvement-4",
                new ContentReference("grappler", "Grappler"),
                new AbilityScoreImprovementEffect([new("int", 2)]))],
            Occurrences(),
            classLevel: 4,
            new AbilityScores(8, 14, 13, 18, 12, 10));
        var overMaximum = FeatSelectionRules.Resolve(
            [
                Selection("wizard-ability-score-improvement-4", new AbilityScoreIncreaseSelection("int", 2)),
                Selection("wizard-ability-score-improvement-8", new AbilityScoreIncreaseSelection("int", 2))
            ],
            Occurrences(),
            classLevel: 8,
            new AbilityScores(8, 14, 13, 18, 12, 10));

        Assert.Contains(invalidReference.Validation.Violations, violation =>
            violation.Code == "character.feat.choice.invalid");
        Assert.Contains(overMaximum.Validation.Violations, violation =>
            violation.Code == "character.feat.effect.ability.maximum" &&
            violation.Source.StartsWith("feats.wizard-ability-score-improvement-8"));
    }

    [Fact]
    public void CharacterEvaluation_UsesEffectiveAbilitiesForDerivedValues()
    {
        var character = CharacterValidatorTests.CreateValidCharacter(level: 4) with
        {
            ProficiencyChoices = [],
            Feats =
            [
                Selection(
                    "wizard-ability-score-improvement-4",
                    new AbilityScoreIncreaseSelection("con", 2))
            ]
        };
        var evaluation = CharacterEvaluator.Evaluate(
            character,
            new CharacterRulesContext(
                HitDie: 6,
                ProficiencyGrants: [],
                ProficiencyChoices: [],
                Subclasses:
                [
                    new SubclassRule(new ContentReference("evoker", "Evoker"), 3)
                ],
                FeatChoices: Occurrences().Take(1).ToArray()));

        Assert.True(evaluation.Validation.IsValid);
        Assert.NotNull(evaluation.Derived);
        Assert.Equal(13, evaluation.Derived.BaseAbilities.Constitution);
        Assert.Equal(15, evaluation.Derived.EffectiveAbilities.Constitution);
        Assert.Equal(2, evaluation.Derived.AbilityModifiers.Constitution);
        Assert.Equal(26, evaluation.Derived.HitPointMaximum);
    }

    private static IReadOnlyList<FeatChoiceOccurrenceRule> Occurrences() =>
    [
        new("wizard-ability-score-improvement-4", 4, AbilityScoreImprovement),
        new("wizard-ability-score-improvement-8", 8, AbilityScoreImprovement)
    ];

    private static FeatSelection Selection(
        string occurrenceId,
        params AbilityScoreIncreaseSelection[] increases) => new(
        occurrenceId,
        AbilityScoreImprovement,
        new AbilityScoreImprovementEffect(increases));
}
