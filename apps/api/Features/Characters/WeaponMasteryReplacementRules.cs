namespace CharacterForge.Api.Features.Characters;

public static class WeaponMasteryReplacementRules
{
    public const string LongRest = "longRest";

    public static ValidationResult Validate(
        Character previous,
        Character current,
        bool isAvailable,
        string? trigger)
    {
        ArgumentNullException.ThrowIfNull(previous);
        ArgumentNullException.ThrowIfNull(current);

        var violations = new List<RuleViolation>();
        if (!isAvailable)
        {
            Add(
                violations,
                "character.weaponMasteryReplacement.unsupported",
                "The active class does not have Weapon Mastery choices to replace.",
                "trigger",
                "Use a character with an active Weapon Mastery feature.");
            return new ValidationResult(violations);
        }
        if (trigger != LongRest)
        {
            Add(
                violations,
                "character.weaponMasteryReplacement.trigger.invalid",
                "Weapon Mastery replacement is available only after a Long Rest.",
                "trigger",
                $"Use '{LongRest}'.");
            return new ValidationResult(violations);
        }
        if (previous.Id != current.Id)
        {
            Add(
                violations,
                "character.weaponMasteryReplacement.character.mismatch",
                "A Weapon Mastery replacement must compare the same character.",
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
            Add(
                violations,
                "character.weaponMasteryReplacement.class.mismatch",
                "Weapon Mastery replacement cannot change the character's class.",
                "current.classProgressions",
                "Keep the same single class in both character states.");
            return new ValidationResult(violations);
        }
        if (previousProgression.Level != currentProgression.Level)
        {
            Add(
                violations,
                "character.weaponMasteryReplacement.level.invalid",
                "A Long Rest Weapon Mastery replacement cannot change class level.",
                "current.classProgressions[0].level",
                previousProgression.Level.ToString());
        }

        var previousIds = Ids(previous.WeaponMasteries);
        var currentIds = Ids(current.WeaponMasteries);
        var removed = previousIds.Count(id => !currentIds.Contains(id));
        var added = currentIds.Count(id => !previousIds.Contains(id));
        if (removed != added)
        {
            Add(
                violations,
                "character.weaponMasteryReplacement.shape.invalid",
                "A Weapon Mastery replacement must exchange one choice without changing capacity.",
                "current.weaponMasteries",
                "Keep the same number of mastery choices.");
        }
        if (removed > 1)
        {
            Add(
                violations,
                "character.weaponMasteryReplacement.limit",
                $"This Long Rest replaces {removed} Weapon Mastery choices, but only one is allowed.",
                "current.weaponMasteries",
                "Replace at most one mastered weapon after a Long Rest.");
        }

        return new ValidationResult(violations);
    }

    private static ClassProgression? SingleProgression(Character character) =>
        character.ClassProgressions?.Count == 1 ? character.ClassProgressions[0] : null;

    private static HashSet<string> Ids(IReadOnlyList<WeaponMasterySelection>? selections) =>
        (selections ?? [])
            .Where(selection => !string.IsNullOrWhiteSpace(selection.Weapon?.Id))
            .Select(selection => selection.Weapon!.Id!)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

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
