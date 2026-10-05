namespace CharacterForge.Api.Features.Characters;

public static class ClassProgressionRules
{
    public static ValidationResult Validate(
        ClassProgression progression,
        IReadOnlyList<SubclassRule> subclassRules)
    {
        var availableRules = subclassRules
            .Where(rule => rule.AvailableAtLevel <= progression.Level)
            .ToArray();

        if (progression.Subclass is null)
        {
            return availableRules.Length == 0
                ? new ValidationResult([])
                : Invalid(
                    "character.subclass.required",
                    "A subclass selection is required at the current class level.",
                    $"Choose one available subclass at level {progression.Level}.");
        }

        var selectedRule = subclassRules.FirstOrDefault(rule => string.Equals(
            rule.Subclass.Id,
            progression.Subclass.Id,
            StringComparison.OrdinalIgnoreCase));
        if (selectedRule is null)
        {
            return Invalid(
                "character.subclass.notFound",
                "The selected subclass is not available for the selected class.",
                "Keep the saved reference or choose a subclass from the active class progression.");
        }

        return progression.Level < selectedRule.AvailableAtLevel
            ? Invalid(
                "character.subclass.unavailableAtLevel",
                $"The selected subclass is available at level {selectedRule.AvailableAtLevel}.",
                $"Class level {selectedRule.AvailableAtLevel} or higher, or explicitly remove the subclass.")
            : new ValidationResult([]);
    }

    private static ValidationResult Invalid(string code, string message, string requirement) =>
        new(
        [
            new RuleViolation(
                code,
                message,
                "classProgressions[0].subclass",
                "error",
                requirement)
        ]);
}
