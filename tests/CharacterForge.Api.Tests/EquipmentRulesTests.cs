using CharacterForge.Api.Features.Characters;

namespace CharacterForge.Api.Tests;

public sealed class EquipmentRulesTests
{
    private static readonly ProficiencySource ClassSource = new(
        "classes",
        new ContentReference("fighter", "Fighter"));

    [Fact]
    public void Resolve_CalculatesBodyArmorDexterityCapAndShieldBonus()
    {
        var selections = new EquipmentSelections([
            new EquipmentItemSelection(new ContentReference("half-plate", "Half Plate"), 1, true),
            new EquipmentItemSelection(new ContentReference("shield", "Shield"), 1, true)
        ]);
        var rules = new[]
        {
            Rule("half-plate", "Half Plate", ["armor", "medium-armor"], new(15, true, 2)),
            Rule("shield", "Shield", ["armor", "shields"], new(2, false, null))
        };
        var proficiencies = new[]
        {
            Proficiency("medium-armor", "Medium Armor"),
            Proficiency("shields", "Shields")
        };

        var result = EquipmentRules.Resolve(selections, rules, dexterityScore: 18, proficiencies);

        Assert.True(result.Validation.IsValid);
        Assert.Equal(19, result.ArmorClass);
    }

    [Fact]
    public void Resolve_UsesUnarmoredDexterityAndEquippedShield()
    {
        var result = EquipmentRules.Resolve(
            new EquipmentSelections([
                new EquipmentItemSelection(new ContentReference("shield", "Shield"), 1, true)
            ]),
            [Rule("shield", "Shield", ["armor", "shields"], new(2, false, null))],
            dexterityScore: 14,
            [Proficiency("shields", "Shields")]);

        Assert.True(result.Validation.IsValid);
        Assert.Equal(14, result.ArmorClass);
    }

    [Fact]
    public void Resolve_RetainsCanonicalValidationForDuplicateStaleAndRenamedItems()
    {
        var result = EquipmentRules.Resolve(
            new EquipmentSelections([
                new EquipmentItemSelection(new ContentReference("dagger", "Old Dagger"), 1),
                new EquipmentItemSelection(new ContentReference("dagger", "Dagger"), 2),
                new EquipmentItemSelection(new ContentReference("missing", "Missing"), 1)
            ]),
            [Rule("dagger", "Dagger", ["weapons"], null)],
            dexterityScore: 10,
            []);

        Assert.Contains(result.Validation.Violations, violation =>
            violation.Code == "character.equipment.duplicate");
        Assert.Contains(result.Validation.Violations, violation =>
            violation.Code == "character.equipment.notFound");
    }

    [Fact]
    public void Resolve_RejectsMultipleArmorAndMissingTraining()
    {
        var result = EquipmentRules.Resolve(
            new EquipmentSelections([
                new EquipmentItemSelection(new ContentReference("leather", "Leather"), 1, true),
                new EquipmentItemSelection(new ContentReference("chain-mail", "Chain Mail"), 1, true),
                new EquipmentItemSelection(new ContentReference("shield", "Shield"), 1, true)
            ]),
            [
                Rule("leather", "Leather", ["armor", "light-armor"], new(11, true, null)),
                Rule("chain-mail", "Chain Mail", ["armor", "heavy-armor"], new(16, false, null)),
                Rule("shield", "Shield", ["armor", "shields"], new(2, false, null))
            ],
            dexterityScore: 14,
            []);

        Assert.Contains(result.Validation.Violations, violation =>
            violation.Code == "character.equipment.armor.equipped.count");
        Assert.Equal(2, result.Validation.Violations.Count(violation =>
            violation.Code == "character.equipment.armor.training.required"));
        Assert.Contains(result.Validation.Violations, violation =>
            violation.Code == "character.equipment.shield.training.required");
    }

    private static EquipmentItemRule Rule(
        string id,
        string name,
        IReadOnlyList<string> categories,
        ArmorEquipmentRule? armor) => new(
        new ContentReference(id, name),
        categories.ToHashSet(StringComparer.OrdinalIgnoreCase),
        armor);

    private static GrantedProficiency Proficiency(string id, string name) => new(
        new ContentReference(id, name),
        [ClassSource],
        IsSkill: false);
}
