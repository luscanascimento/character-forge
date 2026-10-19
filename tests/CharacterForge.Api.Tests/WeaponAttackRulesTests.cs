using CharacterForge.Api.Features.Characters;

namespace CharacterForge.Api.Tests;

public sealed class WeaponAttackRulesTests
{
    private static readonly ProficiencySource ClassSource = new(
        "classes",
        new ContentReference("fighter", "Fighter"));

    [Fact]
    public void Resolve_AppliesAbilityProficiencyDamageAndMastery()
    {
        var rule = Weapon(
            "longsword",
            "Longsword",
            ["weapons", "martial-melee-weapons"],
            damage: "1d8",
            twoHandedDamage: "1d10",
            properties: ["versatile"],
            masteryId: "sap");

        var result = WeaponAttackRules.Resolve(
            [new WeaponAttackSelection(new ContentReference("longsword", "Longsword"), "str", true)],
            Owned("longsword", "Longsword", equipped: true),
            [rule],
            [Proficiency("martial-melee-weapons", "Martial Melee Weapons")],
            new AbilityScores(18, 14, 12, 10, 10, 10),
            proficiencyBonus: 3,
            [new ResolvedWeaponMastery(rule.Item, rule.Weapon!.Mastery)]);

        Assert.True(result.Validation.IsValid);
        var attack = Assert.Single(result.Attacks);
        Assert.Equal(7, attack.AttackModifier);
        Assert.Equal(4, attack.DamageModifier);
        Assert.Equal("1d10", attack.Damage.Dice);
        Assert.True(attack.IsProficient);
        Assert.True(attack.TwoHanded);
        Assert.Equal("sap", attack.Mastery?.Id);
    }

    [Fact]
    public void Resolve_AllowsFinesseChoiceAndDoesNotApplyUnownedTraining()
    {
        var rule = Weapon(
            "dagger",
            "Dagger",
            ["weapons", "simple-melee-weapons"],
            damage: "1d4",
            properties: ["finesse", "thrown"],
            masteryId: "nick");

        var result = WeaponAttackRules.Resolve(
            [new WeaponAttackSelection(new ContentReference("dagger", "Dagger"), "dex")],
            Owned("dagger", "Dagger", equipped: true),
            [rule],
            [],
            new AbilityScores(8, 16, 12, 10, 10, 10),
            proficiencyBonus: 2,
            []);

        Assert.True(result.Validation.IsValid);
        var attack = Assert.Single(result.Attacks);
        Assert.Equal(3, attack.AttackModifier);
        Assert.Equal(3, attack.DamageModifier);
        Assert.False(attack.IsProficient);
    }

    [Fact]
    public void Resolve_RejectsDuplicateUnwieldedInvalidAbilityAndHands()
    {
        var longsword = Weapon(
            "longsword",
            "Longsword",
            ["weapons", "martial-melee-weapons"],
            damage: "1d8",
            masteryId: "sap");
        var bow = Weapon(
            "shortbow",
            "Shortbow",
            ["weapons", "simple-ranged-weapons"],
            damage: "1d6",
            masteryId: "vex");

        var result = WeaponAttackRules.Resolve(
            [
                new WeaponAttackSelection(new ContentReference("longsword", "Longsword"), "str"),
                new WeaponAttackSelection(new ContentReference("longsword", "Longsword"), "str"),
                new WeaponAttackSelection(new ContentReference("shortbow", "Shortbow"), "str", true)
            ],
            new EquipmentSelections([
                new EquipmentItemSelection(new ContentReference("longsword", "Longsword"), 1, false),
                new EquipmentItemSelection(new ContentReference("shortbow", "Shortbow"), 1, true)
            ]),
            [longsword, bow],
            [],
            new AbilityScores(16, 12, 12, 10, 10, 10),
            proficiencyBonus: 2,
            []);

        Assert.Contains(result.Validation.Violations, violation =>
            violation.Code == "character.weaponAttack.duplicate");
        Assert.Contains(result.Validation.Violations, violation =>
            violation.Code == "character.weaponAttack.ability.ineligible");
    }

    [Fact]
    public void Resolve_RejectsAnUnwieldedWeapon()
    {
        var result = WeaponAttackRules.Resolve(
            [new WeaponAttackSelection(new ContentReference("club", "Club"), "str")],
            Owned("club", "Club", equipped: false),
            [Weapon("club", "Club", ["weapons", "simple-melee-weapons"], "1d4", masteryId: "slow")],
            [],
            new AbilityScores(10, 10, 10, 10, 10, 10),
            2,
            []);

        Assert.Contains(result.Validation.Violations, violation =>
            violation.Code == "character.weaponAttack.weapon.notWielded");
    }

    [Fact]
    public void Resolve_AppliesArcheryOnlyToRangedWeaponAttacks()
    {
        var bow = Weapon(
            "shortbow",
            "Shortbow",
            ["weapons", "simple-ranged-weapons"],
            "1d6",
            masteryId: "vex");
        var sword = Weapon(
            "shortsword",
            "Shortsword",
            ["weapons", "martial-melee-weapons"],
            "1d6",
            masteryId: "vex");

        var result = WeaponAttackRules.Resolve(
            [
                new WeaponAttackSelection(bow.Item, "dex"),
                new WeaponAttackSelection(sword.Item, "str")
            ],
            new EquipmentSelections([
                new EquipmentItemSelection(bow.Item, 1, true),
                new EquipmentItemSelection(sword.Item, 1, true)
            ]),
            [bow, sword],
            [],
            new AbilityScores(14, 14, 10, 10, 10, 10),
            proficiencyBonus: 2,
            [],
            rangedAttackBonus: 2);

        Assert.Equal(4, result.Attacks.Single(attack => attack.Weapon.Id == "shortbow").AttackModifier);
        Assert.Equal(2, result.Attacks.Single(attack => attack.Weapon.Id == "shortsword").AttackModifier);
    }

    private static EquipmentSelections Owned(string id, string name, bool equipped) =>
        new([new EquipmentItemSelection(new ContentReference(id, name), 1, equipped)]);

    private static EquipmentItemRule Weapon(
        string id,
        string name,
        IReadOnlyList<string> categories,
        string damage,
        string? twoHandedDamage = null,
        IReadOnlyList<string>? properties = null,
        string masteryId = "sap") => new(
        new ContentReference(id, name),
        categories.ToHashSet(StringComparer.OrdinalIgnoreCase),
        null,
        new WeaponEquipmentRule(
            new WeaponDamageRule(damage, new ContentReference("slashing", "Slashing")),
            twoHandedDamage is null
                ? null
                : new WeaponDamageRule(twoHandedDamage, new ContentReference("slashing", "Slashing")),
            null,
            (properties ?? []).ToHashSet(StringComparer.OrdinalIgnoreCase),
            categories.Any(category => category.Contains("ranged", StringComparison.Ordinal))
                ? "ranged"
                : "melee",
            new ContentReference(masteryId, masteryId)));

    private static GrantedProficiency Proficiency(string id, string name) => new(
        new ContentReference(id, name),
        [ClassSource],
        IsSkill: false);
}
