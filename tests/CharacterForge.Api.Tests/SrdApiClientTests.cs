using System.Net;
using System.Text;
using CharacterForge.Api.Features.Catalog;
using CharacterForge.Api.Infrastructure.Srd;
using Microsoft.Extensions.Logging.Abstractions;

namespace CharacterForge.Api.Tests;

public sealed class SrdApiClientTests
{
    [Fact]
    public async Task GetItem_MapsExternalClassWithoutLeakingProviderShape()
    {
        const string json = """
            {
              "index": "wizard",
              "name": "Wizard",
              "primary_ability": { "desc": "Intelligence", "ability_scores": [{ "index": "int", "name": "INT" }] },
              "hit_die": 6,
              "proficiencies": [{ "index": "daggers", "name": "Daggers" }],
              "saving_throws": [{ "index": "int", "name": "INT" }],
              "subclasses": [{ "index": "evoker", "name": "Evoker" }],
              "spellcasting": { "level": 1, "spellcasting_ability": { "index": "int", "name": "INT" } }
            }
            """;
        var client = CreateClient(_ => Json(json));

        var item = await client.GetItemAsync(CatalogCategory.Classes, "wizard", CancellationToken.None);

        Assert.NotNull(item);
        Assert.Equal("classes", item.Category);
        Assert.Contains(item.Attributes, attribute => attribute is { Label: "Hit Die", Value: "d6" });
        Assert.Contains(item.Sections, section => section.Title == "Subclasses");
    }

    [Fact]
    public async Task GetItem_ReturnsNullForMissingResource()
    {
        var client = CreateClient(_ => new HttpResponseMessage(HttpStatusCode.NotFound));

        var item = await client.GetItemAsync(CatalogCategory.Feats, "missing", CancellationToken.None);

        Assert.Null(item);
    }

    [Theory]
    [InlineData("\"A practical adventuring item.\"")]
    [InlineData("[\"A practical adventuring item.\", \"Handle with care.\"]")]
    public async Task GetEquipment_AcceptsDescriptionShapeUsedByProvider(string description)
    {
        var client = CreateClient(_ => Json($$"""
            {
              "index": "test-item",
              "name": "Test Item",
              "equipment_categories": [{ "index": "gear", "name": "Gear" }],
              "cost": { "quantity": 1, "unit": "gp" },
              "description": {{description}}
            }
            """));

        var item = await client.GetItemAsync(CatalogCategory.Equipment, "test-item", CancellationToken.None);

        Assert.NotNull(item);
        Assert.Contains("A practical adventuring item.", item.Description);
    }

    [Fact]
    public async Task GetItems_IntersectsClassAndSchoolSpellLists()
    {
        var client = CreateClient(request => request.RequestUri!.PathAndQuery switch
        {
            "/api/2024/classes/wizard/spells?level=3" => Json("""
                { "count": 2, "results": [
                  { "index": "fireball", "name": "Fireball", "level": 3 },
                  { "index": "fly", "name": "Fly", "level": 3 }
                ] }
                """),
            "/api/2024/spells?level=3&school=evocation" => Json("""
                { "count": 2, "results": [
                  { "index": "fireball", "name": "Fireball", "level": 3 },
                  { "index": "lightning-bolt", "name": "Lightning Bolt", "level": 3 }
                ] }
                """),
            _ => new HttpResponseMessage(HttpStatusCode.NotFound)
        });

        var items = await client.GetItemsAsync(
            CatalogCategory.Spells, 3, "evocation", "wizard", CancellationToken.None);

        var spell = Assert.Single(items);
        Assert.Equal("fireball", spell.Id);
    }

    [Fact]
    public async Task GetSpell_PreservesHigherLevelTextAsNamedSection()
    {
        var client = CreateClient(_ => Json("""
            {
              "index": "fireball",
              "name": "Fireball",
              "level": 3,
              "school": { "index": "evocation", "name": "Evocation" },
              "casting_time": "Action",
              "ritual": false,
              "range": "150 feet",
              "components": ["V", "S", "M"],
              "duration": "Instantaneous",
              "concentration": false,
              "description": "A bright streak flashes toward its target.",
              "higher_level": "The damage increases by 1d6."
            }
            """));

        var item = await client.GetItemAsync(CatalogCategory.Spells, "fireball", CancellationToken.None);

        Assert.NotNull(item);
        var section = Assert.Single(item.TextSections!);
        Assert.Equal("At Higher Levels", section.Title);
        Assert.Contains("The damage increases by 1d6.", section.Paragraphs);
    }

    [Fact]
    public async Task GetItems_RejectsMalformedProviderResponse()
    {
        var client = CreateClient(_ => Json("{ not-json"));

        await Assert.ThrowsAsync<SrdProviderException>(() =>
            client.GetItemsAsync(CatalogCategory.Classes, null, null, null, CancellationToken.None));
    }

    private static SrdApiClient CreateClient(Func<HttpRequestMessage, HttpResponseMessage> responseFactory)
    {
        var httpClient = new HttpClient(new StubHandler(responseFactory))
        {
            BaseAddress = new Uri("https://example.test/api/2024/")
        };
        return new SrdApiClient(httpClient, NullLogger<SrdApiClient>.Instance);
    }

    private static HttpResponseMessage Json(string content) => new(HttpStatusCode.OK)
    {
        Content = new StringContent(content, Encoding.UTF8, "application/json")
    };

    private sealed class StubHandler(Func<HttpRequestMessage, HttpResponseMessage> responseFactory)
        : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken) => Task.FromResult(responseFactory(request));
    }
}
