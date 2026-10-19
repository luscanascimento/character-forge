namespace CharacterForge.Api.Features.Characters;

public static class FightingStyleEffectManifest
{
    public const string Version = "SRD-5.2.1-FS-1";
    public const string ArcheryId = "archery";
    public const string DefenseId = "defense";
    public const string SourceDocument = "System Reference Document 5.2.1";
    public const string SourceSection = "Feats — Fighting Style Feats";
    public const string SourceUrl =
        "https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf";
    public const int ArcherySourcePage = 86;
    public const int DefenseSourcePage = 87;
}

public sealed record FightingStyleEffectResolution(
    ValidationResult Validation,
    bool HasArchery,
    bool HasDefense);

public static class FightingStyleEffectRules
{
    private const string FightingStyleBranchId = "fighting-style-feat";

    public static FightingStyleEffectResolution Resolve(
        IReadOnlyList<FeatureChoiceSelection>? choices)
    {
        var selections = (choices ?? [])
            .Where(choice => string.Equals(
                choice.BranchId,
                FightingStyleBranchId,
                StringComparison.OrdinalIgnoreCase))
            .SelectMany(choice => choice.Selections ?? [])
            .Where(selection => !string.IsNullOrWhiteSpace(selection.Id))
            .ToArray();
        var violations = selections
            .GroupBy(selection => selection.Id!, StringComparer.OrdinalIgnoreCase)
            .Where(group => group.Count() > 1)
            .Select(group => new RuleViolation(
                "character.fightingStyle.duplicate",
                $"Fighting Style feat '{group.First().Name}' cannot be selected more than once.",
                "featureChoices",
                "error",
                "Choose a different Fighting Style feat for each active Fighting Style feature."))
            .ToArray();

        bool Has(string id) => selections.Any(selection => string.Equals(
            selection.Id,
            id,
            StringComparison.OrdinalIgnoreCase));

        return new FightingStyleEffectResolution(
            new ValidationResult(violations),
            Has(FightingStyleEffectManifest.ArcheryId),
            Has(FightingStyleEffectManifest.DefenseId));
    }
}
