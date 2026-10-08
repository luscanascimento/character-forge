namespace CharacterForge.Api.Features.Characters;

public sealed record SpellSlotAvailability(
    int SpellLevel,
    int Count);

public sealed record SpellcastingLevelRule(
    int ClassLevel,
    int CantripsKnown,
    int PreparedSpells,
    IReadOnlyList<SpellSlotAvailability> Slots);

public sealed record SpellcastingProgressionRule(
    int AvailableAtLevel,
    ContentReference Ability,
    IReadOnlyList<SpellcastingLevelRule> Levels);

public static class SpellcastingRules
{
    public static SpellcastingDerivedValues? Resolve(
        SpellcastingProgressionRule? progression,
        int classLevel)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(classLevel, CharacterRules.MinimumLevel);
        ArgumentOutOfRangeException.ThrowIfGreaterThan(classLevel, CharacterRules.MaximumLevel);

        if (progression is null || classLevel < progression.AvailableAtLevel)
        {
            return null;
        }

        var level = progression.Levels.SingleOrDefault(level => level.ClassLevel == classLevel)
            ?? throw new InvalidOperationException(
                $"Spellcasting progression does not contain class level {classLevel}.");

        return new SpellcastingDerivedValues(
            progression.Ability,
            level.CantripsKnown,
            level.PreparedSpells,
            level.Slots);
    }
}
