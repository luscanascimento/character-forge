using System.Net;
using System.Net.Http.Json;
using CharacterForge.Api.Features.Catalog;
using CharacterForge.Api.Features.Characters;
using CharacterForge.Api.Infrastructure.Srd;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace CharacterForge.Api.Tests;

public sealed class CharacterEndpointsTests : IDisposable
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    public CharacterEndpointsTests()
    {
        _factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<ISrdContentSource>();
                services.AddSingleton<ISrdContentSource, CharacterContentSource>();
            });
        });
        _client = _factory.CreateClient();
    }

    [Fact]
    public async Task Validate_ReturnsStructuredValidationAndDerivedValues()
    {
        var response = await _client.PostAsJsonAsync(
            "/api/characters/validate",
            CharacterValidatorTests.CreateValidCharacter(),
            CancellationToken.None);
        var evaluation = await response.Content.ReadFromJsonAsync<CharacterEvaluation>(
            cancellationToken: CancellationToken.None);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(evaluation);
        Assert.True(evaluation.Validation.IsValid);
        Assert.NotNull(evaluation.Derived);
        Assert.Equal(-1, evaluation.Derived.AbilityModifiers.Strength);
        Assert.Equal(2, evaluation.Derived.AbilityModifiers.Dexterity);
        Assert.Equal(2, evaluation.Derived.ProficiencyBonus);
        Assert.Equal(12, evaluation.Derived.ArmorClass);
        Assert.Equal(7, evaluation.Derived.HitPointMaximum);
        Assert.Equal(6, evaluation.Derived.HitDie);
        Assert.Contains(
            evaluation.Derived.GrantedProficiencies,
            proficiency => proficiency.Proficiency.Id == "simple-weapons");
        Assert.Contains(
            evaluation.Derived.GrantedProficiencies,
            proficiency => proficiency.Proficiency.Id == "skill-insight");
        Assert.Contains(
            evaluation.Derived.GrantedProficiencies,
            proficiency => proficiency.Proficiency.Id == "skill-arcana");
        Assert.Contains(
            evaluation.Derived.GrantedProficiencies,
            proficiency => proficiency.Proficiency.Id == "skill-perception");
    }

    [Fact]
    public async Task Validate_DoesNotCalculateAnInvalidDraft()
    {
        var character = CharacterValidatorTests.CreateValidCharacter() with
        {
            RulesVersion = "SRD-5.1"
        };

        var response = await _client.PostAsJsonAsync(
            "/api/characters/validate",
            character,
            CancellationToken.None);
        var evaluation = await response.Content.ReadFromJsonAsync<CharacterEvaluation>(
            cancellationToken: CancellationToken.None);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(evaluation);
        Assert.False(evaluation.Validation.IsValid);
        Assert.Null(evaluation.Derived);
        Assert.Contains(
            evaluation.Validation.Violations,
            violation => violation.Code == "character.rulesVersion.unsupported");
    }

    [Fact]
    public async Task Validate_ReportsMissingProficiencyChoicesWithoutDerivedValues()
    {
        var character = CharacterValidatorTests.CreateValidCharacter() with
        {
            ProficiencyChoices = []
        };

        var response = await _client.PostAsJsonAsync(
            "/api/characters/validate",
            character,
            CancellationToken.None);
        var evaluation = await response.Content.ReadFromJsonAsync<CharacterEvaluation>(
            cancellationToken: CancellationToken.None);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(evaluation);
        Assert.False(evaluation.Validation.IsValid);
        Assert.Null(evaluation.Derived);
        Assert.Equal(
            2,
            evaluation.Validation.Violations.Count(
                violation => violation.Code == "character.proficiencyChoice.required"));
    }

    [Fact]
    public async Task Validate_ReportsCatalogReferenceThatNoLongerExists()
    {
        var character = CharacterValidatorTests.CreateValidCharacter() with
        {
            Species = new ContentReference("missing", "Missing species")
        };

        var response = await _client.PostAsJsonAsync(
            "/api/characters/validate",
            character,
            CancellationToken.None);
        var evaluation = await response.Content.ReadFromJsonAsync<CharacterEvaluation>(
            cancellationToken: CancellationToken.None);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(evaluation);
        Assert.False(evaluation.Validation.IsValid);
        Assert.Null(evaluation.Derived);
        Assert.Contains(
            evaluation.Validation.Violations,
            violation => violation.Code == "character.species.notFound");
    }

    [Fact]
    public async Task Validate_DoesNotClaimLevelOneHitPointsForHigherLevelCharacter()
    {
        var response = await _client.PostAsJsonAsync(
            "/api/characters/validate",
            CharacterValidatorTests.CreateValidCharacter(level: 5),
            CancellationToken.None);
        var evaluation = await response.Content.ReadFromJsonAsync<CharacterEvaluation>(
            cancellationToken: CancellationToken.None);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(evaluation?.Derived);
        Assert.Equal(3, evaluation.Derived.ProficiencyBonus);
        Assert.Null(evaluation.Derived.HitPointMaximum);
    }

    [Fact]
    public async Task Validate_ReturnsServiceUnavailableWhenRuleContentProviderFails()
    {
        var character = CharacterValidatorTests.CreateValidCharacter() with
        {
            Species = new ContentReference("provider-failure", "Unavailable species")
        };

        var response = await _client.PostAsJsonAsync(
            "/api/characters/validate",
            character,
            CancellationToken.None);

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    public void Dispose()
    {
        _client.Dispose();
        _factory.Dispose();
    }

    private sealed class CharacterContentSource : ISrdContentSource
    {
        public Task<IReadOnlyList<CatalogItemSummary>> GetItemsAsync(
            CatalogCategory category,
            int? level,
            string? school,
            string? characterClass,
            CancellationToken cancellationToken) => throw new NotSupportedException();

        public Task<CatalogItemDetail?> GetItemAsync(
            CatalogCategory category,
            string id,
            CancellationToken cancellationToken)
        {
            if (id == "provider-failure")
            {
                throw new SrdProviderException("Unavailable in test.");
            }

            if (id == "missing")
            {
                return Task.FromResult<CatalogItemDetail?>(null);
            }

            var facts = category switch
            {
                CatalogCategory.Classes => new CatalogCharacterCreationFacts(
                    6,
                    [
                        new CatalogReference("simple-weapons", "Simple Weapons"),
                        new CatalogReference("saving-throw-int", "Saving Throw: INT")
                    ],
                    [
                        new CatalogProficiencyChoice(
                            "classes/wizard/proficiencies/0",
                            "Choose two Wizard skills",
                            2,
                            [
                                new CatalogReference("skill-arcana", "Skill: Arcana"),
                                new CatalogReference("skill-history", "Skill: History"),
                                new CatalogReference("skill-insight", "Skill: Insight")
                            ])
                    ]),
                CatalogCategory.Backgrounds => new CatalogCharacterCreationFacts(
                    null,
                    [
                        new CatalogReference("skill-insight", "Skill: Insight"),
                        new CatalogReference("skill-religion", "Skill: Religion")
                    ],
                    []),
                CatalogCategory.Species => new CatalogCharacterCreationFacts(
                    null,
                    [],
                    [
                        new CatalogProficiencyChoice(
                            "species/elf/traits/keen-senses/proficiencies/0",
                            "Choose one Keen Senses skill",
                            1,
                            [
                                new CatalogReference("skill-insight", "Skill: Insight"),
                                new CatalogReference("skill-perception", "Skill: Perception"),
                                new CatalogReference("skill-survival", "Skill: Survival")
                            ])
                    ]),
                _ => throw new ArgumentOutOfRangeException(nameof(category), category, null)
            };

            return Task.FromResult<CatalogItemDetail?>(new CatalogItemDetail(
                id,
                category switch
                {
                    CatalogCategory.Classes => "Wizard",
                    CatalogCategory.Species => "Elf",
                    CatalogCategory.Backgrounds => "Acolyte",
                    _ => id
                },
                category.ToSlug(),
                [],
                [],
                [],
                CharacterCreation: facts));
        }
    }
}
