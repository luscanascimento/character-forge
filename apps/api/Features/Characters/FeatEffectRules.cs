namespace CharacterForge.Api.Features.Characters;

public sealed record AbilityScoreIncreaseSelection(string? AbilityId, int Increase);

public sealed record AbilityScoreImprovementEffect(
    IReadOnlyList<AbilityScoreIncreaseSelection>? Increases);

public sealed record FeatEffectResolution(
    ValidationResult Validation,
    AbilityScores? ResultingAbilities);

public static class FeatEffectRules
{
    private const int MaximumAbilityScore = 20;

    public static FeatEffectResolution ResolveAbilityScoreImprovement(
        AbilityScores abilities,
        AbilityScoreImprovementEffect? effect)
    {
        ArgumentNullException.ThrowIfNull(abilities);

        if (effect?.Increases is not { } increases)
        {
            return Invalid(
                "character.feat.effect.required",
                "Ability Score Improvement choices are required.",
                "abilityScoreImprovement",
                "Increase one ability by 2 or two different abilities by 1.");
        }

        var violations = new List<RuleViolation>();
        for (var index = 0; index < increases.Count; index++)
        {
            if (!AbilityRules.IsSupportedId(increases[index].AbilityId))
            {
                violations.Add(new RuleViolation(
                    "character.feat.effect.ability.invalid",
                    "The selected ability is not supported.",
                    $"abilityScoreImprovement.increases[{index}].abilityId",
                    "error",
                    "Choose STR, DEX, CON, INT, WIS, or CHA by canonical id."));
            }
        }

        var distinctIds = increases
            .Select(increase => increase.AbilityId)
            .Where(AbilityRules.IsSupportedId)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Count();
        var validShape =
            increases is [{ Increase: 2 }] ||
            increases.Count == 2 &&
            distinctIds == 2 &&
            increases.All(increase => increase.Increase == 1);
        if (!validShape)
        {
            violations.Add(new RuleViolation(
                "character.feat.effect.shape.invalid",
                "Ability Score Improvement must increase one ability by 2 or two different abilities by 1.",
                "abilityScoreImprovement.increases",
                "error",
                "One +2 increase or two distinct +1 increases."));
        }

        if (violations.Count > 0)
        {
            return new FeatEffectResolution(new ValidationResult(violations), null);
        }

        foreach (var increase in increases)
        {
            var resultingScore = AbilityRules.GetScore(abilities, increase.AbilityId!) + increase.Increase;
            if (resultingScore > MaximumAbilityScore)
            {
                violations.Add(new RuleViolation(
                    "character.feat.effect.ability.maximum",
                    $"{increase.AbilityId!.ToUpperInvariant()} cannot be increased above {MaximumAbilityScore} by this feat.",
                    "abilityScoreImprovement.increases",
                    "error",
                    $"Choose an ability whose resulting score is at most {MaximumAbilityScore}."));
            }
        }

        if (violations.Count > 0)
        {
            return new FeatEffectResolution(new ValidationResult(violations), null);
        }

        var byId = increases.ToDictionary(
            increase => increase.AbilityId!,
            increase => increase.Increase,
            StringComparer.OrdinalIgnoreCase);
        int Apply(string id) => AbilityRules.GetScore(abilities, id) + byId.GetValueOrDefault(id);

        return new FeatEffectResolution(
            new ValidationResult([]),
            new AbilityScores(
                Apply("str"),
                Apply("dex"),
                Apply("con"),
                Apply("int"),
                Apply("wis"),
                Apply("cha")));
    }

    private static FeatEffectResolution Invalid(
        string code,
        string message,
        string source,
        string requirement) => new(
        new ValidationResult([new RuleViolation(code, message, source, "error", requirement)]),
        null);
}
