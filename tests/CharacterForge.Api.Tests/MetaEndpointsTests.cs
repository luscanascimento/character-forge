using System.Net;
using System.Net.Http.Json;
using CharacterForge.Api.Features.Meta;
using Microsoft.AspNetCore.Mvc.Testing;

namespace CharacterForge.Api.Tests;

public sealed class MetaEndpointsTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public MetaEndpointsTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task GetMeta_ReturnsActiveRuleset()
    {
        var response = await _client.GetAsync("/api/meta", CancellationToken.None);
        var metadata = await response.Content.ReadFromJsonAsync<AppMetadata>(
            cancellationToken: CancellationToken.None);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(metadata);
        Assert.Equal("2024", metadata.Ruleset);
        Assert.Equal("SRD-5.2.1", metadata.RulesVersion);
        Assert.Equal("ready", metadata.Status);
    }

    [Fact]
    public async Task Health_ReturnsHealthy()
    {
        var response = await _client.GetAsync("/health", CancellationToken.None);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Responses_IncludeSecurityHeaders()
    {
        var response = await _client.GetAsync("/api/meta", CancellationToken.None);

        Assert.Equal("nosniff", response.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.Equal("DENY", response.Headers.GetValues("X-Frame-Options").Single());
    }
}
