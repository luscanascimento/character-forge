namespace CharacterForge.Api.Features.Characters;

public sealed record WeaponAttackResolution(
    ValidationResult Validation,
    IReadOnlyList<ResolvedWeaponAttack> Attacks);

public static class WeaponAttackRules
{
    private const string ErrorSeverity = "error";

    public static WeaponAttackResolution Resolve(
        IReadOnlyList<WeaponAttackSelection>? selections,
        EquipmentSelections? equipment,
        IReadOnlyList<EquipmentItemRule> equipmentRules,
        IReadOnlyList<GrantedProficiency> proficiencies,
        AbilityScores abilities,
        int proficiencyBonus,
        IReadOnlyList<ResolvedWeaponMastery> masteries,
        int rangedAttackBonus = 0)
    {
        ArgumentNullException.ThrowIfNull(equipmentRules);
        ArgumentNullException.ThrowIfNull(proficiencies);
        ArgumentNullException.ThrowIfNull(abilities);
        ArgumentNullException.ThrowIfNull(masteries);

        var violations = new List<RuleViolation>();
        var attacks = selections ?? [];
        var duplicatedIds = attacks
            .Where(selection => !string.IsNullOrWhiteSpace(selection.Weapon?.Id))
            .GroupBy(selection => selection.Weapon!.Id!, StringComparer.OrdinalIgnoreCase)
            .Where(group => group.Count() > 1)
            .Select(group => group.Key)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var owned = (equipment?.Items ?? [])
            .Where(item => item.Quantity > 0 && !string.IsNullOrWhiteSpace(item.Item?.Id))
            .ToDictionary(item => item.Item!.Id!, StringComparer.OrdinalIgnoreCase);
        var rulesById = equipmentRules
            .Where(rule => !string.IsNullOrWhiteSpace(rule.Item.Id))
            .ToDictionary(rule => rule.Item.Id!, StringComparer.OrdinalIgnoreCase);
        var masteryByWeapon = masteries
            .Where(mastery => !string.IsNullOrWhiteSpace(mastery.Weapon.Id))
            .ToDictionary(mastery => mastery.Weapon.Id!, StringComparer.OrdinalIgnoreCase);
        var resolved = new List<ResolvedWeaponAttack>();

        for (var index = 0; index < attacks.Count; index++)
        {
            var selection = attacks[index];
            var weaponId = selection.Weapon?.Id;
            var source = $"weaponAttacks[{index}]";
            if (string.IsNullOrWhiteSpace(weaponId) || string.IsNullOrWhiteSpace(selection.AbilityId))
            {
                continue;
            }
            if (duplicatedIds.Contains(weaponId))
            {
                Add(violations, "character.weaponAttack.duplicate",
                    "A weapon can have only one active attack configuration.", source,
                    "Keep one attack configuration per weapon.");
                continue;
            }
            if (!owned.TryGetValue(weaponId, out var ownedItem))
            {
                Add(violations, "character.weaponAttack.weapon.notOwned",
                    "A weapon attack requires the weapon to be owned.", $"{source}.weapon",
                    "Add the weapon to equipment or remove the attack.");
                continue;
            }
            if (!ownedItem.Equipped)
            {
                Add(violations, "character.weaponAttack.weapon.notWielded",
                    "A weapon attack requires the weapon to be equipped as wielded.", $"{source}.weapon",
                    "Mark the owned weapon as equipped or remove the attack.");
                continue;
            }
            if (!rulesById.TryGetValue(weaponId, out var itemRule) || itemRule.Weapon is null)
            {
                Add(violations, "character.weaponAttack.weapon.invalid",
                    "The attack selection is not a canonical weapon.", $"{source}.weapon",
                    "Choose a weapon from the active equipment catalog.");
                continue;
            }
            if (!string.Equals(selection.Weapon!.Name, itemRule.Item.Name, StringComparison.Ordinal))
            {
                Add(violations, "character.weaponAttack.weapon.name.mismatch",
                    "The attack weapon name does not match the active catalog.", $"{source}.weapon.name",
                    itemRule.Item.Name!);
                continue;
            }

            var weapon = itemRule.Weapon;
            var abilityId = selection.AbilityId.ToLowerInvariant();
            var finesse = weapon.PropertyIds.Contains("finesse");
            var abilityAllowed = weapon.Kind switch
            {
                "melee" => abilityId == "str" || finesse && abilityId == "dex",
                "ranged" => abilityId == "dex" || finesse && abilityId == "str",
                _ => false
            };
            if (!abilityAllowed)
            {
                Add(violations, "character.weaponAttack.ability.ineligible",
                    $"{itemRule.Item.Name} cannot use the selected attack ability.", $"{source}.abilityId",
                    finesse ? "Use Strength or Dexterity." : weapon.Kind == "ranged" ? "Use Dexterity." : "Use Strength.");
                continue;
            }
            if (selection.TwoHanded && weapon.TwoHandedDamage is null)
            {
                Add(violations, "character.weaponAttack.hands.invalid",
                    $"{itemRule.Item.Name} does not have a canonical two-handed damage profile.", $"{source}.twoHanded",
                    "Use its one-handed configuration.");
                continue;
            }

            var abilityScore = AbilityRules.GetScore(abilities, abilityId);
            var abilityModifier = AbilityRules.GetModifier(abilityScore);
            var isProficient = WeaponMasteryRules.HasWeaponTraining(
                itemRule,
                proficiencies,
                WeaponMasteryManifest.SpecificProficiencyWeapons);
            masteryByWeapon.TryGetValue(weaponId, out var mastery);
            resolved.Add(new ResolvedWeaponAttack(
                itemRule.Item,
                abilityId,
                abilityModifier +
                    (isProficient ? proficiencyBonus : 0) +
                    (weapon.Kind == "ranged" ? rangedAttackBonus : 0),
                selection.TwoHanded ? weapon.TwoHandedDamage! : weapon.Damage,
                abilityModifier,
                isProficient,
                selection.TwoHanded,
                weapon.Range,
                mastery?.Mastery));
        }

        return new WeaponAttackResolution(new ValidationResult(violations), resolved);
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
            ErrorSeverity,
            requirement));
}
