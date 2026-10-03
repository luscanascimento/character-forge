using CharacterForge.Api.Features.Catalog;

namespace CharacterForge.Api.Features.Progression;

public sealed record ClassProgressionDocument(
    CatalogReference Class,
    int HitDie,
    IReadOnlyList<ClassLevelProgression> Levels,
    IReadOnlyList<SubclassProgression> Subclasses,
    CatalogSource? Source = null);

public sealed record ClassLevelProgression(
    int Level,
    int ProficiencyBonus,
    IReadOnlyList<CatalogReference> Features);

public sealed record SubclassProgression(
    CatalogReference Subclass,
    int AvailableAtLevel,
    IReadOnlyList<SubclassLevelProgression> Levels);

public sealed record SubclassLevelProgression(
    int Level,
    IReadOnlyList<CatalogReference> Features);
