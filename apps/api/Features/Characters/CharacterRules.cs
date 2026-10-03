namespace CharacterForge.Api.Features.Characters;

public static class CharacterRules
{
    public const string Ruleset = "2024";
    public const string RulesVersion = "SRD-5.2.1";
    public const int MinimumAbilityScore = 1;
    public const int MaximumAbilityScore = 30;
    public const int MinimumLevel = 1;
    public const int MaximumLevel = 20;
}

public static class AbilityRules
{
    public static int GetModifier(int score)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(score, CharacterRules.MinimumAbilityScore);
        ArgumentOutOfRangeException.ThrowIfGreaterThan(score, CharacterRules.MaximumAbilityScore);

        return (int)Math.Floor((score - 10) / 2d);
    }
}

public static class ProficiencyRules
{
    public static int GetBonus(int level)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(level, CharacterRules.MinimumLevel);
        ArgumentOutOfRangeException.ThrowIfGreaterThan(level, CharacterRules.MaximumLevel);

        return 2 + ((level - 1) / 4);
    }

    public static IReadOnlyList<GrantedProficiency> MergeGrants(IEnumerable<ProficiencyGrant> grants)
    {
        var merged = new Dictionary<string, (ContentReference Proficiency, List<ProficiencySource> Sources)>(
            StringComparer.OrdinalIgnoreCase);

        foreach (var grant in grants)
        {
            if (string.IsNullOrWhiteSpace(grant.Proficiency.Id))
            {
                throw new ArgumentException("A proficiency grant must have an id.", nameof(grants));
            }

            if (!merged.TryGetValue(grant.Proficiency.Id, out var entry))
            {
                entry = (grant.Proficiency, []);
                merged.Add(grant.Proficiency.Id, entry);
            }

            if (!entry.Sources.Contains(grant.Source))
            {
                entry.Sources.Add(grant.Source);
            }
        }

        return merged.Values
            .OrderBy(entry => entry.Proficiency.Name, StringComparer.OrdinalIgnoreCase)
            .Select(entry => new GrantedProficiency(entry.Proficiency, entry.Sources))
            .ToArray();
    }
}

public static class ArmorClassRules
{
    public static int GetUnarmored(int dexterityScore) =>
        10 + AbilityRules.GetModifier(dexterityScore);
}

public static class HitPointRules
{
    private static readonly HashSet<int> SupportedHitDice = [6, 8, 10, 12];

    public static int GetLevelOneMaximum(int hitDie, int constitutionScore)
        => GetFixedMaximum(hitDie, constitutionScore, CharacterRules.MinimumLevel);

    public static int GetFixedMaximum(int hitDie, int constitutionScore, int level)
    {
        if (!IsSupportedHitDie(hitDie))
        {
            throw new ArgumentOutOfRangeException(nameof(hitDie), hitDie, "Hit die must be d6, d8, d10, or d12.");
        }

        ArgumentOutOfRangeException.ThrowIfLessThan(level, CharacterRules.MinimumLevel);
        ArgumentOutOfRangeException.ThrowIfGreaterThan(level, CharacterRules.MaximumLevel);

        var constitutionModifier = AbilityRules.GetModifier(constitutionScore);
        var levelOneMaximum = hitDie + constitutionModifier;
        var fixedIncrease = Math.Max(1, (hitDie / 2) + 1 + constitutionModifier);
        return levelOneMaximum + ((level - 1) * fixedIncrease);
    }

    public static bool IsSupportedHitDie(int hitDie) => SupportedHitDice.Contains(hitDie);
}
