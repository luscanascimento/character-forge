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
        var featRequirements = requirements
            .Where(requirement => requirement.Branches.Any(branch =>
                branch.OptionSource.Kind == FeatureOptionSourceKind.FeatType))
            .ToArray();
        var featOptions = featRequirements.Length == 0
            ? []
            : await GetFeatOptionsAsync(featRequirements, cancellationToken);
        var cantripBranches = requirements
            .SelectMany(requirement => requirement.Branches)
            .Where(branch =>
                branch.Availability == FeatureChoiceAvailability.Supported &&
                branch.OptionSource.Kind == FeatureOptionSourceKind.ClassCantrips)
            .ToArray();
        var cantripOptions = cantripBranches.Length == 0
            ? new Dictionary<string, IReadOnlyList<ContentReference>>(StringComparer.OrdinalIgnoreCase)
            : await GetClassCantripOptionsAsync(cantripBranches, cancellationToken);

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
                    OptionSourceContract(branch.OptionSource.Kind),
                    branch.Availability.ToString().ToLowerInvariant(),
                    branch.Dependency?.ToString().ToLowerInvariant(),
                    branch.Availability == FeatureChoiceAvailability.Supported
                        ? branch.OptionSource.Kind switch
                        {
                            FeatureOptionSourceKind.FeatType => featOptions
                            .Where(feat => FeatureRuleManifest.MatchesFeatOption(branch, feat))
                            .Select(feat => new ContentReference(feat.Id, feat.Name))
                            .OrderBy(option => option.Name, StringComparer.OrdinalIgnoreCase)
                            .ToArray(),
                            FeatureOptionSourceKind.ClassCantrips => cantripOptions[branch.Id],
                            _ => []
                        }
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
            .Where(branch =>
                branch.Availability == FeatureChoiceAvailability.Supported
                && branch.OptionSource.Kind == FeatureOptionSourceKind.FeatType))
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

    private async Task<Dictionary<string, IReadOnlyList<ContentReference>>> GetClassCantripOptionsAsync(
        IReadOnlyList<FeatureChoiceBranch> branches,
        CancellationToken cancellationToken)
    {
        var pages = await Task.WhenAll(branches
            .Select(branch => branch.OptionSource.Filter)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Select(async classId => (
                ClassId: classId,
                Page: await catalog.GetPageAsync(
                    CatalogCategory.Spells,
                    new CatalogQuery(null, 1, int.MaxValue, "name", 0, null, classId),
                    cancellationToken))));
        var pagesByClass = pages.ToDictionary(
            result => result.ClassId,
            result => result.Page,
            StringComparer.OrdinalIgnoreCase);
        var options = new Dictionary<string, IReadOnlyList<ContentReference>>(StringComparer.OrdinalIgnoreCase);

        foreach (var branch in branches)
        {
            var spells = pagesByClass[branch.OptionSource.Filter].Items;
            if (spells.Count < branch.SelectionCount ||
                spells.Select(spell => spell.Id).Distinct(StringComparer.OrdinalIgnoreCase).Count() != spells.Count)
            {
                throw new SrdProviderException(
                    $"The spell catalog did not provide enough distinct options for feature-rule branch '{branch.Id}'.");
            }

            foreach (var spell in spells)
            {
                FeatureRuleManifest.VerifyCantripOption(branch, spell);
            }

            options[branch.Id] = spells
                .Select(spell => new ContentReference(spell.Id, spell.Name))
                .OrderBy(option => option.Name, StringComparer.OrdinalIgnoreCase)
                .ToArray();
        }

        return options;
    }

    private static string OptionSourceContract(FeatureOptionSourceKind kind) => kind switch
    {
        FeatureOptionSourceKind.FeatType => "featType",
        FeatureOptionSourceKind.ClassCantrips => "classCantrips",
        FeatureOptionSourceKind.ProficientSkills => "proficientSkills",
        _ => throw new FeatureRuleContentException($"Unknown feature option source '{kind}'.")
    };
}
