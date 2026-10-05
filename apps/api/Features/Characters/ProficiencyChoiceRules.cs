namespace CharacterForge.Api.Features.Characters;

public sealed record ProficiencyChoiceResolution(
    ValidationResult Validation,
    IReadOnlyList<ProficiencyGrant> Grants);

public static class ProficiencyChoiceRules
{
    public static ProficiencyChoiceResolution Resolve(
        IReadOnlyList<ProficiencyChoiceSelection>? selections,
        IReadOnlyList<ProficiencyChoiceRule> rules,
        IReadOnlyList<ProficiencyGrant> fixedGrants)
    {
        var violations = new List<RuleViolation>();
        var grants = fixedGrants.ToList();
        var knownProficiencies = fixedGrants
            .Where(grant => !string.IsNullOrWhiteSpace(grant.Proficiency.Id))
            .Select(grant => grant.Proficiency.Id!)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var rulesById = rules.ToDictionary(rule => rule.Id, StringComparer.Ordinal);
        var submittedById = IndexSelections(selections ?? [], rulesById, violations);

        foreach (var rule in rules)
        {
            if (!submittedById.TryGetValue(rule.Id, out var submitted))
            {
                violations.Add(Error(
                    "character.proficiencyChoice.required",
                    $"A selection is required for '{rule.Prompt}'.",
                    "proficiencyChoices",
                    $"Choose {rule.Count} option(s) for '{rule.Id}'."));
                continue;
            }

            ResolveSelection(rule, submitted.Selection, submitted.Index, knownProficiencies, grants, violations);
        }

        return new ProficiencyChoiceResolution(new ValidationResult(violations), grants);
    }

    private static Dictionary<string, IndexedSelection> IndexSelections(
        IReadOnlyList<ProficiencyChoiceSelection> selections,
        IReadOnlyDictionary<string, ProficiencyChoiceRule> rules,
        ICollection<RuleViolation> violations)
    {
        var indexed = new Dictionary<string, IndexedSelection>(StringComparer.Ordinal);

        for (var index = 0; index < selections.Count; index++)
        {
            var selection = selections[index];
            if (string.IsNullOrWhiteSpace(selection.ChoiceId))
            {
                violations.Add(Error(
                    "character.proficiencyChoice.id.required",
                    "Proficiency choice id is required.",
                    $"proficiencyChoices[{index}].choiceId",
                    "Use the choice id supplied by character validation content."));
                continue;
            }

            if (!rules.ContainsKey(selection.ChoiceId))
            {
                violations.Add(Error(
                    "character.proficiencyChoice.stale",
                    "The proficiency choice is not available for the current character options.",
                    $"proficiencyChoices[{index}].choiceId",
                    "Remove the stale choice and use a currently required choice id."));
                continue;
            }

            if (!indexed.TryAdd(selection.ChoiceId, new IndexedSelection(index, selection)))
            {
                violations.Add(Error(
                    "character.proficiencyChoice.duplicate",
                    "The same proficiency choice was submitted more than once.",
                    $"proficiencyChoices[{index}].choiceId",
                    "Submit each required choice exactly once."));
            }
        }

        return indexed;
    }

    private static void ResolveSelection(
        ProficiencyChoiceRule rule,
        ProficiencyChoiceSelection selection,
        int selectionIndex,
        ISet<string> knownProficiencies,
        ICollection<ProficiencyGrant> grants,
        ICollection<RuleViolation> violations)
    {
        var selected = selection.Selections ?? [];
        var distinctIds = selected
            .Select(item => item.Id)
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Count();
        if (distinctIds != rule.Count)
        {
            violations.Add(Error(
                "character.proficiencyChoice.count",
                $"'{rule.Prompt}' requires exactly {rule.Count} distinct selection(s).",
                $"proficiencyChoices[{selectionIndex}].selections",
                rule.Count.ToString()));
        }

        var optionsById = rule.Options
            .Where(option => !string.IsNullOrWhiteSpace(option.Id))
            .ToDictionary(option => option.Id!, StringComparer.OrdinalIgnoreCase);
        var seenInChoice = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        for (var optionIndex = 0; optionIndex < selected.Count; optionIndex++)
        {
            var submitted = selected[optionIndex];
            var source = $"proficiencyChoices[{selectionIndex}].selections[{optionIndex}]";
            if (string.IsNullOrWhiteSpace(submitted.Id) || !optionsById.TryGetValue(submitted.Id, out var option))
            {
                violations.Add(Error(
                    "character.proficiencyChoice.option.invalid",
                    "The selected proficiency is not allowed for this choice.",
                    source,
                    $"Choose an option declared by '{rule.Id}'."));
                continue;
            }

            if (!seenInChoice.Add(option.Id!) || !knownProficiencies.Add(option.Id!))
            {
                violations.Add(Error(
                    "character.proficiencyChoice.selection.duplicate",
                    $"'{option.Name}' is already granted by another selection or source.",
                    source,
                    "Choose a different allowed proficiency; SRD 5.2.1 does not stack proficiency bonuses."));
                continue;
            }

            grants.Add(new ProficiencyGrant(
                new ContentReference(option.Id, option.Name),
                rule.Source,
                rule.SkillOptionIds?.Contains(option.Id!) == true));
        }
    }

    private static RuleViolation Error(
        string code,
        string message,
        string source,
        string requirement) => new(code, message, source, "error", requirement);

    private sealed record IndexedSelection(int Index, ProficiencyChoiceSelection Selection);
}
