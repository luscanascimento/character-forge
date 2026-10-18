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
    IReadOnlyList<ProficiencyChoiceSelection>? ProficiencyChoices,
    IReadOnlyList<FeatureChoiceSelection>? FeatureChoices = null,
    SpellSelections? Spells = null,
    EquipmentSelections? Equipment = null,
    IReadOnlyList<FeatSelection>? Feats = null,
    IReadOnlyList<WeaponMasterySelection>? WeaponMasteries = null);

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

public sealed record FeatureChoiceSelection(
    string? RequirementId,
    string? BranchId,
    IReadOnlyList<ContentReference>? Selections);

public sealed record SpellSelections(
    IReadOnlyList<ContentReference>? Cantrips,
    IReadOnlyList<ContentReference>? PreparedSpells,
    IReadOnlyList<ContentReference>? Spellbook = null);

public sealed record EquipmentSelections(IReadOnlyList<EquipmentItemSelection>? Items);

public sealed record EquipmentItemSelection(
    ContentReference? Item,
    int Quantity,
    bool Equipped = false);

public sealed record FeatSelection(
    string? OccurrenceId,
    ContentReference? Feat,
    AbilityScoreImprovementEffect? AbilityScoreImprovement = null);

public sealed record WeaponMasterySelection(ContentReference? Weapon);
