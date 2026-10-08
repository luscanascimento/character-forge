using CharacterForge.Api.Features.Characters;

namespace CharacterForge.Api.Tests;

public sealed class CharacterRulesTests
{
    [Theory]
    [InlineData(1, -5)]
    [InlineData(8, -1)]
    [InlineData(9, -1)]
    [InlineData(10, 0)]
    [InlineData(11, 0)]
    [InlineData(12, 1)]
    [InlineData(20, 5)]
    [InlineData(30, 10)]
    public void AbilityModifier_UsesFloorDivision(int score, int expected)
    {
        Assert.Equal(expected, AbilityRules.GetModifier(score));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(31)]
    public void AbilityModifier_RejectsScoresOutsideRulesBounds(int score)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => AbilityRules.GetModifier(score));
    }

    [Theory]
    [InlineData("int", 12)]
    [InlineData("wis", 10)]
    [InlineData("cha", 16)]
    public void AbilityScore_ResolvesCanonicalProviderIds(string abilityId, int expected)
    {
        var abilities = CharacterValidatorTests.CreateValidCharacter().Abilities!;

        Assert.Equal(expected, AbilityRules.GetScore(abilities, abilityId));
    }

    [Fact]
    public void AbilityScore_RejectsAnUnknownProviderId()
    {
        var abilities = CharacterValidatorTests.CreateValidCharacter().Abilities!;

        Assert.Throws<ArgumentException>(() => AbilityRules.GetScore(abilities, "luck"));
    }

    [Theory]
    [InlineData(1, 2)]
    [InlineData(4, 2)]
    [InlineData(5, 3)]
    [InlineData(8, 3)]
    [InlineData(9, 4)]
    [InlineData(12, 4)]
    [InlineData(13, 5)]
    [InlineData(16, 5)]
    [InlineData(17, 6)]
    [InlineData(20, 6)]
    public void ProficiencyBonus_ProgressesByTier(int level, int expected)
    {
        Assert.Equal(expected, ProficiencyRules.GetBonus(level));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(21)]
    public void ProficiencyBonus_RejectsLevelsOutsideRulesBounds(int level)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => ProficiencyRules.GetBonus(level));
    }

    [Theory]
    [InlineData(1, 5)]
    [InlineData(10, 10)]
    [InlineData(14, 12)]
    [InlineData(30, 20)]
    public void UnarmoredArmorClass_UsesDexterityModifier(int dexterityScore, int expected)
    {
        Assert.Equal(expected, ArmorClassRules.GetUnarmored(dexterityScore));
    }

    [Theory]
    [InlineData(6, 13, 7)]
    [InlineData(8, 10, 8)]
    [InlineData(10, 8, 9)]
    [InlineData(12, 18, 16)]
    public void LevelOneHitPoints_UseMaximumHitDieAndConstitutionModifier(
        int hitDie,
        int constitutionScore,
        int expected)
    {
        Assert.Equal(expected, HitPointRules.GetLevelOneMaximum(hitDie, constitutionScore));
    }

    [Fact]
    public void LevelOneHitPoints_RejectUnsupportedHitDie()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            HitPointRules.GetLevelOneMaximum(20, 10));
    }

    [Theory]
    [InlineData(6, 10, 2, 10)]
    [InlineData(8, 14, 5, 38)]
    [InlineData(10, 18, 8, 84)]
    [InlineData(12, 1, 3, 11)]
    [InlineData(6, 1, 20, 20)]
    public void FixedHitPoints_UseTheClassValueAndMinimumOneIncrease(
        int hitDie,
        int constitutionScore,
        int level,
        int expected)
    {
        Assert.Equal(expected, HitPointRules.GetFixedMaximum(hitDie, constitutionScore, level));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(21)]
    public void FixedHitPoints_RejectLevelsOutsideRulesBounds(int level)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            HitPointRules.GetFixedMaximum(8, 10, level));
    }

    [Fact]
    public void ProficiencyGrants_MergeDuplicateProficienciesAndKeepTheirSources()
    {
        var proficiency = new ContentReference("skill-perception", "Skill: Perception");
        var grants = new[]
        {
            new ProficiencyGrant(
                proficiency,
                new ProficiencySource("classes", new ContentReference("ranger", "Ranger"))),
            new ProficiencyGrant(
                proficiency,
                new ProficiencySource("species", new ContentReference("elf", "Elf"))),
            new ProficiencyGrant(
                new ContentReference("light-armor", "Light Armor"),
                new ProficiencySource("classes", new ContentReference("ranger", "Ranger")))
        };

        var merged = ProficiencyRules.MergeGrants(grants);

        Assert.Equal(["light-armor", "skill-perception"], merged.Select(item => item.Proficiency.Id));
        Assert.Equal(2, merged.Single(item => item.Proficiency.Id == "skill-perception").Sources.Count);
    }

    [Fact]
    public void ProficiencyGrants_PreserveStructuredSkillIdentity()
    {
        var source = new ProficiencySource(
            "classes",
            new ContentReference("bard", "Bard"));

        var merged = ProficiencyRules.MergeGrants(
        [
            new ProficiencyGrant(
                new ContentReference("skill-performance", "Skill: Performance"),
                source,
                IsSkill: true),
            new ProficiencyGrant(
                new ContentReference("instrument-lute", "Lute"),
                source)
        ]);

        Assert.True(merged.Single(item => item.Proficiency.Id == "skill-performance").IsSkill);
        Assert.False(merged.Single(item => item.Proficiency.Id == "instrument-lute").IsSkill);
    }
}
