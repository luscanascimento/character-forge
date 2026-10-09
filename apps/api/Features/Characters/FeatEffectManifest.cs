using CharacterForge.Api.Features.Catalog;

namespace CharacterForge.Api.Features.Characters;

public static class FeatEffectManifest
{
    public const string Version = "SRD-5.2.1-FEAT-1";
    public const string AbilityScoreImprovementId = "ability-score-improvement";
    public const string SourceDocument = "System Reference Document 5.2.1";
    public const string SourceSection = "Feats — General Feats — Ability Score Improvement";
    public const int SourcePage = 86;
    public const string SourceUrl =
        "https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf";

    public static bool Supports(string featId) => string.Equals(
        featId,
        AbilityScoreImprovementId,
        StringComparison.OrdinalIgnoreCase);

    public static void Verify(CatalogItemDetail feat)
    {
        ArgumentNullException.ThrowIfNull(feat);

        if (!Supports(feat.Id) ||
            !string.Equals(feat.Name, "Ability Score Improvement", StringComparison.Ordinal) ||
            feat.Feat is not
            {
                Type: "general",
                MinimumLevel: 4,
                RequiredFeature: null,
                IsRepeatable: true,
                AbilityScorePrerequisite: null
            })
        {
            throw new FeatEffectContentException(
                "Ability Score Improvement catalog facts do not match the typed effect manifest.");
        }
    }
}

public sealed class FeatEffectContentException(string message) : Exception(message);
