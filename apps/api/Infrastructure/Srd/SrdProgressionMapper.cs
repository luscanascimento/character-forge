using CharacterForge.Api.Features.Catalog;
using CharacterForge.Api.Features.Characters;
using CharacterForge.Api.Features.Progression;

namespace CharacterForge.Api.Infrastructure.Srd;

internal static class SrdProgressionMapper
{
    private const int MaximumCantripsKnown = 6;
    private const int MaximumPreparedSpells = 22;
    private const int MaximumSlotsPerSpellLevel = 4;

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
            normalizedSubclasses,
            Spellcasting: MapSpellcasting(characterClass, levels));
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

    private static ClassSpellcastingProgression? MapSpellcasting(
        SrdClassDetail characterClass,
        IReadOnlyList<SrdClassLevel> levels)
    {
        var spellcastingRows = levels
            .Where(level => level.Spellcasting is not null)
            .OrderBy(level => level.Level)
            .ToArray();

        if (characterClass.Spellcasting is null)
        {
            if (spellcastingRows.Length > 0)
            {
                throw new SrdProviderException(
                    $"The SRD provider returned spellcasting levels without class spellcasting metadata for '{characterClass.Index}'.");
            }

            return null;
        }

        var metadata = characterClass.Spellcasting;
        if (metadata.SpellcastingAbility is null ||
            metadata.Level is < CharacterRules.MinimumLevel or > CharacterRules.MaximumLevel ||
            string.IsNullOrWhiteSpace(metadata.SpellcastingAbility.Index) ||
            string.IsNullOrWhiteSpace(metadata.SpellcastingAbility.Name) ||
            !AbilityRules.IsSupportedId(metadata.SpellcastingAbility.Index))
        {
            throw InvalidSpellcasting(characterClass.Index);
        }

        var expectedLevels = Enumerable.Range(
            metadata.Level,
            CharacterRules.MaximumLevel - metadata.Level + 1);
        if (!spellcastingRows.Select(level => level.Level).SequenceEqual(expectedLevels))
        {
            throw new SrdProviderException(
                $"The SRD provider returned an incomplete spellcasting progression for '{characterClass.Index}'.");
        }

        return new ClassSpellcastingProgression(
            metadata.Level,
            Reference(metadata.SpellcastingAbility.Index, metadata.SpellcastingAbility.Name),
            spellcastingRows.Select(level => MapSpellcastingLevel(characterClass.Index, level)).ToArray());
    }

    private static ClassSpellcastingLevel MapSpellcastingLevel(
        string classId,
        SrdClassLevel level)
    {
        var spellcasting = level.Spellcasting!;
        var slotCounts = new int?[]
        {
            spellcasting.SpellSlotsLevel1,
            spellcasting.SpellSlotsLevel2,
            spellcasting.SpellSlotsLevel3,
            spellcasting.SpellSlotsLevel4,
            spellcasting.SpellSlotsLevel5,
            spellcasting.SpellSlotsLevel6,
            spellcasting.SpellSlotsLevel7,
            spellcasting.SpellSlotsLevel8,
            spellcasting.SpellSlotsLevel9
        };

        if (spellcasting.CantripsKnown is null || spellcasting.PreparedSpells is null ||
            spellcasting.CantripsKnown is < 0 or > MaximumCantripsKnown ||
            spellcasting.PreparedSpells is < 0 or > MaximumPreparedSpells ||
            slotCounts.Any(count => count is null or < 0 or > MaximumSlotsPerSpellLevel) ||
            slotCounts.All(count => count == 0))
        {
            throw InvalidSpellcasting(classId);
        }

        var slots = slotCounts
            .Select((count, index) => new SpellSlotCapacity(index + 1, count!.Value))
            .Where(slot => slot.Count > 0)
            .ToArray();

        return new ClassSpellcastingLevel(
            level.Level,
            spellcasting.CantripsKnown.Value,
            spellcasting.PreparedSpells.Value,
            slots);
    }

    private static SrdProviderException InvalidSpellcasting(string classId) => new(
        $"The SRD provider returned an invalid spellcasting progression for '{classId}'.");

    private static IReadOnlyList<CatalogReference> References(
        IReadOnlyList<SrdReference>? references) => references?
        .Where(reference =>
            !string.IsNullOrWhiteSpace(reference.Index) &&
            !string.IsNullOrWhiteSpace(reference.Name))
        .Select(reference => Reference(reference.Index, reference.Name))
        .ToArray() ?? [];

    private static CatalogReference Reference(string id, string name) => new(id, name);
}
