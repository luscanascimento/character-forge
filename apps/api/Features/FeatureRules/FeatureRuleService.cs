using CharacterForge.Api.Features.Catalog;
using CharacterForge.Api.Features.Characters;
using CharacterForge.Api.Features.Progression;
using CharacterForge.Api.Infrastructure.Srd;

namespace CharacterForge.Api.Features.FeatureRules;

public sealed class FeatureRuleService(
    ClassProgressionService classProgressions,
    CatalogService catalog)
{
    public async Task<FeatureChoiceDocument?> GetAsync(
        string classId,
        CancellationToken cancellationToken)
    {
        var progression = await classProgressions.GetAsync(classId, cancellationToken);
        if (progression is null)
        {
            return null;
        }

        IReadOnlyList<FeatureChoiceRequirement> requirements;
        try
        {
            requirements = FeatureRuleManifest.GetVerifiedRequirements(progression);
        }
        catch (FeatureRuleContentException exception)
        {
            throw new SrdProviderException(
                "The class progression did not agree with the active feature-rule manifest.",
                exception);
        }
        var featOptions = requirements.Count == 0
            ? []
            : await GetFeatOptionsAsync(requirements, cancellationToken);

        return new FeatureChoiceDocument(
            FeatureRuleManifest.Version,
            FeatureRuleManifest.Ruleset,
            FeatureRuleManifest.RulesVersion,
            new ContentReference(progression.Class.Id, progression.Class.Name),
            requirements.Select(requirement => new FeatureChoiceRequirementDocument(
                requirement.Id,
                requirement.SubclassId,
                requirement.FeatureId,
                requirement.AvailableAtLevel,
                requirement.Count,
                requirement.Branches.Select(branch => new FeatureChoiceBranchDocument(
                    branch.Id,
                    branch.SelectionCount,
                    branch.Availability.ToString().ToLowerInvariant(),
                    branch.Dependency?.ToString().ToLowerInvariant(),
                    branch.Availability == FeatureChoiceAvailability.Supported
                        ? featOptions
                            .Where(feat => FeatureRuleManifest.MatchesFeatOption(branch, feat))
                            .Select(feat => new ContentReference(feat.Id, feat.Name))
                            .OrderBy(option => option.Name, StringComparer.OrdinalIgnoreCase)
                            .ToArray()
                        : [])).ToArray())).ToArray());
    }

    private async Task<CatalogItemDetail[]> GetFeatOptionsAsync(
        IReadOnlyList<FeatureChoiceRequirement> requirements,
        CancellationToken cancellationToken)
    {
        var page = await catalog.GetPageAsync(
            CatalogCategory.Feats,
            new CatalogQuery(null, 1, int.MaxValue, "name", null, null, null),
            cancellationToken);
        var details = await Task.WhenAll(page.Items.Select(item =>
            catalog.GetItemAsync(CatalogCategory.Feats, item.Id, cancellationToken)));

        if (details.Any(detail => detail is null))
        {
            throw new SrdProviderException("The feat catalog list and detail resources did not agree.");
        }

        var feats = details.Cast<CatalogItemDetail>().ToArray();
        foreach (var branch in requirements
            .SelectMany(requirement => requirement.Branches)
            .Where(branch => branch.Availability == FeatureChoiceAvailability.Supported))
        {
            var matches = feats.Where(feat => FeatureRuleManifest.MatchesFeatOption(branch, feat)).ToArray();
            if (matches.Length == 0)
            {
                throw new SrdProviderException(
                    $"The feat catalog provided no options for feature-rule branch '{branch.Id}'.");
            }

            foreach (var match in matches)
            {
                FeatureRuleManifest.VerifyFeatOption(branch, match);
            }
        }

        return feats;
    }
}
