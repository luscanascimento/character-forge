namespace CharacterForge.Api.Features.Characters;

public sealed record FeatChoiceOccurrenceRule(
    string Id,
    int AvailableAtLevel,
    ContentReference Feat);

public sealed record FeatSelectionResolution(
    ValidationResult Validation,
    AbilityScores EffectiveAbilities);

public static class FeatSelectionRules
{
    public static FeatSelectionResolution Resolve(
        IReadOnlyList<FeatSelection>? selections,
        IReadOnlyList<FeatChoiceOccurrenceRule> occurrences,
        int classLevel,
        AbilityScores baseAbilities,
        bool requireActiveChoices = true)
    {
        ArgumentNullException.ThrowIfNull(occurrences);
        ArgumentNullException.ThrowIfNull(baseAbilities);

        var saved = selections ?? [];
        var violations = new List<RuleViolation>();
        var occurrencesById = occurrences.ToDictionary(
            occurrence => occurrence.Id,
            StringComparer.OrdinalIgnoreCase);
        var selectionsById = saved
            .Where(selection => !string.IsNullOrWhiteSpace(selection.OccurrenceId))
            .GroupBy(selection => selection.OccurrenceId!, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.ToArray(), StringComparer.OrdinalIgnoreCase);

        foreach (var duplicate in selectionsById.Where(entry => entry.Value.Length > 1))
        {
            violations.Add(new RuleViolation(
                "character.feat.occurrence.duplicate",
                $"Feat occurrence '{duplicate.Key}' is saved more than once.",
                "feats",
                "error",
                "Keep exactly one feat selection for each progression occurrence."));
        }

        foreach (var selection in saved)
        {
            if (string.IsNullOrWhiteSpace(selection.OccurrenceId))
            {
                continue;
            }

            if (!occurrencesById.TryGetValue(selection.OccurrenceId, out var occurrence) ||
                occurrence.AvailableAtLevel > classLevel)
            {
                violations.Add(new RuleViolation(
                    "character.feat.occurrence.unavailable",
                    "A saved feat choice is not available at the current class and level.",
                    $"feats.{selection.OccurrenceId}",
                    "error",
                    "Restore the granting progression or remove this retained feat choice."));
            }
        }

        var effective = baseAbilities;
        foreach (var occurrence in occurrences
                     .Where(occurrence => occurrence.AvailableAtLevel <= classLevel)
                     .OrderBy(occurrence => occurrence.AvailableAtLevel))
        {
            var source = $"feats.{occurrence.Id}";
            if (!selectionsById.TryGetValue(occurrence.Id, out var matches) || matches.Length == 0)
            {
                if (requireActiveChoices)
                {
                    violations.Add(new RuleViolation(
                        "character.feat.choice.required",
                        $"A feat choice is required for the level {occurrence.AvailableAtLevel} Ability Score Improvement.",
                        source,
                        "error",
                        "Choose the supported feat and complete its effect."));
                }
                continue;
            }
            if (matches.Length != 1)
            {
                continue;
            }

            var selection = matches[0];
            if (!SameReference(selection.Feat, occurrence.Feat))
            {
                violations.Add(new RuleViolation(
                    "character.feat.choice.invalid",
                    "The selected feat does not match the canonical option for this progression occurrence.",
                    $"{source}.feat",
                    "error",
                    "Choose the feat supplied by the active rules."));
                continue;
            }

            var effect = FeatEffectRules.ResolveAbilityScoreImprovement(
                effective,
                selection.AbilityScoreImprovement);
            violations.AddRange(effect.Validation.Violations.Select(violation => violation with
            {
                Source = $"{source}.{violation.Source}"
            }));
            if (effect.ResultingAbilities is not null)
            {
                effective = effect.ResultingAbilities;
            }
        }

        return new FeatSelectionResolution(new ValidationResult(violations), effective);
    }

    private static bool SameReference(ContentReference? selected, ContentReference canonical) =>
        selected is not null &&
        string.Equals(selected.Id, canonical.Id, StringComparison.OrdinalIgnoreCase) &&
        string.Equals(selected.Name, canonical.Name, StringComparison.Ordinal);
}
