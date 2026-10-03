using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using CharacterForge.Api.Features.Catalog;
using CharacterForge.Api.Features.Progression;

namespace CharacterForge.Api.Infrastructure.Srd;

public sealed class SrdApiClient(HttpClient httpClient, ILogger<SrdApiClient> logger) : ISrdContentSource
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<IReadOnlyList<CatalogItemSummary>> GetItemsAsync(
        CatalogCategory category,
        int? level,
        string? school,
        string? characterClass,
        CancellationToken cancellationToken)
    {
        if (category != CatalogCategory.Spells)
        {
            var result = await GetRequiredAsync<SrdListResponse>(category.ToSlug(), cancellationToken);
            return MapSummaries(result, category);
        }

        return await GetSpellsAsync(level, school, characterClass, cancellationToken);
    }

    public async Task<CatalogItemDetail?> GetItemAsync(
        CatalogCategory category,
        string id,
        CancellationToken cancellationToken)
    {
        var path = $"{category.ToSlug()}/{Uri.EscapeDataString(id)}";

        return category switch
        {
            CatalogCategory.Classes => Map(await GetOptionalAsync<SrdClassDetail>(path, cancellationToken), SrdCatalogMapper.Map),
            CatalogCategory.Species => await GetSpeciesAsync(path, cancellationToken),
            CatalogCategory.Backgrounds => Map(await GetOptionalAsync<SrdBackgroundDetail>(path, cancellationToken), SrdCatalogMapper.Map),
            CatalogCategory.Feats => Map(await GetOptionalAsync<SrdFeatDetail>(path, cancellationToken), SrdCatalogMapper.Map),
            CatalogCategory.Spells => Map(await GetOptionalAsync<SrdSpellDetail>(path, cancellationToken), SrdCatalogMapper.Map),
            CatalogCategory.Equipment => Map(await GetOptionalAsync<SrdEquipmentDetail>(path, cancellationToken), SrdCatalogMapper.Map),
            _ => throw new ArgumentOutOfRangeException(nameof(category), category, null)
        };
    }

    public async Task<ClassProgressionDocument?> GetClassProgressionAsync(
        string classId,
        CancellationToken cancellationToken)
    {
        var escapedClassId = Uri.EscapeDataString(classId);
        var characterClass = await GetOptionalAsync<SrdClassDetail>(
            $"classes/{escapedClassId}",
            cancellationToken);
        if (characterClass is null)
        {
            return null;
        }

        var levelsTask = GetRequiredAsync<SrdClassLevel[]>(
            $"classes/{escapedClassId}/levels",
            cancellationToken);
        var subclassTasks = (characterClass.Subclasses ?? [])
            .DistinctBy(subclass => subclass.Index, StringComparer.OrdinalIgnoreCase)
            .Select(async subclass => new SrdSubclassProgression(
                subclass,
                await GetRequiredAsync<SrdSubclassLevel[]>(
                    $"subclasses/{Uri.EscapeDataString(subclass.Index)}/levels",
                    cancellationToken)))
            .ToArray();

        var levels = await levelsTask;
        var subclasses = await Task.WhenAll(subclassTasks);
        return SrdProgressionMapper.Map(
            characterClass,
            levels,
            subclasses);
    }

    private async Task<CatalogItemDetail?> GetSpeciesAsync(
        string path,
        CancellationToken cancellationToken)
    {
        var species = await GetOptionalAsync<SrdSpeciesDetail>(path, cancellationToken);
        if (species is null)
        {
            return null;
        }

        var traitTasks = (species.Traits ?? [])
            .Select(trait => GetRequiredAsync<SrdTraitDetail>(
                $"traits/{Uri.EscapeDataString(trait.Index)}",
                cancellationToken))
            .ToArray();
        var traits = await Task.WhenAll(traitTasks);

        return SrdCatalogMapper.Map(species, traits);
    }

    private async Task<IReadOnlyList<CatalogItemSummary>> GetSpellsAsync(
        int? level,
        string? school,
        string? characterClass,
        CancellationToken cancellationToken)
    {
        var rootPath = BuildSpellPath("spells", level, school);
        if (characterClass is null)
        {
            return MapSummaries(
                await GetRequiredAsync<SrdListResponse>(rootPath, cancellationToken),
                CatalogCategory.Spells);
        }

        var classPath = BuildSpellPath(
            $"classes/{Uri.EscapeDataString(characterClass)}/spells",
            level,
            school: null);

        if (school is null)
        {
            return MapSummaries(
                await GetRequiredAsync<SrdListResponse>(classPath, cancellationToken),
                CatalogCategory.Spells);
        }

        var classTask = GetRequiredAsync<SrdListResponse>(classPath, cancellationToken);
        var schoolTask = GetRequiredAsync<SrdListResponse>(rootPath, cancellationToken);
        await Task.WhenAll(classTask, schoolTask);
        var classResult = await classTask;
        var schoolResult = await schoolTask;

        var allowedIds = schoolResult.Results
            .Select(item => item.Index)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var intersection = classResult with
        {
            Results = classResult.Results.Where(item => allowedIds.Contains(item.Index)).ToArray()
        };

        return MapSummaries(intersection, CatalogCategory.Spells);
    }

    private static string BuildSpellPath(string path, int? level, string? school)
    {
        var query = new List<string>();
        if (level is not null)
        {
            query.Add($"level={level.Value}");
        }

        if (school is not null)
        {
            query.Add($"school={Uri.EscapeDataString(school)}");
        }

        return query.Count == 0 ? path : $"{path}?{string.Join('&', query)}";
    }

    private static IReadOnlyList<CatalogItemSummary> MapSummaries(
        SrdListResponse response,
        CatalogCategory category)
    {
        if (response.Results is null)
        {
            throw new SrdProviderException("The SRD provider returned a list without results.");
        }

        return response.Results
            .Where(item => !string.IsNullOrWhiteSpace(item.Index) && !string.IsNullOrWhiteSpace(item.Name))
            .Select(item => new CatalogItemSummary(item.Index, item.Name, category.ToSlug(), item.Level))
            .ToArray();
    }

    private async Task<T> GetRequiredAsync<T>(string path, CancellationToken cancellationToken)
        where T : class => await GetOptionalAsync<T>(path, cancellationToken)
            ?? throw new SrdProviderException($"The SRD provider did not contain the expected resource at '{path}'.");

    private async Task<T?> GetOptionalAsync<T>(string path, CancellationToken cancellationToken)
        where T : class
    {
        try
        {
            using var response = await httpClient.GetAsync(path, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            if (response.StatusCode == HttpStatusCode.NotFound)
            {
                return null;
            }

            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("SRD request to {Path} failed with status {StatusCode}", path, response.StatusCode);
                throw new SrdProviderException($"The SRD provider returned HTTP {(int)response.StatusCode}.");
            }

            var result = await response.Content.ReadFromJsonAsync<T>(JsonOptions, cancellationToken);
            return result ?? throw new SrdProviderException("The SRD provider returned an empty response.");
        }
        catch (OperationCanceledException exception) when (!cancellationToken.IsCancellationRequested)
        {
            throw new SrdProviderException("The SRD provider timed out.", exception);
        }
        catch (HttpRequestException exception)
        {
            throw new SrdProviderException("The SRD provider could not be reached.", exception);
        }
        catch (JsonException exception)
        {
            throw new SrdProviderException("The SRD provider returned an invalid response.", exception);
        }
    }

    private static CatalogItemDetail? Map<T>(T? value, Func<T, CatalogItemDetail> mapper)
        where T : class => value is null ? null : mapper(value);
}
