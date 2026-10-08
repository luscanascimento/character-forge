using System.Net;
using System.Net.Http.Json;
using CharacterForge.Api.Features.Catalog;
using CharacterForge.Api.Features.FeatureRules;
using CharacterForge.Api.Features.Progression;
using CharacterForge.Api.Infrastructure.Srd;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace CharacterForge.Api.Tests;

public sealed class FeatureRuleEndpointsTests : IDisposable
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    public FeatureRuleEndpointsTests()
    {
        _factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<ISrdContentSource>();
                services.AddSingleton<ISrdContentSource, FeatureRuleContentSource>();
            });
        });
        _client = _factory.CreateClient();
    }

    [Fact]
    public async Task Get_ReturnsManifestBackedFeatAndClassCantripOptions()
    {
        var response = await _client.GetAsync(
            "/api/classes/paladin/feature-choices",
            CancellationToken.None);
        var document = await response.Content.ReadFromJsonAsync<FeatureChoiceDocument>(
            cancellationToken: CancellationToken.None);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(document);
        Assert.Equal("SRD-5.2.1-CF-2", document.ManifestVersion);
        var requirement = Assert.Single(document.Requirements);
        Assert.Equal("paladin-fighting-style", requirement.Id);
        Assert.Collection(
            requirement.Branches,
            branch =>
            {
                Assert.Equal("supported", branch.Availability);
                Assert.Equal("featType", branch.OptionSource);
                Assert.Equal("archery", Assert.Single(branch.Options).Id);
            },
            branch =>
            {
                Assert.Equal("supported", branch.Availability);
                Assert.Equal("classCantrips", branch.OptionSource);
                Assert.Null(branch.Dependency);
                Assert.Equal(["guidance", "light"], branch.Options.Select(option => option.Id));
            });
    }

    [Fact]
    public async Task Get_RejectsInvalidClassIdBeforeProviderAccess()
    {
        var response = await _client.GetAsync(
            "/api/classes/Not%20Allowed/feature-choices",
            CancellationToken.None);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    public void Dispose()
    {
        _client.Dispose();
        _factory.Dispose();
    }

    private sealed class FeatureRuleContentSource : ISrdContentSource
    {
        public Task<ClassProgressionDocument?> GetClassProgressionAsync(
            string classId,
            CancellationToken cancellationToken)
        {
            if (classId != "paladin") return Task.FromResult<ClassProgressionDocument?>(null);

            return Task.FromResult<ClassProgressionDocument?>(new ClassProgressionDocument(
                new CatalogReference("paladin", "Paladin"),
                10,
                Enumerable.Range(1, 20)
                    .Select(level => new ClassLevelProgression(
                        level,
                        2 + ((level - 1) / 4),
                        level == 2
                            ? [new CatalogReference("paladin-fighting-style", "Fighting Style")]
                            : []))
                    .ToArray(),
                [],
                Spellcasting: new ClassSpellcastingProgression(
                    1,
                    new CatalogReference("cha", "CHA"),
                    [new ClassSpellcastingLevel(
                        1,
                        0,
                        2,
                        [new SpellSlotCapacity(1, 2)])])));
        }

        public Task<IReadOnlyList<CatalogItemSummary>> GetItemsAsync(
            CatalogCategory category,
            int? level,
            string? school,
            string? characterClass,
            CancellationToken cancellationToken) => Task.FromResult<IReadOnlyList<CatalogItemSummary>>(
                category == CatalogCategory.Feats
                    ? [new CatalogItemSummary("archery", "Archery", "feats")]
                    : category == CatalogCategory.Spells && level == 0 && characterClass == "cleric"
                        ?
                        [
                            new CatalogItemSummary("guidance", "Guidance", "spells", 0),
                            new CatalogItemSummary("light", "Light", "spells", 0)
                        ]
                        : []);

        public Task<CatalogItemDetail?> GetItemAsync(
            CatalogCategory category,
            string id,
            CancellationToken cancellationToken) => Task.FromResult<CatalogItemDetail?>(new CatalogItemDetail(
                "archery",
                "Archery",
                "feats",
                [],
                [],
                [],
                Feat: new CatalogFeatFacts(
                    "fighting-style",
                    MinimumLevel: null,
                    RequiredFeature: "Fighting Style",
                    IsRepeatable: false,
                    AbilityScorePrerequisite: null)));
    }
}
