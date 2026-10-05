namespace CharacterForge.Api.Features.Characters;

public sealed record FeatureChoiceBranchRule(
    string Id,
    int SelectionCount,
    bool IsAvailable,
    IReadOnlyList<ContentReference> Options,
    bool UsesProficientSkills = false);

public sealed record FeatureChoiceRequirementRule(
    string Id,
    string? SubclassId,
    int AvailableAtLevel,
    int Count,
    IReadOnlyList<FeatureChoiceBranchRule> Branches);

public static class FeatureChoiceRules
{
    public static ValidationResult Validate(
        IReadOnlyList<FeatureChoiceSelection>? selections,
        IReadOnlyList<FeatureChoiceRequirementRule> requirements,
        ClassProgression progression)
    {
        var violations = new List<RuleViolation>();
        var saved = selections ?? [];
        var expertiseSelections = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var activeRequirements = requirements
            .Where(requirement => IsActive(requirement, progression))
            .ToDictionary(requirement => requirement.Id, StringComparer.OrdinalIgnoreCase);

        foreach (var duplicate in saved
            .Where(selection => !string.IsNullOrWhiteSpace(selection.RequirementId))
            .GroupBy(selection => selection.RequirementId!, StringComparer.OrdinalIgnoreCase)
            .Where(group => group.Count() > 1))
        {
            AddViolation(
                violations,
                "character.featureChoice.duplicateRequirement",
                $"Feature choice '{duplicate.Key}' is saved more than once.",
                "featureChoices",
                "Keep exactly one selection for each active feature requirement.");
        }

        for (var index = 0; index < saved.Count; index++)
        {
            var selection = saved[index];
            var source = $"featureChoices[{index}]";
            if (string.IsNullOrWhiteSpace(selection.RequirementId)
                || !activeRequirements.TryGetValue(selection.RequirementId, out var requirement))
            {
                AddViolation(
                    violations,
                    "character.featureChoice.unavailable",
                    "A saved feature choice is not available for the current class, subclass, and level.",
                    source,
                    "Remove the outdated choice or restore the class progression that grants it.");
                continue;
            }

            var requirementSource = $"featureChoices.{requirement.Id}";

            var branch = requirement.Branches.SingleOrDefault(candidate => string.Equals(
                candidate.Id,
                selection.BranchId,
                StringComparison.OrdinalIgnoreCase));
            if (branch is null)
            {
                AddViolation(
                    violations,
                    "character.featureChoice.branch.invalid",
                    "The selected feature-choice branch is not recognized.",
                    $"{requirementSource}.branchId",
                    "Choose a branch from the active feature rules.");
                continue;
            }

            if (!branch.IsAvailable)
            {
                AddViolation(
                    violations,
                    "character.featureChoice.branch.locked",
                    "The selected feature-choice branch depends on rules that are not implemented yet.",
                    $"{requirementSource}.branchId",
                    "Choose an available branch.");
                continue;
            }

            ValidateOptions(selection, branch, requirementSource, violations);
            if (branch.UsesProficientSkills)
            {
                for (var optionIndex = 0; optionIndex < (selection.Selections?.Count ?? 0); optionIndex++)
                {
                    var option = selection.Selections![optionIndex];
                    if (!string.IsNullOrWhiteSpace(option.Id)
                        && !expertiseSelections.Add(option.Id))
                    {
                        AddViolation(
                            violations,
                            "character.featureChoice.expertise.duplicate",
                            $"'{option.Name}' already has Expertise from another feature choice.",
                            $"{requirementSource}.selections[{optionIndex}]",
                            "Choose a proficient skill that does not already have Expertise.");
                    }
                }
            }
        }

        foreach (var requirement in activeRequirements.Values)
        {
            var count = saved.Count(selection => string.Equals(
                selection.RequirementId,
                requirement.Id,
                StringComparison.OrdinalIgnoreCase));
            if (count != requirement.Count)
            {
                AddViolation(
                    violations,
                    "character.featureChoice.count",
                    $"Feature requirement '{requirement.Id}' needs exactly {requirement.Count} choice.",
                    $"featureChoices.{requirement.Id}",
                    $"Choose exactly {requirement.Count} branch for '{requirement.Id}'.");
            }
        }

        return new ValidationResult(violations);
    }

    private static bool IsActive(
        FeatureChoiceRequirementRule requirement,
        ClassProgression progression) =>
        progression.Level >= requirement.AvailableAtLevel
        && (requirement.SubclassId is null
            || string.Equals(
                progression.Subclass?.Id,
                requirement.SubclassId,
                StringComparison.OrdinalIgnoreCase));

    private static void ValidateOptions(
        FeatureChoiceSelection selection,
        FeatureChoiceBranchRule branch,
        string source,
        ICollection<RuleViolation> violations)
    {
        var selected = selection.Selections ?? [];
        if (selected.Count != branch.SelectionCount)
        {
            AddViolation(
                violations,
                "character.featureChoice.selectionCount",
                $"Feature choice branch '{branch.Id}' requires exactly {branch.SelectionCount} selection.",
                $"{source}.selections",
                $"Choose exactly {branch.SelectionCount} option.");
        }

        var selectedIds = selected
            .Where(option => !string.IsNullOrWhiteSpace(option.Id))
            .Select(option => option.Id!)
            .ToArray();
        if (selectedIds.Distinct(StringComparer.OrdinalIgnoreCase).Count() != selectedIds.Length)
        {
            AddViolation(
                violations,
                "character.featureChoice.selection.duplicate",
                "The same feature option cannot be selected more than once.",
                $"{source}.selections",
                "Choose distinct options.");
        }

        var allowedIds = branch.Options
            .Select(option => option.Id!)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        if (selectedIds.Any(id => !allowedIds.Contains(id)))
        {
            AddViolation(
                violations,
                "character.featureChoice.selection.invalid",
                "A selected feature option is not allowed by the active rules.",
                $"{source}.selections",
                "Choose only options supplied by the active feature rules.");
        }
    }

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
