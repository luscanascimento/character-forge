using CharacterForge.Api.Features.Characters;

namespace CharacterForge.Api.Tests;

public sealed class WeaponMasteryReplacementRulesTests
{
    [Fact]
    public void AcceptsOneReplacementAfterALongRest()
    {
        var result = WeaponMasteryReplacementRules.Validate(
            Character(["longsword", "battleaxe"]),
            Character(["longsword", "warhammer"]),
            isAvailable: true,
            WeaponMasteryReplacementRules.LongRest);

        Assert.True(result.IsValid);
    }

    [Fact]
    public void AcceptsAnUnchangedState()
    {
        var result = WeaponMasteryReplacementRules.Validate(
            Character(["longsword", "battleaxe"]),
            Character(["longsword", "battleaxe"]),
            isAvailable: true,
            WeaponMasteryReplacementRules.LongRest);

        Assert.True(result.IsValid);
    }

    [Fact]
    public void RejectsMoreThanOneReplacement()
    {
        var result = WeaponMasteryReplacementRules.Validate(
            Character(["longsword", "battleaxe", "dagger"]),
            Character(["warhammer", "shortsword", "handaxe"]),
            isAvailable: true,
            WeaponMasteryReplacementRules.LongRest);

        Assert.Contains(result.Violations, violation =>
            violation.Code == "character.weaponMasteryReplacement.limit");
    }

    [Theory]
    [InlineData("shortRest")]
    [InlineData("classLevelGained")]
    [InlineData(null)]
    public void RejectsUnsupportedTriggers(string? trigger)
    {
        var result = WeaponMasteryReplacementRules.Validate(
            Character(["longsword"]),
            Character(["battleaxe"]),
            isAvailable: true,
            trigger);

        Assert.Contains(result.Violations, violation =>
            violation.Code == "character.weaponMasteryReplacement.trigger.invalid");
    }

    [Fact]
    public void RejectsUnavailableFeaturesAndLevelChanges()
    {
        var unsupported = WeaponMasteryReplacementRules.Validate(
            Character([]),
            Character([]),
            isAvailable: false,
            WeaponMasteryReplacementRules.LongRest);
        var changedLevel = WeaponMasteryReplacementRules.Validate(
            Character(["longsword"]),
            Character(["battleaxe"], level: 2),
            isAvailable: true,
            WeaponMasteryReplacementRules.LongRest);

        Assert.Contains(unsupported.Violations, violation =>
            violation.Code == "character.weaponMasteryReplacement.unsupported");
        Assert.Contains(changedLevel.Violations, violation =>
            violation.Code == "character.weaponMasteryReplacement.level.invalid");
    }

    private static Character Character(IReadOnlyList<string> weaponIds, int level = 1) =>
        CharacterValidatorTests.CreateValidCharacter(level) with
        {
            ClassProgressions =
            [
                new ClassProgression(
                    new ContentReference("fighter", "Fighter"),
                    level)
            ],
            WeaponMasteries = weaponIds
                .Select(id => new WeaponMasterySelection(new ContentReference(id, id)))
                .ToArray()
        };
}
