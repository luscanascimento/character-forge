using CharacterForge.Api.Features.Catalog;
using CharacterForge.Api.Infrastructure.Srd;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace CharacterForge.Api.Features.Progression;

public sealed class ClassProgressionService(
    ISrdContentSource source,
    IMemoryCache cache,
    IOptions<SrdApiOptions> options)
{
    public async Task<ClassProgressionDocument?> GetAsync(
        string classId,
        CancellationToken cancellationToken)
    {
        var key = $"progression:class:{classId}";
        var snapshot = cache.Get<ProgressionSnapshot>(key);
        if (snapshot is null)
        {
            snapshot = new(
                await source.GetClassProgressionAsync(classId, cancellationToken),
                DateTimeOffset.UtcNow);
            cache.Set(key, snapshot, TimeSpan.FromMinutes(options.Value.CacheDurationMinutes));
        }

        return snapshot.Value is null
            ? null
            : snapshot.Value with { Source = CatalogSource.Create(snapshot.FetchedAt) };
    }

    private sealed record ProgressionSnapshot(
        ClassProgressionDocument? Value,
        DateTimeOffset FetchedAt);
}
