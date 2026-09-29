using CharacterForge.Api.Features.Catalog;
using CharacterForge.Api.Infrastructure.Srd;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace CharacterForge.Api.Tests;

public sealed class CatalogServiceTests
{
    [Fact]
    public async Task RepeatedListQuery_UsesNormalizedMemoryCache()
    {
        var source = new CountingContentSource();
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var service = new CatalogService(
            source,
            cache,
            Options.Create(new SrdApiOptions { CacheDurationMinutes = 60 }));
        var query = new CatalogQuery(null, 1, 24, "name", null, null, null);

        var first = await service.GetPageAsync(CatalogCategory.Classes, query, CancellationToken.None);
        var second = await service.GetPageAsync(CatalogCategory.Classes, query, CancellationToken.None);

        Assert.Equal(1, source.ListRequestCount);
        Assert.Equal(first.Source.FetchedAt, second.Source.FetchedAt);
        Assert.Equal(first.Items, second.Items);
    }

    private sealed class CountingContentSource : ISrdContentSource
    {
        public int ListRequestCount { get; private set; }

        public Task<IReadOnlyList<CatalogItemSummary>> GetItemsAsync(
            CatalogCategory category,
            int? level,
            string? school,
            string? characterClass,
            CancellationToken cancellationToken)
        {
            ListRequestCount++;
            IReadOnlyList<CatalogItemSummary> items =
                [new("wizard", "Wizard", CatalogCategory.Classes.ToSlug())];
            return Task.FromResult(items);
        }

        public Task<CatalogItemDetail?> GetItemAsync(
            CatalogCategory category,
            string id,
            CancellationToken cancellationToken) => throw new NotSupportedException();
    }
}
