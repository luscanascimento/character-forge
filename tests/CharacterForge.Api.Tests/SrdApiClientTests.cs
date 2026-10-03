using System.Net;
using System.Text;
using CharacterForge.Api.Features.Catalog;
using CharacterForge.Api.Features.Progression;
using CharacterForge.Api.Infrastructure.Srd;
using Microsoft.Extensions.Logging.Abstractions;

namespace CharacterForge.Api.Tests;

public sealed class SrdApiClientTests
{
    [Fact]
    public async Task GetClassProgression_NormalizesLevelsAndSubclassAvailability()
    {
        var client = CreateClient(request => request.RequestUri!.PathAndQuery switch
        {
            "/api/2024/classes/wizard" => Json("""
                {
                  "index": "wizard",
                  "name": "Wizard",
                  "hit_die": 6,
                  "subclasses": [{ "index": "evoker", "name": "Evoker" }]
                }
                """),
            "/api/2024/classes/wizard/levels" => Json(ClassLevelsJson("wizard")),
            "/api/2024/subclasses/evoker/levels" => Json("""
                [
                  {
                    "level": 6,
                    "class": { "index": "wizard", "name": "Wizard" },
                    "subclass": { "index": "evoker", "name": "Evoker" },
                    "features": [{ "index": "sculpt-spells", "name": "Sculpt Spells" }]
                  },
                  {
                    "level": 3,
                    "class": { "index": "wizard", "name": "Wizard" },
                    "subclass": { "index": "evoker", "name": "Evoker" },
                    "features": [{ "index": "evocation-savant", "name": "Evocation Savant" }]
                  }
                ]
                """),
            _ => new HttpResponseMessage(HttpStatusCode.NotFound)
        });

        var progression = await client.GetClassProgressionAsync("wizard", CancellationToken.None);

        Assert.NotNull(progression);
        Assert.Equal(new CatalogReference("wizard", "Wizard"), progression.Class);
        Assert.Equal(6, progression.HitDie);
        Assert.Equal(20, progression.Levels.Count);
        Assert.Equal(3, progression.Levels.Single(level => level.Level == 5).ProficiencyBonus);
        Assert.Contains(
            progression.Levels[0].Features,
            feature => feature == new CatalogReference("wizard-spellcasting", "Spellcasting"));
        var subclass = Assert.Single(progression.Subclasses);
        Assert.Equal(3, subclass.AvailableAtLevel);
        Assert.Equal([3, 6], subclass.Levels.Select(level => level.Level));
        Assert.Null(progression.Source);
    }

    [Fact]
    public async Task GetClassProgression_RejectsAnIncompleteLevelTable()
    {
        var client = CreateClient(request => request.RequestUri!.PathAndQuery switch
        {
            "/api/2024/classes/wizard" => Json("""
                { "index": "wizard", "name": "Wizard", "hit_die": 6 }
                """),
            "/api/2024/classes/wizard/levels" => Json("""
                [{ "level": 1, "prof_bonus": 2, "features": [] }]
                """),
            _ => new HttpResponseMessage(HttpStatusCode.NotFound)
        });

        await Assert.ThrowsAsync<SrdProviderException>(() =>
            client.GetClassProgressionAsync("wizard", CancellationToken.None));
    }

    [Fact]
    public async Task GetClassProgression_RejectsAProficiencyBonusThatDisagreesWithCanonicalRules()
    {
        var client = CreateClient(request => request.RequestUri!.PathAndQuery switch
        {
            "/api/2024/classes/wizard" => Json("""
                { "index": "wizard", "name": "Wizard", "hit_die": 6 }
                """),
            "/api/2024/classes/wizard/levels" => Json(ClassLevelsJson(
                "wizard",
                level => level == 5 ? 2 : 2 + ((level - 1) / 4))),
            _ => new HttpResponseMessage(HttpStatusCode.NotFound)
        });

        await Assert.ThrowsAsync<SrdProviderException>(() =>
            client.GetClassProgressionAsync("wizard", CancellationToken.None));
    }

