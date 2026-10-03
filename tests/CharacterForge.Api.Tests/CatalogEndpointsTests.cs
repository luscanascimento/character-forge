using System.Net;
using System.Net.Http.Json;
using CharacterForge.Api.Features.Catalog;
using CharacterForge.Api.Infrastructure.Srd;
using CharacterForge.Api.Features.Progression;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace CharacterForge.Api.Tests;

public sealed class CatalogEndpointsTests : IDisposable
{
    private readonly StubSrdContentSource _source = new();
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    public CatalogEndpointsTests()
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
    public async Task List_FiltersAndPaginatesNormalizedEntries()
    {
        var response = await _client.GetAsync(
            "/api/catalog/classes?search=wiz&page=1&pageSize=1",
            CancellationToken.None);
        var page = await response.Content.ReadFromJsonAsync<CatalogPage>(cancellationToken: CancellationToken.None);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(page);
        Assert.Equal("SRD-5.2.1", page.Source.RulesVersion);
        Assert.Equal("Wizard", Assert.Single(page.Items).Name);
    }

    [Fact]
    public async Task Detail_ReturnsNotFoundProblemForUnknownEntry()
    {
        var response = await _client.GetAsync("/api/catalog/classes/missing", CancellationToken.None);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task List_ReturnsValidationProblemForSpellFilterOnClassCatalog()
    {
        var response = await _client.GetAsync("/api/catalog/classes?level=3", CancellationToken.None);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task ProviderFailure_ReturnsPredictableServiceUnavailableProblem()
    {
        _source.ThrowProviderError = true;

        var response = await _client.GetAsync("/api/catalog/species", CancellationToken.None);

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Equal("30", response.Headers.RetryAfter?.Delta?.TotalSeconds.ToString() ??
            response.Headers.GetValues("Retry-After").Single());
    }

    public void Dispose()
    {
        _client.Dispose();
        _factory.Dispose();
    }

    private sealed class StubSrdContentSource : ISrdContentSource
    {
        public bool ThrowProviderError { get; set; }

        public Task<IReadOnlyList<CatalogItemSummary>> GetItemsAsync(
            CatalogCategory category,
            int? level,
            string? school,
            string? characterClass,
            CancellationToken cancellationToken)
        {
            if (ThrowProviderError)
            {
                throw new SrdProviderException("Unavailable in test.");
            }

            IReadOnlyList<CatalogItemSummary> items =
            [
                new("fighter", "Fighter", category.ToSlug()),
                new("wizard", "Wizard", category.ToSlug())
            ];
            return Task.FromResult(items);
        }

        public Task<CatalogItemDetail?> GetItemAsync(
            CatalogCategory category,
            string id,
            CancellationToken cancellationToken) => Task.FromResult<CatalogItemDetail?>(id == "missing"
                ? null
                : new CatalogItemDetail(id, "Wizard", category.ToSlug(), [], [], []));

        public Task<ClassProgressionDocument?> GetClassProgressionAsync(
            string classId,
            CancellationToken cancellationToken) => throw new NotSupportedException();
    }
}
