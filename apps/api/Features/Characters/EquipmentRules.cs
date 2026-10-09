namespace CharacterForge.Api.Features.Characters;

public sealed record EquipmentResolution(
    ValidationResult Validation,
    int ArmorClass);

public static class EquipmentRules
{
    private const string ErrorSeverity = "error";

    public static EquipmentResolution Resolve(
        EquipmentSelections? selections,
        IReadOnlyList<EquipmentItemRule> rules,
        int dexterityScore,
        IReadOnlyList<GrantedProficiency> proficiencies)
    {
        ArgumentNullException.ThrowIfNull(rules);
        ArgumentNullException.ThrowIfNull(proficiencies);

        var violations = new List<RuleViolation>();
        var items = selections?.Items ?? [];
        var duplicatedIds = items
            .Where(selection => !string.IsNullOrWhiteSpace(selection.Item?.Id))
            .GroupBy(selection => selection.Item!.Id!, StringComparer.OrdinalIgnoreCase)
            .Where(group => group.Count() > 1)
            .Select(group => group.Key)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var rulesById = rules.ToDictionary(rule => rule.Item.Id!, StringComparer.OrdinalIgnoreCase);
        var equippedBodyArmor = new List<EquipmentItemRule>();
        var equippedShields = new List<EquipmentItemRule>();

        for (var index = 0; index < items.Count; index++)
        {
            var selection = items[index];
            var itemId = selection.Item?.Id;
            var source = $"equipment.items[{index}]";
            if (string.IsNullOrWhiteSpace(itemId))
            {
                continue;
            }

            if (duplicatedIds.Contains(itemId))
            {
                Add(
                    violations,
                    "character.equipment.duplicate",
                    "The same equipment item cannot appear more than once; use its quantity instead.",
                    source,
                    "Keep one entry per canonical equipment id.");
                continue;
            }

            if (!rulesById.TryGetValue(itemId, out var rule))
            {
                Add(
                    violations,
                    "character.equipment.notFound",
                    "The selected equipment item is not in the active catalog.",
                    $"{source}.item",
                    "Choose equipment from the 2024 / SRD-5.2.1 catalog.");
                continue;
            }

            if (!string.Equals(selection.Item!.Name, rule.Item.Name, StringComparison.Ordinal))
            {
                Add(
                    violations,
                    "character.equipment.name.mismatch",
                    "The equipment name does not match the active catalog.",
                    $"{source}.item.name",
                    rule.Item.Name!);
            }

            if (!selection.Equipped || rule.Armor is null)
            {
                continue;
            }

            if (rule.CategoryIds.Contains("shields"))
            {
                equippedShields.Add(rule);
                RequireTraining(violations, proficiencies, "shields", "Shield", source);
                continue;
            }

            equippedBodyArmor.Add(rule);
            var armorCategory = BodyArmorCategory(rule.CategoryIds);
            if (armorCategory is null)
            {
                Add(
                    violations,
                    "character.equipment.armor.category.invalid",
                    "Equipped body armor does not have a supported armor category.",
                    source,
                    "Use canonical light, medium, or heavy armor.");
            }
            else if (!HasProficiency(proficiencies, armorCategory) &&
                     !HasProficiency(proficiencies, "all-armor"))
            {
                Add(
                    violations,
                    "character.equipment.armor.training.required",
                    $"Equipping this item requires {armorCategory} training.",
                    source,
                    $"Gain '{armorCategory}' or 'all-armor' proficiency.");
            }
        }

        if (equippedBodyArmor.Count > 1)
        {
            Add(
                violations,
                "character.equipment.armor.equipped.count",
                "Only one suit of body armor can be equipped.",
                "equipment.items",
                "Equip at most one suit of body armor.");
        }
        if (equippedShields.Count > 1)
        {
            Add(
                violations,
                "character.equipment.shield.equipped.count",
                "Only one Shield can contribute to Armor Class.",
                "equipment.items",
                "Equip at most one Shield.");
        }

        var baseArmorClass = equippedBodyArmor.Count == 1
            ? ArmorClass(equippedBodyArmor[0].Armor!, dexterityScore)
            : ArmorClassRules.GetUnarmored(dexterityScore);
        var shieldBonus = equippedShields.Count == 1
            ? equippedShields[0].Armor!.BaseArmorClass
            : 0;

        return new EquipmentResolution(
            new ValidationResult(violations),
            baseArmorClass + shieldBonus);
    }

    private static int ArmorClass(ArmorEquipmentRule armor, int dexterityScore)
    {
        var dexterityBonus = armor.AddsDexterity ? AbilityRules.GetModifier(dexterityScore) : 0;
        if (armor.MaximumDexterityBonus is int maximum)
        {
            dexterityBonus = Math.Min(dexterityBonus, maximum);
        }

        return armor.BaseArmorClass + dexterityBonus;
    }

    private static string? BodyArmorCategory(IReadOnlySet<string> categories)
    {
        var matches = new[] { "light-armor", "medium-armor", "heavy-armor" }
            .Where(categories.Contains)
            .ToArray();
        return matches.Length == 1 ? matches[0] : null;
    }

    private static void RequireTraining(
        ICollection<RuleViolation> violations,
        IReadOnlyList<GrantedProficiency> proficiencies,
        string proficiencyId,
        string label,
        string source)
    {
        if (!HasProficiency(proficiencies, proficiencyId))
        {
            Add(
                violations,
                "character.equipment.shield.training.required",
                $"Equipping a {label} requires Shield training.",
                source,
                "Gain 'shields' proficiency.");
        }
    }

    private static bool HasProficiency(
        IReadOnlyList<GrantedProficiency> proficiencies,
        string id) => proficiencies.Any(proficiency => string.Equals(
            proficiency.Proficiency.Id,
            id,
            StringComparison.OrdinalIgnoreCase));

    private static void Add(
        ICollection<RuleViolation> violations,
        string code,
        string message,
        string source,
        string requirement) => violations.Add(new RuleViolation(
        code,
        message,
        source,
        ErrorSeverity,
        requirement));
}
