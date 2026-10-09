namespace CharacterForge.Api.Features.Characters;

public sealed record SpellReplacementPolicyRule(
    string Trigger,
    int? MaximumReplacements);

public sealed record SpellReplacementRulesContext(
    SpellReplacementPolicyRule? Cantrips,
    SpellReplacementPolicyRule PreparedSpells);

public static class SpellReplacementRules
{
    public const string ClassLevelGained = "classLevelGained";
    public const string LongRest = "longRest";

    public static ValidationResult Validate(
        Character previous,
        Character current,
        SpellReplacementRulesContext? rules,
        string? trigger)
    {
        ArgumentNullException.ThrowIfNull(previous);
        ArgumentNullException.ThrowIfNull(current);

        var violations = new List<RuleViolation>();
        if (rules is null)
        {
            AddViolation(
                violations,
                "character.spellReplacement.unsupported",
                "The active class does not support spell replacement events.",
                "trigger",
                "Use a spellcasting class with an active replacement policy.");
            return new ValidationResult(violations);
        }

        if (trigger is not (ClassLevelGained or LongRest))
        {
            AddViolation(
                violations,
                "character.spellReplacement.trigger.invalid",
                "The spell replacement trigger is not recognized.",
                "trigger",
                $"Use '{ClassLevelGained}' or '{LongRest}'.");
            return new ValidationResult(violations);
        }

        if (previous.Id != current.Id)
        {
            AddViolation(
                violations,
                "character.spellReplacement.character.mismatch",
                "A spell replacement transition must compare the same character.",
                "current.id",
                previous.Id.ToString());
        }

        var previousProgression = SingleProgression(previous);
        var currentProgression = SingleProgression(current);
        if (previousProgression is null || currentProgression is null ||
            !string.Equals(
                previousProgression.Class?.Id,
                currentProgression.Class?.Id,
                StringComparison.OrdinalIgnoreCase))
        {
            AddViolation(
                violations,
                "character.spellReplacement.class.mismatch",
                "Spell replacement cannot change the character's class.",
                "current.classProgressions",
                "Keep the same single class in both character states.");
            return new ValidationResult(violations);
        }

        var expectedLevel = trigger == ClassLevelGained
            ? previousProgression.Level + 1
            : previousProgression.Level;
        if (currentProgression.Level != expectedLevel)
        {
            AddViolation(
                violations,
                "character.spellReplacement.level.invalid",
                trigger == ClassLevelGained
                    ? "A class-level replacement event requires exactly one gained class level."
                    : "A Long Rest replacement event cannot change class level.",
                "current.classProgressions[0].level",
                expectedLevel.ToString());
        }

        ValidateGroup(
            previous.Spells?.Cantrips ?? [],
            current.Spells?.Cantrips ?? [],
            rules.Cantrips,
            trigger,
            "cantrips",
            "cantrip",
            violations);
        ValidateGroup(
            previous.Spells?.PreparedSpells ?? [],
            current.Spells?.PreparedSpells ?? [],
            rules.PreparedSpells,
            trigger,
            "preparedSpells",
            "prepared spell",
            violations);

        return new ValidationResult(violations);
    }

    private static ClassProgression? SingleProgression(Character character) =>
        character.ClassProgressions?.Count == 1 ? character.ClassProgressions[0] : null;

    private static void ValidateGroup(
        IReadOnlyList<ContentReference> previous,
        IReadOnlyList<ContentReference> current,
        SpellReplacementPolicyRule? policy,
        string trigger,
        string group,
        string label,
        ICollection<RuleViolation> violations)
    {
        var currentIds = current
            .Where(spell => !string.IsNullOrWhiteSpace(spell.Id))
            .Select(spell => spell.Id!)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var replacements = previous.Count(spell =>
            !string.IsNullOrWhiteSpace(spell.Id) && !currentIds.Contains(spell.Id!));
        if (replacements == 0)
        {
            return;
        }

        if (policy is null)
        {
            AddViolation(
                violations,
                $"character.spellReplacement.{group}.unsupported",
                $"The active class cannot replace {label}s through its base spellcasting feature.",
                $"current.spells.{group}",
                $"Keep every previous {label} selection.");
            return;
        }

        if (!string.Equals(policy.Trigger, trigger, StringComparison.Ordinal))
        {
            AddViolation(
                violations,
                $"character.spellReplacement.{group}.trigger",
                $"{char.ToUpperInvariant(label[0]) + label[1..]} replacement is not available for this event.",
                $"current.spells.{group}",
                $"Replace {label}s only after '{policy.Trigger}'.");
            return;
        }

        if (policy.MaximumReplacements is int maximum && replacements > maximum)
        {
            AddViolation(
                violations,
                $"character.spellReplacement.{group}.limit",
                $"This event replaces {replacements} {Pluralize(label, replacements)}, but the class allows at most {maximum}.",
                $"current.spells.{group}",
                $"Replace at most {maximum} {Pluralize(label, maximum)} during this event.");
        }
    }

    private static string Pluralize(string value, int count) => count == 1 ? value : $"{value}s";

    private static void AddViolation(
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
