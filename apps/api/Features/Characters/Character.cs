namespace CharacterForge.Api.Features.Characters;

public sealed record Character(
    Guid Id,
    string? Name,
    string? Ruleset,
    string? RulesVersion,
    AbilityScores? Abilities,
    ContentReference? Species,
    ContentReference? Background,
    IReadOnlyList<ClassProgression>? ClassProgressions,
    IReadOnlyList<ProficiencyChoiceSelection>? ProficiencyChoices);

public sealed record AbilityScores(
    int Strength,
    int Dexterity,
    int Constitution,
    int Intelligence,
    int Wisdom,
    int Charisma);

public sealed record ContentReference(string? Id, string? Name);

public sealed record ClassProgression(
    ContentReference? Class,
    int Level,
    ContentReference? Subclass = null);

public sealed record ProficiencyChoiceSelection(
    string? ChoiceId,
    IReadOnlyList<ContentReference>? Selections);
