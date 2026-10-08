using System.Net;
using System.Net.Http.Json;
using CharacterForge.Api.Features.Catalog;
using CharacterForge.Api.Features.Progression;
using CharacterForge.Api.Infrastructure.Srd;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace CharacterForge.Api.Tests;

public sealed class ClassProgressionEndpointsTests : IDisposable
{
    private readonly ProgressionContentSource _source = new();
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    public ClassProgressionEndpointsTests()
    {
        _factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<ISrdContentSource>();
                services.AddSingleton<ISrdContentSource>(_source);
            });
        });
        _client = _factory.CreateClient();
    }

    [Fact]
    public async Task Get_ReturnsVersionedProgressionAndCachesNormalizedContent()
    {
        var firstResponse = await _client.GetAsync(
            "/api/classes/wizard/progression",
            CancellationToken.None);
        var first = await firstResponse.Content.ReadFromJsonAsync<ClassProgressionDocument>(
            cancellationToken: CancellationToken.None);
        var secondResponse = await _client.GetAsync(
            "/api/classes/wizard/progression",
            CancellationToken.None);
        var second = await secondResponse.Content.ReadFromJsonAsync<ClassProgressionDocument>(
            cancellationToken: CancellationToken.None);

        Assert.Equal(HttpStatusCode.OK, firstResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, secondResponse.StatusCode);
        Assert.NotNull(first?.Source);
        Assert.Equal("2024", first.Source.Ruleset);
        Assert.Equal("SRD-5.2.1", first.Source.RulesVersion);
        Assert.Equal(first.Source.FetchedAt, second?.Source?.FetchedAt);
        Assert.Equal(1, _source.ProgressionRequestCount);
        Assert.Equal(3, Assert.Single(first.Subclasses).AvailableAtLevel);
        Assert.Equal(2, Assert.Single(first.Spellcasting!.Levels).Slots[0].Count);
        Assert.Equal("SRD-5.2.1-SPELL-2", first.Spellcasting.Policy?.ManifestVersion);
        Assert.Equal("spellbook", first.Spellcasting.Policy?.PreparedSpellSource);
        Assert.Equal("standard", first.Spellcasting.Policy?.SlotPool);
    }

    [Fact]
    public async Task Get_ReturnsNotFoundForAnUnknownClass()
    {
        var response = await _client.GetAsync(
            "/api/classes/missing/progression",
            CancellationToken.None);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Get_RejectsAnInvalidClassIdBeforeCallingTheProvider()
    {
        var response = await _client.GetAsync(
            "/api/classes/Not%20Allowed/progression",
            CancellationToken.None);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(0, _source.ProgressionRequestCount);
    }

    [Fact]
    public async Task Get_ReturnsServiceUnavailableWhenTheProviderFails()
    {
        _source.ThrowProviderError = true;

        var response = await _client.GetAsync(
            "/api/classes/wizard/progression",
            CancellationToken.None);

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
    }

    public void Dispose()
    {
        _client.Dispose();
        _factory.Dispose();
    }

    private sealed class ProgressionContentSource : ISrdContentSource
    {
        public int ProgressionRequestCount { get; private set; }
        public bool ThrowProviderError { get; set; }

        public Task<ClassProgressionDocument?> GetClassProgressionAsync(
            string classId,
            CancellationToken cancellationToken)
        {
            ProgressionRequestCount++;
            if (ThrowProviderError)
            {
                throw new SrdProviderException("Unavailable in test.");
            }

            if (classId == "missing")
            {
                return Task.FromResult<ClassProgressionDocument?>(null);
            }

            return Task.FromResult<ClassProgressionDocument?>(new ClassProgressionDocument(
                new CatalogReference("wizard", "Wizard"),
                6,
                [
                    new ClassLevelProgression(
                        1,
                        2,
                        [new CatalogReference("wizard-spellcasting", "Spellcasting")])
                ],
                [
                    new SubclassProgression(
                        new CatalogReference("evoker", "Evoker"),
                        3,
                        [
                            new SubclassLevelProgression(
                                3,
                                [new CatalogReference("evocation-savant", "Evocation Savant")])
                        ])
                ],
                Spellcasting: new ClassSpellcastingProgression(
                    1,
                    new CatalogReference("int", "INT"),
                    [new ClassSpellcastingLevel(
                        1,
                        3,
                        4,
                        [new SpellSlotCapacity(1, 2)])])));
        }

        public Task<IReadOnlyList<CatalogItemSummary>> GetItemsAsync(
            CatalogCategory category,
            int? level,
            string? school,
            string? characterClass,
            CancellationToken cancellationToken) => throw new NotSupportedException();

        public Task<CatalogItemDetail?> GetItemAsync(
            CatalogCategory category,
            string id,
            CancellationToken cancellationToken) => throw new NotSupportedException();
    }
}
