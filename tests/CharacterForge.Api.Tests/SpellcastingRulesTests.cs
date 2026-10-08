using CharacterForge.Api.Features.Characters;

namespace CharacterForge.Api.Tests;

public sealed class SpellcastingRulesTests
{
    private static readonly AbilityScores Abilities = new(8, 14, 13, 16, 12, 10);

    private static readonly SpellcastingProgressionRule WizardProgression = new(
        1,
        new ContentReference("int", "INT"),
        [
            new SpellcastingLevelRule(
                1,
                3,
                4,
                [new SpellSlotAvailability(1, 2)]),
            new SpellcastingLevelRule(
                5,
                4,
                9,
                [
                    new SpellSlotAvailability(1, 4),
                    new SpellSlotAvailability(2, 3),
                    new SpellSlotAvailability(3, 2)
                ])
        ]);

    [Fact]
    public void Resolve_ReturnsTheAvailabilityForTheSelectedClassLevel()
    {
        var result = SpellcastingRules.Resolve(WizardProgression, 5, Abilities);

        Assert.NotNull(result);
        Assert.Equal("int", result.Ability.Id);
        Assert.Equal(4, result.CantripsKnown);
        Assert.Equal(9, result.PreparedSpells);
        Assert.Equal(
            [new SpellSlotAvailability(1, 4), new SpellSlotAvailability(2, 3), new SpellSlotAvailability(3, 2)],
            result.Slots);
        Assert.Equal(14, result.SpellSaveDc);
        Assert.Equal(6, result.SpellAttackModifier);
    }

    [Fact]
    public void Resolve_ReturnsNoAvailabilityForANonCasterOrBeforeSpellcastingStarts()
    {
        Assert.Null(SpellcastingRules.Resolve(null, 1, Abilities));
        Assert.Null(SpellcastingRules.Resolve(
            WizardProgression with { AvailableAtLevel = 3 },
            2,
            Abilities));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(21)]
    public void Resolve_RejectsClassLevelsOutsideCanonicalBounds(int classLevel)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            SpellcastingRules.Resolve(WizardProgression, classLevel, Abilities));
    }
}
