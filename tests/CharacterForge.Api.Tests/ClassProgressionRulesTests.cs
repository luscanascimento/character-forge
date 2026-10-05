using CharacterForge.Api.Features.Characters;

namespace CharacterForge.Api.Tests;

public sealed class ClassProgressionRulesTests
{
    private static readonly SubclassRule Evoker = new(
        new ContentReference("evoker", "Evoker"),
        3);

    [Fact]
    public void Validate_AllowsNoSubclassBeforeOneIsAvailable()
    {
        var result = ClassProgressionRules.Validate(
            new ClassProgression(new ContentReference("wizard", "Wizard"), 2),
            [Evoker]);

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Validate_RequiresSubclassAtItsAvailabilityLevel()
    {
        var result = ClassProgressionRules.Validate(
            new ClassProgression(new ContentReference("wizard", "Wizard"), 3),
            [Evoker]);

        var violation = Assert.Single(result.Violations);
        Assert.Equal("character.subclass.required", violation.Code);
        Assert.Equal("classProgressions[0].subclass", violation.Source);
    }

    [Fact]
    public void Validate_RetainsButInvalidatesSubclassBelowItsAvailabilityLevel()
    {
        var result = ClassProgressionRules.Validate(
            new ClassProgression(
                new ContentReference("wizard", "Wizard"),
                2,
                new ContentReference("evoker", "Evoker")),
            [Evoker]);

        var violation = Assert.Single(result.Violations);
        Assert.Equal("character.subclass.unavailableAtLevel", violation.Code);
        Assert.Equal("Class level 3 or higher, or explicitly remove the subclass.", violation.Requirement);
    }

    [Fact]
    public void Validate_RejectsSubclassOutsideTheSelectedClassProgression()
    {
        var result = ClassProgressionRules.Validate(
            new ClassProgression(
                new ContentReference("wizard", "Wizard"),
                3,
                new ContentReference("champion", "Champion")),
            [Evoker]);

        Assert.Contains(
            result.Violations,
            violation => violation.Code == "character.subclass.notFound");
    }

    [Fact]
    public void Validate_AcceptsAvailableSubclass()
    {
        var result = ClassProgressionRules.Validate(
            new ClassProgression(
                new ContentReference("wizard", "Wizard"),
                3,
                new ContentReference("evoker", "Evoker")),
            [Evoker]);

        Assert.True(result.IsValid);
    }
}
