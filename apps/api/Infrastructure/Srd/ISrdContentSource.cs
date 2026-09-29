using CharacterForge.Api.Features.Catalog;

namespace CharacterForge.Api.Infrastructure.Srd;

public interface ISrdContentSource
{
    Task<IReadOnlyList<CatalogItemSummary>> GetItemsAsync(
        CatalogCategory category,
        int? level,
        string? school,
        string? characterClass,
        CancellationToken cancellationToken);

    Task<CatalogItemDetail?> GetItemAsync(
        CatalogCategory category,
        string id,
        CancellationToken cancellationToken);
}
