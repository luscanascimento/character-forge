using CharacterForge.Api.Features.Catalog;
using CharacterForge.Api.Features.Characters;
using CharacterForge.Api.Features.Progression;

namespace CharacterForge.Api.Infrastructure.Srd;

internal static class SrdProgressionMapper
{
    public static ClassProgressionDocument Map(
        SrdClassDetail characterClass,
        IReadOnlyList<SrdClassLevel> levels,
        IReadOnlyList<SrdSubclassProgression> subclasses)
    {
        if (!HitPointRules.IsSupportedHitDie(characterClass.HitDie))
        {
            throw new SrdProviderException(
                $"The SRD provider returned an unsupported hit die for '{characterClass.Index}'.");
        }

        var normalizedLevels = levels
            .OrderBy(level => level.Level)
            .Select(MapLevel)
            .ToArray();
        var expectedLevels = Enumerable.Range(
            CharacterRules.MinimumLevel,
            CharacterRules.MaximumLevel - CharacterRules.MinimumLevel + 1);
        if (!normalizedLevels.Select(level => level.Level).SequenceEqual(expectedLevels))
        {
            throw new SrdProviderException(
                $"The SRD provider returned an incomplete level progression for '{characterClass.Index}'.");
        }

        var normalizedSubclasses = subclasses
            .OrderBy(subclass => subclass.Reference.Name, StringComparer.OrdinalIgnoreCase)
            .Select(subclass => MapSubclass(characterClass.Index, subclass))
            .ToArray();

        return new ClassProgressionDocument(
            Reference(characterClass.Index, characterClass.Name),
            characterClass.HitDie,
            normalizedLevels,
            normalizedSubclasses);
    }

    private static ClassLevelProgression MapLevel(SrdClassLevel level)
    {
        var expectedBonus = level.Level is >= CharacterRules.MinimumLevel and <= CharacterRules.MaximumLevel
            ? ProficiencyRules.GetBonus(level.Level)
            : 0;
        if (level.ProficiencyBonus != expectedBonus)
        {
            throw new SrdProviderException(
                $"The SRD provider returned an invalid proficiency bonus at class level {level.Level}.");
        }

        return new ClassLevelProgression(
            level.Level,
            level.ProficiencyBonus,
            References(level.Features));
    }

    private static SubclassProgression MapSubclass(
        string classId,
        SrdSubclassProgression progression)
    {
        var levels = progression.Levels
            .OrderBy(level => level.Level)
            .Select(level =>
            {
                if (level.Level is < CharacterRules.MinimumLevel or > CharacterRules.MaximumLevel ||
                    !string.Equals(level.Class.Index, classId, StringComparison.OrdinalIgnoreCase) ||
                    !string.Equals(
                        level.Subclass.Index,
                        progression.Reference.Index,
                        StringComparison.OrdinalIgnoreCase))
                {
                    throw new SrdProviderException(
                        $"The SRD provider returned an invalid level for subclass '{progression.Reference.Index}'.");
                }

                return new SubclassLevelProgression(level.Level, References(level.Features));
            })
            .ToArray();

        if (levels.Length == 0 || levels.Select(level => level.Level).Distinct().Count() != levels.Length)
        {
            throw new SrdProviderException(
                $"The SRD provider returned an invalid progression for subclass '{progression.Reference.Index}'.");
        }

        return new SubclassProgression(
            Reference(progression.Reference.Index, progression.Reference.Name),
            levels[0].Level,
            levels);
    }

    private static IReadOnlyList<CatalogReference> References(
        IReadOnlyList<SrdReference>? references) => references?
        .Where(reference =>
            !string.IsNullOrWhiteSpace(reference.Index) &&
            !string.IsNullOrWhiteSpace(reference.Name))
        .Select(reference => Reference(reference.Index, reference.Name))
        .ToArray() ?? [];

    private static CatalogReference Reference(string id, string name) => new(id, name);
}
