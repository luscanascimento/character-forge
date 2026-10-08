using CharacterForge.Api.Features.Catalog;
using CharacterForge.Api.Features.Spellcasting;

namespace CharacterForge.Api.Features.Progression;

public sealed record ClassProgressionDocument(
    CatalogReference Class,
    int HitDie,
    IReadOnlyList<ClassLevelProgression> Levels,
    IReadOnlyList<SubclassProgression> Subclasses,
    CatalogSource? Source = null,
    ClassSpellcastingProgression? Spellcasting = null);

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

public sealed record ClassSpellcastingProgression(
    int AvailableAtLevel,
    CatalogReference Ability,
    IReadOnlyList<ClassSpellcastingLevel> Levels,
    SpellcastingPolicyDocument? Policy = null);

public sealed record ClassSpellcastingLevel(
    int ClassLevel,
    int CantripsKnown,
    int PreparedSpells,
    IReadOnlyList<SpellSlotCapacity> Slots);

public sealed record SpellSlotCapacity(
    int SpellLevel,
    int Count);
