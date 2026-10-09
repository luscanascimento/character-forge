using CharacterForge.Api.Features.Catalog;
using CharacterForge.Api.Features.Progression;
using CharacterForge.Api.Infrastructure.Srd;

namespace CharacterForge.Api.Features.Characters;

public sealed record FeatEligibilityRequest(
    Character Character,
    string? FeatId,
    AbilityScoreImprovementEffect? AbilityScoreImprovement = null);

public sealed record FeatEligibilityResult(
    ContentReference Feat,
    string Type,
    bool IsRepeatable,
    bool MeetsPrerequisites,
    bool EffectsSupported,
    bool CanSelect,
    AbilityScores? ResultingAbilities = null,
    string? EffectManifestVersion = null);

public sealed record FeatEligibilityEvaluation(
    ValidationResult Validation,
    FeatEligibilityResult? Feat);

public sealed class FeatEligibilityEvaluationService(
    CharacterEvaluationService characters,
    CatalogService catalog,
    ClassProgressionService classProgressions)
{
    public async Task<FeatEligibilityEvaluation> EvaluateAsync(
        FeatEligibilityRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(request.Character);

        var characterEvaluation = await characters.EvaluateAsync(request.Character, cancellationToken);
        if (!characterEvaluation.Validation.IsValid)
        {
            return new FeatEligibilityEvaluation(characterEvaluation.Validation, null);
        }

        if (string.IsNullOrWhiteSpace(request.FeatId))
        {
            return InvalidReference("A feat id is required.", "Choose a feat from the active catalog.");
        }

        var feat = await catalog.GetItemAsync(CatalogCategory.Feats, request.FeatId, cancellationToken);
        if (feat is null)
        {
            return InvalidReference(
                "The selected feat is not in the active catalog.",
                "Choose a feat from the 2024 / SRD-5.2.1 catalog.");
        }
        if (feat.Feat is null || !string.Equals(
                feat.Category,
                CatalogCategory.Feats.ToSlug(),
                StringComparison.Ordinal))
        {
            throw new SrdProviderException("The selected feat did not provide canonical prerequisite facts.");
        }

        var selectedProgression = request.Character.ClassProgressions![0];
        var progression = await classProgressions.GetAsync(
            selectedProgression.Class!.Id!,
            cancellationToken);
        if (progression is null || !string.Equals(
                progression.Class.Id,
                selectedProgression.Class.Id,
                StringComparison.OrdinalIgnoreCase))
        {
            throw new SrdProviderException("The selected class did not provide a matching progression.");
        }

        var activeFeatures = ActiveFeatures(progression, selectedProgression);
        ValidationResult prerequisiteValidation;
        try
        {
            prerequisiteValidation = FeatEligibilityRules.Evaluate(
                feat.Feat,
                selectedProgression.Level,
                request.Character.Abilities!,
                activeFeatures);
        }
        catch (FeatEligibilityContentException exception)
        {
            throw new SrdProviderException(
                "The selected feat prerequisites did not match the supported canonical rule mapping.",
                exception);
        }

        var effectsSupported = FeatEffectManifest.Supports(feat.Id);
        var effectValidation = new ValidationResult([]);
        AbilityScores? resultingAbilities = null;
        if (effectsSupported)
        {
            try
            {
                FeatEffectManifest.Verify(feat);
            }
            catch (FeatEffectContentException exception)
            {
                throw new SrdProviderException(
                    "The selected feat did not match the supported typed effect manifest.",
                    exception);
            }

            var resolution = FeatEffectRules.ResolveAbilityScoreImprovement(
                request.Character.Abilities!,
                request.AbilityScoreImprovement);
            effectValidation = resolution.Validation;
            resultingAbilities = resolution.ResultingAbilities;
        }
        else if (request.AbilityScoreImprovement is not null)
        {
            effectValidation = new ValidationResult([
                new RuleViolation(
                    "character.feat.effect.unsupported",
                    "This feat does not use the Ability Score Improvement effect.",
                    "abilityScoreImprovement",
                    "error",
                    "Submit effects only for a feat with a matching typed implementation.")
            ]);
        }

        var validation = new ValidationResult(
            prerequisiteValidation.Violations.Concat(effectValidation.Violations).ToArray());
        return new FeatEligibilityEvaluation(
            validation,
            new FeatEligibilityResult(
                new ContentReference(feat.Id, feat.Name),
                feat.Feat.Type,
                feat.Feat.IsRepeatable,
                prerequisiteValidation.IsValid,
                effectsSupported,
                CanSelect: prerequisiteValidation.IsValid && effectsSupported && effectValidation.IsValid,
                resultingAbilities,
                effectsSupported ? FeatEffectManifest.Version : null));
    }

    private static IReadOnlyList<CatalogReference> ActiveFeatures(
        ClassProgressionDocument progression,
        ClassProgression selected)
    {
        var features = progression.Levels
            .Where(level => level.Level <= selected.Level)
            .SelectMany(level => level.Features)
            .ToList();

        if (selected.Subclass?.Id is { } subclassId)
        {
            var subclass = progression.Subclasses.Single(item => string.Equals(
                item.Subclass.Id,
                subclassId,
                StringComparison.OrdinalIgnoreCase));
            features.AddRange(subclass.Levels
                .Where(level => level.Level <= selected.Level)
                .SelectMany(level => level.Features));
        }

        return features
            .DistinctBy(feature => feature.Id, StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }

    private static FeatEligibilityEvaluation InvalidReference(string message, string requirement) => new(
        new ValidationResult([
            new RuleViolation(
                "character.feat.notFound",
                message,
                "featId",
                "error",
                requirement)
        ]),
        null);
}
