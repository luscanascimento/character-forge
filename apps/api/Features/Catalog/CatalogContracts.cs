using Microsoft.AspNetCore.Mvc;

using CharacterForge.Api.Features.Characters;

namespace CharacterForge.Api.Features.Catalog;

public sealed record CatalogSource(
    string Provider,
    string Ruleset,
    string RulesVersion,
    DateTimeOffset FetchedAt)
{
    internal static CatalogSource Create(DateTimeOffset fetchedAt) => new(
        "D&D 5e SRD API",
        CharacterRules.Ruleset,
        CharacterRules.RulesVersion,
        fetchedAt);
}

public sealed record CatalogItemSummary(
    string Id,
    string Name,
    string Category,
    int? Level = null);

public sealed record CatalogAttribute(string Label, string Value);

public sealed record CatalogReference(string Id, string Name, string? Note = null);

public sealed record CatalogSection(string Title, IReadOnlyList<CatalogReference> Entries);

public sealed record CatalogTextSection(string Title, IReadOnlyList<string> Paragraphs);

public sealed record CatalogProficiencyChoice(
    string Id,
    string Prompt,
    int Count,
    IReadOnlyList<CatalogReference> Options);

public sealed record CatalogCharacterCreationFacts(
    int? HitDie,
    IReadOnlyList<CatalogReference> GrantedProficiencies,
    IReadOnlyList<CatalogProficiencyChoice> ProficiencyChoices);

public sealed record CatalogAbilityScorePrerequisite(
    CatalogReference Ability,
    int MinimumScore);

public sealed record CatalogAbilityScorePrerequisiteChoice(
    int Count,
    IReadOnlyList<CatalogAbilityScorePrerequisite> Options);

public sealed record CatalogFeatFacts(
    string Type,
    int? MinimumLevel,
    string? RequiredFeature,
    bool IsRepeatable,
    CatalogAbilityScorePrerequisiteChoice? AbilityScorePrerequisite);

public sealed record CatalogItemDetail(
    string Id,
    string Name,
    string Category,
    IReadOnlyList<string> Description,
    IReadOnlyList<CatalogAttribute> Attributes,
    IReadOnlyList<CatalogSection> Sections,
    IReadOnlyList<CatalogTextSection>? TextSections = null,
    CatalogCharacterCreationFacts? CharacterCreation = null,
    CatalogSource? Source = null,
    CatalogFeatFacts? Feat = null);

public sealed record CatalogPage(
    IReadOnlyList<CatalogItemSummary> Items,
    int Page,
    int PageSize,
    int Total,
    int TotalPages,
    CatalogSource Source);

public sealed class CatalogRequest
{
    public string? Search { get; init; }
    public int? Page { get; init; }
    public int? PageSize { get; init; }
    public string? Sort { get; init; }
    public int? Level { get; init; }
    public string? School { get; init; }

    [FromQuery(Name = "class")]
    public string? CharacterClass { get; init; }
}

public sealed record CatalogQuery(
    string? Search,
    int Page,
    int PageSize,
    string Sort,
    int? Level,
    string? School,
    string? CharacterClass);

internal sealed record CatalogSnapshot<T>(T Value, DateTimeOffset FetchedAt);
