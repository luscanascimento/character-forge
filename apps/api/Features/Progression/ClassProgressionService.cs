using CharacterForge.Api.Features.Catalog;
using CharacterForge.Api.Infrastructure.Srd;
using CharacterForge.Api.Features.Spellcasting;
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

        if (snapshot.Value is null)
        {
            return null;
        }

        var progression = snapshot.Value with
        {
            Source = CatalogSource.Create(snapshot.FetchedAt)
        };
        SpellcastingPolicyDocument? policy;
        try
        {
            policy = SpellcastingRuleManifest.GetVerifiedPolicy(progression);
        }
        catch (SpellcastingRuleContentException exception)
        {
            throw new SrdProviderException(
                "The class progression did not agree with the active spellcasting-rule manifest.",
                exception);
        }

        return progression.Spellcasting is null
            ? progression
            : progression with
            {
                Spellcasting = progression.Spellcasting with { Policy = policy }
            };
    }

    private sealed record ProgressionSnapshot(
        ClassProgressionDocument? Value,
        DateTimeOffset FetchedAt);
}
