using CharacterForge.Api.Features.Catalog;

namespace CharacterForge.Api.Features.Characters;

public static class FeatEligibilityRules
{
    private static readonly IReadOnlyDictionary<string, IReadOnlySet<string>> RequiredFeatureIds =
        new Dictionary<string, IReadOnlySet<string>>(StringComparer.Ordinal)
        {
            ["Fighting Style"] = new HashSet<string>(
                ["fighter-fighting-style", "paladin-fighting-style", "ranger-fighting-style"],
                StringComparer.OrdinalIgnoreCase),
            ["Spellcasting"] = new HashSet<string>(
                [
                    "bard-spellcasting",
                    "cleric-spellcasting",
                    "druid-spellcasting",
                    "paladin-spellcasting",
                    "ranger-spellcasting",
                    "sorcerer-spellcasting",
                    "wizard-spellcasting"
                ],
                StringComparer.OrdinalIgnoreCase)
        };

    public static ValidationResult Evaluate(
        CatalogFeatFacts feat,
        int classLevel,
        AbilityScores abilities,
        IReadOnlyList<CatalogReference> activeFeatures)
    {
        ArgumentNullException.ThrowIfNull(feat);
        ArgumentNullException.ThrowIfNull(abilities);
        ArgumentNullException.ThrowIfNull(activeFeatures);

        var violations = new List<RuleViolation>();
        if (feat.MinimumLevel is int minimumLevel && classLevel < minimumLevel)
        {
            violations.Add(new RuleViolation(
                "character.feat.minimumLevel.unmet",
                $"This feat requires class level {minimumLevel}.",
                "featId",
                "error",
                $"Reach class level {minimumLevel}."));
        }

        if (feat.AbilityScorePrerequisite is { } abilityChoice)
        {
            var met = abilityChoice.Options.Count(option =>
                AbilityRules.GetScore(abilities, option.Ability.Id) >= option.MinimumScore);
            if (met < abilityChoice.Count)
            {
                violations.Add(new RuleViolation(
                    "character.feat.abilityScore.unmet",
                    "The character does not meet the feat's ability-score prerequisite.",
                    "abilities",
                    "error",
                    $"Meet {abilityChoice.Count} of the canonical ability-score options."));
            }
        }

        if (feat.RequiredFeature is { } requiredFeature)
        {
            if (!RequiredFeatureIds.TryGetValue(requiredFeature, out var eligibleFeatureIds))
            {
                throw new FeatEligibilityContentException(
                    $"The provider feat prerequisite '{requiredFeature}' has no canonical feature-id mapping.");
            }

            if (!activeFeatures.Any(feature => eligibleFeatureIds.Contains(feature.Id)))
            {
                violations.Add(new RuleViolation(
                    "character.feat.requiredFeature.unmet",
                    $"This feat requires the active '{requiredFeature}' feature.",
                    "featId",
                    "error",
                    $"Gain the canonical '{requiredFeature}' class feature."));
            }
        }

        return new ValidationResult(violations);
    }
}

public sealed class FeatEligibilityContentException(string message) : Exception(message);
