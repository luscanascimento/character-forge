namespace CharacterForge.Api.Features.Characters;

public static class SpellSelectionRules
{
    public static ValidationResult Validate(
        SpellSelections? selections,
        SpellSelectionRule? rule)
    {
        var cantrips = selections?.Cantrips ?? [];
        var preparedSpells = selections?.PreparedSpells ?? [];
        var violations = new List<RuleViolation>();

        if (rule is null)
        {
            if (cantrips.Count > 0 || preparedSpells.Count > 0)
            {
                violations.Add(Violation(
                    "character.spells.unsupported",
                    "This class does not have a supported spell selection rule.",
                    "spells",
                    "Remove these selections or restore the class that granted them."));
            }

            return new ValidationResult(violations);
        }

        if (string.Equals(rule.PreparedSpellSource, "spellbook", StringComparison.Ordinal))
        {
            if (cantrips.Count > 0 || preparedSpells.Count > 0)
            {
                violations.Add(Violation(
                    "character.spells.spellbook.required",
                    "Wizard spell selections require spellbook ownership rules that are not available yet.",
                    "spells",
                    "Keep spell selections empty until a Wizard spellbook can be recorded."));
            }

            return new ValidationResult(violations);
        }

        ValidateGroup(
            cantrips,
            rule.CantripCount,
            spell => spell.SpellLevel == 0,
            rule.ClassSpells,
            "cantrips",
            "cantrip",
            violations);
        ValidateGroup(
            preparedSpells,
            rule.PreparedSpellCount,
            spell => spell.SpellLevel is >= 1 && spell.SpellLevel <= rule.MaximumPreparedSpellLevel,
            rule.ClassSpells,
            "preparedSpells",
            "prepared spell",
            violations);

        return new ValidationResult(violations);
    }

    private static void ValidateGroup(
        IReadOnlyList<ContentReference> selections,
        int requiredCount,
        Func<SpellOptionRule, bool> isEligible,
        IReadOnlyList<SpellOptionRule> options,
        string group,
        string label,
        ICollection<RuleViolation> violations)
    {
        if (selections.Count != requiredCount)
        {
            violations.Add(Violation(
                $"character.spells.{group}.count",
                $"Choose exactly {requiredCount} {Pluralize(label, requiredCount)}.",
                $"spells.{group}",
                $"Exactly {requiredCount} {Pluralize(label, requiredCount)} from the active class list."));
        }

        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var optionsById = options.ToDictionary(option => option.Spell.Id!, StringComparer.OrdinalIgnoreCase);
        for (var index = 0; index < selections.Count; index++)
        {
            var selection = selections[index];
            if (selection.Id is null || !seen.Add(selection.Id))
            {
                violations.Add(Violation(
                    $"character.spells.{group}.duplicate",
                    $"Each {label} can be selected only once.",
                    $"spells.{group}[{index}]",
                    $"Choose {requiredCount} distinct {Pluralize(label, requiredCount)}."));
                continue;
            }

            if (!optionsById.TryGetValue(selection.Id, out var option))
            {
                violations.Add(Violation(
                    $"character.spells.{group}.notInClassList",
                    $"{selection.Name} is not in the active class spell list.",
                    $"spells.{group}[{index}]",
                    "Choose a spell from the active class list."));
                continue;
            }

            if (!isEligible(option))
            {
                violations.Add(Violation(
                    $"character.spells.{group}.level",
                    $"{option.Spell.Name} is not an eligible {label} at this class level.",
                    $"spells.{group}[{index}]",
                    group == "cantrips"
                        ? "Choose a level 0 spell."
                        : "Choose a spell no higher than the available spell-slot level."));
            }

            if (!string.Equals(selection.Name, option.Spell.Name, StringComparison.Ordinal))
            {
                violations.Add(Violation(
                    $"character.spells.{group}.name.mismatch",
                    $"The saved name for {selection.Id} does not match the active catalog.",
                    $"spells.{group}[{index}].name",
                    option.Spell.Name!));
            }
        }
    }

    private static string Pluralize(string value, int count) => count == 1 ? value : $"{value}s";

    private static RuleViolation Violation(
        string code,
        string message,
        string source,
        string requirement) => new(code, message, source, "error", requirement);
}
