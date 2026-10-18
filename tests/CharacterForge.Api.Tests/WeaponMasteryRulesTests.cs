using CharacterForge.Api.Features.Characters;

namespace CharacterForge.Api.Tests;

public sealed class WeaponMasteryRulesTests
{
    private static readonly IReadOnlyDictionary<string, string> NoSpecificProficiencies =
        new Dictionary<string, string>();
    private static readonly ProficiencySource ClassSource = new(
        "classes",
        new ContentReference("fighter", "Fighter"));

    [Fact]
    public void Resolve_ReturnsCanonicalMasteryForDistinctOwnedTrainedWeapons()
    {
        var result = WeaponMasteryRules.Resolve(
            [
                new WeaponMasterySelection(new ContentReference("longsword", "Longsword")),
                new WeaponMasterySelection(new ContentReference("dagger", "Dagger"))
            ],
            new WeaponMasteryRule(2, WeaponMasteryManifest.Version, NoSpecificProficiencies),
            Owned("longsword", "Longsword", "dagger", "Dagger"),
            [
                Weapon("longsword", "Longsword", ["weapons", "martial-weapons"], "sap", "Sap"),
                Weapon("dagger", "Dagger", ["weapons", "simple-weapons"], "nick", "Nick")
            ],
            [Proficiency("martial-weapons"), Proficiency("simple-weapons")]);

        Assert.True(result.Validation.IsValid);
        Assert.Equal(["sap", "nick"], result.Masteries.Select(item => item.Mastery.Id));
    }

    [Fact]
    public void Resolve_RequiresTheExactCapacityAndRejectsDuplicateSelections()
    {
        var result = WeaponMasteryRules.Resolve(
            [
                new WeaponMasterySelection(new ContentReference("dagger", "Dagger")),
                new WeaponMasterySelection(new ContentReference("dagger", "Dagger"))
            ],
            new WeaponMasteryRule(3, WeaponMasteryManifest.Version, NoSpecificProficiencies),
            Owned("dagger", "Dagger"),
            [Weapon("dagger", "Dagger", ["weapons", "simple-weapons"], "nick", "Nick")],
            [Proficiency("simple-weapons")]);

        Assert.Contains(result.Validation.Violations, violation =>
            violation.Code == "character.weaponMastery.count");
        Assert.Equal(2, result.Validation.Violations.Count(violation =>
            violation.Code == "character.weaponMastery.duplicate"));
    }

    [Fact]
    public void Resolve_RejectsWeaponsThatAreUnownedNotWeaponsOrOutsideTraining()
    {
        var result = WeaponMasteryRules.Resolve(
            [
                new WeaponMasterySelection(new ContentReference("longsword", "Longsword")),
                new WeaponMasterySelection(new ContentReference("rope", "Rope")),
                new WeaponMasterySelection(new ContentReference("dagger", "Dagger"))
            ],
            new WeaponMasteryRule(3, WeaponMasteryManifest.Version, NoSpecificProficiencies),
            Owned("rope", "Rope", "dagger", "Dagger"),
            [
                Weapon("longsword", "Longsword", ["weapons", "martial-weapons"], "sap", "Sap"),
                new EquipmentItemRule(
                    new ContentReference("rope", "Rope"),
                    new HashSet<string>(["gear"], StringComparer.OrdinalIgnoreCase),
                    null),
                Weapon("dagger", "Dagger", ["weapons", "simple-weapons"], "nick", "Nick")
            ],
            [Proficiency("martial-weapons")]);

        Assert.Contains(result.Validation.Violations, violation =>
            violation.Code == "character.weaponMastery.weapon.notOwned");
        Assert.Contains(result.Validation.Violations, violation =>
            violation.Code == "character.weaponMastery.weapon.invalid");
        Assert.Contains(result.Validation.Violations, violation =>
            violation.Code == "character.weaponMastery.weapon.training.required");
    }

    [Fact]
    public void Resolve_RetainsButInvalidatesSelectionsWhenTheFeatureIsUnavailable()
    {
        var result = WeaponMasteryRules.Resolve(
            [new WeaponMasterySelection(new ContentReference("dagger", "Dagger"))],
            null,
            Owned("dagger", "Dagger"),
            [Weapon("dagger", "Dagger", ["weapons", "simple-weapons"], "nick", "Nick")],
            [Proficiency("simple-weapons")]);

        Assert.Contains(result.Validation.Violations, violation =>
            violation.Code == "character.weaponMastery.unavailable");
        Assert.Empty(result.Masteries);
    }

    [Fact]
    public void Resolve_AcceptsAnExplicitSpecificWeaponProficiencyMapping()
    {
        var result = WeaponMasteryRules.Resolve(
            [new WeaponMasterySelection(new ContentReference("rapier", "Rapier"))],
            new WeaponMasteryRule(
                1,
                WeaponMasteryManifest.Version,
                new Dictionary<string, string> { ["rapiers"] = "rapier" }),
            Owned("rapier", "Rapier"),
            [Weapon("rapier", "Rapier", ["weapons", "martial-weapons"], "vex", "Vex")],
            [Proficiency("rapiers")]);

        Assert.True(result.Validation.IsValid);
        Assert.Equal("vex", Assert.Single(result.Masteries).Mastery.Id);
    }

    private static EquipmentSelections Owned(params string[] idAndNamePairs) => new(
        Enumerable.Range(0, idAndNamePairs.Length / 2)
            .Select(index => new EquipmentItemSelection(
                new ContentReference(idAndNamePairs[index * 2], idAndNamePairs[index * 2 + 1]),
                1))
            .ToArray());

    private static EquipmentItemRule Weapon(
        string id,
        string name,
        IReadOnlyList<string> categories,
        string masteryId,
        string masteryName) => new(
        new ContentReference(id, name),
        categories.ToHashSet(StringComparer.OrdinalIgnoreCase),
        null,
        new WeaponEquipmentRule(new ContentReference(masteryId, masteryName)));

    private static GrantedProficiency Proficiency(string id) => new(
        new ContentReference(id, id),
        [ClassSource],
        IsSkill: false);
}
