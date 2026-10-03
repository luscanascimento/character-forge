using System.Text.RegularExpressions;
using CharacterForge.Api.Infrastructure.Srd;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace CharacterForge.Api.Features.Catalog;

public sealed partial class CatalogService(
    ISrdContentSource source,
    IMemoryCache cache,
    IOptions<SrdApiOptions> options)
{
    public async Task<CatalogPage> GetPageAsync(
        CatalogCategory category,
        CatalogQuery query,
        CancellationToken cancellationToken)
    {
        var cacheKey = $"catalog:list:{category}:{query.Level}:{query.School}:{query.CharacterClass}";
        var snapshot = await GetOrCreateAsync(
            cacheKey,
            token => source.GetItemsAsync(category, query.Level, query.School, query.CharacterClass, token),
            cancellationToken);

        IEnumerable<CatalogItemSummary> items = snapshot.Value;
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            items = items.Where(item => item.Name.Contains(query.Search, StringComparison.OrdinalIgnoreCase));
        }

        items = query.Sort == "level"
            ? items.OrderBy(item => item.Level ?? int.MaxValue).ThenBy(item => item.Name)
            : items.OrderBy(item => item.Name);

        var materialized = items.ToArray();
        var totalPages = materialized.Length == 0
            ? 0
            : (int)Math.Ceiling(materialized.Length / (double)query.PageSize);
        var pageItems = materialized
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToArray();

        return new CatalogPage(
            pageItems,
            query.Page,
            query.PageSize,
            materialized.Length,
            totalPages,
            CatalogSource.Create(snapshot.FetchedAt));
    }

    public async Task<CatalogItemDetail?> GetItemAsync(
        CatalogCategory category,
        string id,
        CancellationToken cancellationToken)
    {
        var snapshot = await GetOrCreateAsync(
            $"catalog:detail:{category}:{id}",
            token => source.GetItemAsync(category, id, token),
            cancellationToken);

        return snapshot.Value is null
            ? null
            : snapshot.Value with { Source = CatalogSource.Create(snapshot.FetchedAt) };
    }

    public static IReadOnlyDictionary<string, string[]> Validate(
        CatalogCategory category,
        CatalogRequest request,
        string? id = null)
    {
        var errors = new Dictionary<string, string[]>();
        if (request.Page is < 1)
        {
            errors[nameof(request.Page)] = ["Page must be at least 1."];
        }

        if (request.PageSize is < 1 or > 48)
        {
            errors[nameof(request.PageSize)] = ["Page size must be between 1 and 48."];
        }

        if (request.Search?.Length > 80)
        {
            errors[nameof(request.Search)] = ["Search must be 80 characters or fewer."];
        }

        if (request.Sort is not null and not ("name" or "level"))
        {
            errors[nameof(request.Sort)] = ["Sort must be 'name' or 'level'."];
        }

        if (request.Sort == "level" && category != CatalogCategory.Spells)
        {
            errors[nameof(request.Sort)] = ["Level sorting is only available for spells."];
        }

        if (request.Level is < 0 or > 9)
        {
            errors[nameof(request.Level)] = ["Spell level must be between 0 and 9."];
        }

        if (category != CatalogCategory.Spells &&
            (request.Level is not null || request.School is not null || request.CharacterClass is not null))
        {
            errors["filters"] = ["Level, school, and class filters are only available for spells."];
        }

        ValidateSlug(request.School, nameof(request.School), errors);
        ValidateSlug(request.CharacterClass, nameof(request.CharacterClass), errors);
        ValidateSlug(id, "id", errors);

        return errors;
    }

    private async Task<CatalogSnapshot<T>> GetOrCreateAsync<T>(
        string key,
        Func<CancellationToken, Task<T>> factory,
        CancellationToken cancellationToken)
    {
        var cached = cache.Get<CatalogSnapshot<T>>(key);
        if (cached is not null)
        {
            return cached;
        }

        var snapshot = new CatalogSnapshot<T>(await factory(cancellationToken), DateTimeOffset.UtcNow);
        cache.Set(key, snapshot, TimeSpan.FromMinutes(options.Value.CacheDurationMinutes));
        return snapshot;
    }

    private static void ValidateSlug(
        string? value,
        string key,
        IDictionary<string, string[]> errors)
    {
        if (value is not null && (value.Length > 80 || !SlugPattern().IsMatch(value)))
        {
            errors[key] = ["Use only lowercase letters, numbers, and hyphens."];
        }
    }

    [GeneratedRegex("^[a-z0-9]+(?:-[a-z0-9]+)*$", RegexOptions.CultureInvariant)]
    private static partial Regex SlugPattern();
}
