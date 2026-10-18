using CharacterForge.Api.Features.Catalog;
using CharacterForge.Api.Features.Characters;
using CharacterForge.Api.Features.Progression;

namespace CharacterForge.Api.Tests;

public sealed class WeaponMasteryManifestTests
{
    [Fact]
    public void Resolve_UsesAndVerifiesProviderCapacitiesForFighter()
    {
        var progression = Progression(
            "fighter",
            "fighter-weapon-mastery",
            level => level < 4 ? 3 : level < 10 ? 4 : level < 16 ? 5 : 6);

        var rule = WeaponMasteryManifest.Resolve(progression, classLevel: 16);

        Assert.NotNull(rule);
        Assert.Equal(6, rule.Capacity);
        Assert.Equal(WeaponMasteryManifest.Version, rule.ManifestVersion);
    }

    [Fact]
    public void Resolve_UsesManifestCapacityWhenTheProviderOmitsTheCounter()
    {
        var rule = WeaponMasteryManifest.Resolve(
            Progression("paladin", "paladin-weapon-mastery", _ => null),
            classLevel: 20);

        Assert.NotNull(rule);
        Assert.Equal(2, rule.Capacity);
        Assert.Equal("rapier", rule.SpecificProficiencyWeapons["rapiers"]);
    }

    [Fact]
    public void Resolve_FailsClosedWhenProviderCapacityDisagrees()
    {
        var progression = Progression(
            "barbarian",
            "barbarian-weapon-mastery",
            level => level == 20 ? 5 : level < 4 ? 2 : level < 10 ? 3 : 4);

        Assert.Throws<WeaponMasteryContentException>(() =>
            WeaponMasteryManifest.Resolve(progression, classLevel: 20));
    }

    [Fact]
    public void Resolve_FailsClosedWhenAProviderOwnedCapacityIsMissing()
    {
        var progression = Progression(
            "fighter",
            "fighter-weapon-mastery",
            _ => null);

        Assert.Throws<WeaponMasteryContentException>(() =>
            WeaponMasteryManifest.Resolve(progression, classLevel: 1));
    }

    private static ClassProgressionDocument Progression(
        string classId,
        string featureId,
        Func<int, int?> capacity) => new(
        new CatalogReference(classId, classId),
        10,
        Enumerable.Range(1, 20)
            .Select(level => new ClassLevelProgression(
                level,
                ProficiencyRules.GetBonus(level),
                level == 1 ? [new CatalogReference(featureId, "Weapon Mastery")] : [],
                capacity(level)))
            .ToArray(),
        []);
}