    [Fact]
    public async Task GetClassProgression_ReturnsNullWithoutRequestingLevelsForAMissingClass()
    {
        var requests = 0;
        var client = CreateClient(_ =>
        {
            requests++;
            return new HttpResponseMessage(HttpStatusCode.NotFound);
        });

        var progression = await client.GetClassProgressionAsync("missing", CancellationToken.None);

        Assert.Null(progression);
        Assert.Equal(1, requests);
    }

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
              "proficiency_choices": [{
                "desc": "Choose 1: Arcana or History",
                "choose": 1,
                "type": "proficiencies",
                "from": {
                  "option_set_type": "options_array",
                  "options": [
                    {
                      "option_type": "reference",
                      "item": {
                        "index": "skill-arcana",
                        "name": "Skill: Arcana",
                        "url": "/api/2024/proficiencies/skill-arcana"
                      }
                    },
                    {
                      "option_type": "reference",
                      "item": {
                        "index": "skill-history",
                        "name": "Skill: History",
                        "url": "/api/2024/proficiencies/skill-history"
                      }
                    }
                  ]
                }
              }],
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
        Assert.NotNull(item.CharacterCreation);
        Assert.Equal(6, item.CharacterCreation.HitDie);
        Assert.Contains(
            item.CharacterCreation.GrantedProficiencies,
            proficiency => proficiency.Id == "daggers");
        var choice = Assert.Single(item.CharacterCreation.ProficiencyChoices);
        Assert.Equal("classes/wizard/proficiencies/0", choice.Id);
        Assert.Equal(1, choice.Count);
        Assert.Equal(["skill-arcana", "skill-history"], choice.Options.Select(option => option.Id));
    }

    [Fact]
    public async Task GetItem_ReturnsNullForMissingResource()
    {
        var client = CreateClient(_ => new HttpResponseMessage(HttpStatusCode.NotFound));

        var item = await client.GetItemAsync(CatalogCategory.Feats, "missing", CancellationToken.None);

        Assert.Null(item);
    }

    [Fact]
    public async Task GetBackground_PreservesMachineReadableProficiencyFacts()
    {
        const string json = """
            {
              "index": "acolyte",
              "name": "Acolyte",
              "ability_scores": [{ "index": "int", "name": "INT" }],
              "feat": { "index": "magic-initiate", "name": "Magic Initiate" },
              "proficiencies": [
                { "index": "skill-insight", "name": "Skill: Insight" },
                { "index": "tool-calligraphers-supplies", "name": "Tool: Calligrapher's Supplies" }
              ]
            }
            """;
        var client = CreateClient(_ => Json(json));

        var item = await client.GetItemAsync(CatalogCategory.Backgrounds, "acolyte", CancellationToken.None);

        Assert.NotNull(item?.CharacterCreation);
        Assert.Null(item.CharacterCreation.HitDie);
        Assert.Equal(
            ["skill-insight", "tool-calligraphers-supplies"],
            item.CharacterCreation.GrantedProficiencies.Select(proficiency => proficiency.Id));
    }

    [Fact]
    public async Task GetSpecies_ResolvesTraitProficiencyChoiceAndNormalizesSkillIds()
    {
        var client = CreateClient(request => request.RequestUri!.PathAndQuery switch
        {
            "/api/2024/species/elf" => Json("""
                {
                  "index": "elf",
                  "name": "Elf",
                  "type": "Humanoid",
                  "size": "Medium",
                  "speed": 30,
                  "traits": [{ "index": "keen-senses", "name": "Keen Senses" }]
                }
                """),
            "/api/2024/traits/keen-senses" => Json("""
                {
                  "index": "keen-senses",
                  "name": "Keen Senses",
                  "proficiency_choices": {
                    "desc": "Choose Insight or Perception",
                    "choose": 1,
                    "type": "proficiencies",
                    "from": {
                      "option_set_type": "options_array",
                      "options": [
                        {
                          "option_type": "reference",
                          "item": {
                            "index": "insight",
                            "name": "Insight",
                            "url": "/api/2024/skills/insight"
                          }
                        },
                        {
                          "option_type": "reference",
                          "item": {
                            "index": "perception",
                            "name": "Perception",
                            "url": "/api/2024/skills/perception"
                          }
                        }
                      ]
                    }
                  }
                }
                """),
            _ => new HttpResponseMessage(HttpStatusCode.NotFound)
        });

        var item = await client.GetItemAsync(CatalogCategory.Species, "elf", CancellationToken.None);

        Assert.NotNull(item?.CharacterCreation);
        var choice = Assert.Single(item.CharacterCreation.ProficiencyChoices);
        Assert.Equal("species/elf/traits/keen-senses/proficiencies/0", choice.Id);
        Assert.Equal(["skill-insight", "skill-perception"], choice.Options.Select(option => option.Id));
        Assert.All(choice.Options, option => Assert.StartsWith("Skill: ", option.Name));
    }

    [Fact]
    public async Task GetClass_FlattensNestedProficiencyChoiceFamilies()
    {
        const string json = """
            {
              "index": "monk",
              "name": "Monk",
              "hit_die": 8,
              "proficiency_choices": [{
                "desc": "Choose an artisan tool or musical instrument",
                "choose": 1,
                "type": "proficiencies",
                "from": {
                  "option_set_type": "options_array",
                  "options": [
                    {
                      "option_type": "choice",
                      "choice": {
                        "desc": "Artisan tools",
                        "choose": 1,
                        "type": "proficiencies",
                        "from": {
                          "option_set_type": "options_array",
                          "options": [{
                            "option_type": "reference",
                            "item": {
                              "index": "carpenters-tools",
                              "name": "Carpenter's Tools",
                              "url": "/api/2024/proficiencies/tool-carpenters-tools"
                            }
                          }]
                        }
                      }
                    },
                    {
                      "option_type": "choice",
                      "choice": {
                        "desc": "Musical instruments",
                        "choose": 1,
                        "type": "proficiencies",
                        "from": {
                          "option_set_type": "options_array",
                          "options": [{
                            "option_type": "reference",
                            "item": {
                              "index": "flute",
                              "name": "Flute",
                              "url": "/api/2024/proficiencies/flute"
                            }
                          }]
                        }
                      }
                    }
                  ]
                }
              }]
            }
            """;
        var client = CreateClient(_ => Json(json));

        var item = await client.GetItemAsync(CatalogCategory.Classes, "monk", CancellationToken.None);

        Assert.NotNull(item?.CharacterCreation);
        var choice = Assert.Single(item.CharacterCreation.ProficiencyChoices);
        Assert.Equal(
            ["tool-carpenters-tools", "flute"],
            choice.Options.Select(option => option.Id));
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

    private static string ClassLevelsJson(
        string classId,
        Func<int, int>? proficiencyBonus = null) => $"[{string.Join(',',
        Enumerable.Range(1, 20).Select(level => $$"""
            {
              "level": {{level}},
              "prof_bonus": {{proficiencyBonus?.Invoke(level) ?? 2 + ((level - 1) / 4)}},
              "features": {{(level == 1
                  ? $$"""[{ "index": "{{classId}}-spellcasting", "name": "Spellcasting" }]"""
                  : "[]")}}
            }
            """))}]";

    private sealed class StubHandler(Func<HttpRequestMessage, HttpResponseMessage> responseFactory)
        : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken) => Task.FromResult(responseFactory(request));
    }
}
