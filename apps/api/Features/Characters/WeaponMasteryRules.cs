namespace CharacterForge.Api.Features.Characters;

public sealed record WeaponMasteryResolution(
    ValidationResult Validation,
    IReadOnlyList<ResolvedWeaponMastery> Masteries);

public static class WeaponMasteryRules
{
    public static WeaponMasteryResolution Resolve(
        IReadOnlyList<WeaponMasterySelection>? selections,
        WeaponMasteryRule? rule,
        EquipmentSelections? equipment,
        IReadOnlyList<EquipmentItemRule> equipmentRules,
        IReadOnlyList<GrantedProficiency> proficiencies)
    {
        ArgumentNullException.ThrowIfNull(equipmentRules);
        ArgumentNullException.ThrowIfNull(proficiencies);

        var saved = selections ?? [];
        var violations = new List<RuleViolation>();
        if (rule is null)
        {
            if (saved.Count > 0)
            {
                Add(
                    violations,
                    "character.weaponMastery.unavailable",
                    "Weapon Mastery selections are retained but unavailable for this class.",
                    "weaponMasteries",
                    "Restore a class with Weapon Mastery or remove the retained selections.");
            }

            return new WeaponMasteryResolution(new ValidationResult(violations), []);
        }

        if (saved.Count != rule.Capacity)
        {
            Add(
                violations,
                "character.weaponMastery.count",
                $"Choose exactly {rule.Capacity} mastered weapons; {saved.Count} are saved.",
                "weaponMasteries",
                $"Exactly {rule.Capacity} distinct eligible owned weapons.");
        }

        var duplicateIds = saved
            .Where(selection => !string.IsNullOrWhiteSpace(selection.Weapon?.Id))
            .GroupBy(selection => selection.Weapon!.Id!, StringComparer.OrdinalIgnoreCase)
            .Where(group => group.Count() > 1)
            .Select(group => group.Key)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var ownedIds = (equipment?.Items ?? [])
            .Where(selection => selection.Quantity > 0 && !string.IsNullOrWhiteSpace(selection.Item?.Id))
            .Select(selection => selection.Item!.Id!)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var rulesById = equipmentRules.ToDictionary(
            candidate => candidate.Item.Id!,
            StringComparer.OrdinalIgnoreCase);
        var proficiencyIds = proficiencies
            .Select(proficiency => proficiency.Proficiency.Id)
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Cast<string>()
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var resolved = new List<ResolvedWeaponMastery>();

        for (var index = 0; index < saved.Count; index++)
        {
            var selection = saved[index];
            var id = selection.Weapon?.Id;
            var source = $"weaponMasteries[{index}].weapon";
            if (string.IsNullOrWhiteSpace(id))
            {
                continue;
            }
            if (duplicateIds.Contains(id))
            {
                Add(
                    violations,
                    "character.weaponMastery.duplicate",
                    "The same weapon cannot be mastered more than once.",
                    source,
                    "Choose distinct weapon kinds.");
                continue;
            }
            if (!ownedIds.Contains(id))
            {
                Add(
                    violations,
                    "character.weaponMastery.weapon.notOwned",
                    "A mastered weapon must be present in owned equipment.",
                    source,
                    "Add the weapon to inventory or remove this mastery selection.");
                continue;
            }
            if (!rulesById.TryGetValue(id, out var itemRule) || itemRule.Weapon is null)
            {
                Add(
                    violations,
                    "character.weaponMastery.weapon.invalid",
                    "The selected item is not a canonical weapon with a mastery property.",
                    source,
                    "Choose an owned weapon from the active catalog.");
                continue;
            }
            if (!string.Equals(selection.Weapon!.Name, itemRule.Item.Name, StringComparison.Ordinal))
            {
                Add(
                    violations,
                    "character.weaponMastery.weapon.name.mismatch",
                    "The mastered weapon name does not match the active catalog.",
                    $"{source}.name",
                    itemRule.Item.Name!);
                continue;
            }

            var hasTraining = proficiencyIds.Contains(id) ||
                itemRule.CategoryIds.Any(proficiencyIds.Contains) ||
                proficiencyIds.Any(proficiencyId =>
                    rule.SpecificProficiencyWeapons.TryGetValue(
                        proficiencyId,
                        out var weaponId) &&
                    string.Equals(weaponId, id, StringComparison.OrdinalIgnoreCase));
            if (!hasTraining)
            {
                Add(
                    violations,
                    "character.weaponMastery.weapon.training.required",
                    $"Weapon Mastery requires proficiency with {itemRule.Item.Name}.",
                    source,
                    "Choose an owned weapon covered by a canonical weapon proficiency.");
                continue;
            }

            resolved.Add(new ResolvedWeaponMastery(itemRule.Item, itemRule.Weapon.Mastery));
        }

        return new WeaponMasteryResolution(new ValidationResult(violations), resolved);
    }

    private static void Add(
        ICollection<RuleViolation> violations,
        string code,
        string message,
        string source,
        string requirement) => violations.Add(new RuleViolation(
        code,
        message,
        source,
        "error",
        requirement));
}
