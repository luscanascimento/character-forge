using CharacterForge.Api.Features.Catalog;
using CharacterForge.Api.Features.Progression;
using CharacterForge.Api.Infrastructure.Srd;

namespace CharacterForge.Api.Features.Characters;

public sealed record FeatEligibilityRequest(Character Character, string? FeatId);

public sealed record FeatEligibilityResult(
    ContentReference Feat,
    string Type,
    bool IsRepeatable,
    bool MeetsPrerequisites,
    bool EffectsSupported,
    bool CanSelect);

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
        ValidationResult validation;
        try
        {
            validation = FeatEligibilityRules.Evaluate(
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

        // Phase 7 does not authorize general feat persistence until each effect is typed.
        const bool effectsSupported = false;
        return new FeatEligibilityEvaluation(
            validation,
            new FeatEligibilityResult(
                new ContentReference(feat.Id, feat.Name),
                feat.Feat.Type,
                feat.Feat.IsRepeatable,
                validation.IsValid,
                effectsSupported,
                CanSelect: validation.IsValid && effectsSupported));
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
