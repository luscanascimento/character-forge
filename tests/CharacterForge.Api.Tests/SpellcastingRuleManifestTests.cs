using CharacterForge.Api.Features.Catalog;
using CharacterForge.Api.Features.Progression;
using CharacterForge.Api.Features.Spellcasting;

namespace CharacterForge.Api.Tests;

public sealed class SpellcastingRuleManifestTests
{
    [Fact]
    public void Manifest_HasIndependentIdentityAndSrdProvenanceForEveryCaster()
    {
        Assert.Equal("SRD-5.2.1-SPELL-1", SpellcastingRuleManifest.Version);
        Assert.Equal("2024", SpellcastingRuleManifest.Ruleset);
        Assert.Equal("SRD-5.2.1", SpellcastingRuleManifest.RulesVersion);
        Assert.Equal(
            ["bard", "cleric", "druid", "paladin", "ranger", "sorcerer", "warlock", "wizard"],
            SpellcastingRuleManifest.Policies.Select(policy => policy.ClassId));

        var expectedPages = new Dictionary<string, int[]>
        {
            ["bard"] = [32],
            ["cleric"] = [36, 37],
            ["druid"] = [42],
            ["paladin"] = [54],
            ["ranger"] = [58],
            ["sorcerer"] = [64, 65],
            ["warlock"] = [71, 72],
            ["wizard"] = [77, 78]
        };

        Assert.All(SpellcastingRuleManifest.Policies, policy =>
        {
            Assert.Equal(expectedPages[policy.ClassId], policy.Provenance.Select(source => source.Page));
            Assert.All(policy.Provenance, source =>
            {
                Assert.Equal("System Reference Document 5.2.1", source.Document);
                Assert.Contains("Spellcasting", source.Section, StringComparison.Ordinal);
                Assert.Equal(
                    "https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf",
                    source.Url);
            });
        });
    }

    [Fact]
    public void GetVerifiedPolicy_DistinguishesEveryPreparationModel()
    {
        var bard = SpellcastingRuleManifest.GetVerifiedPolicy(Progression("bard", "cha"));
        var cleric = SpellcastingRuleManifest.GetVerifiedPolicy(Progression("cleric", "wis"));
        var paladin = SpellcastingRuleManifest.GetVerifiedPolicy(Progression(
            "paladin",
            "cha",
            cantripsKnown: 0,
            maximumSlotLevel: 5));
        var wizard = SpellcastingRuleManifest.GetVerifiedPolicy(Progression("wizard", "int"));

        Assert.Equal("classSpellList", bard?.PreparedSpellSource);
        Assert.Equal("classLevelGained", bard?.PreparedSpellReplacement.Trigger);
        Assert.Equal(1, bard?.PreparedSpellReplacement.MaximumReplacements);

        Assert.Equal("longRest", cleric?.PreparedSpellReplacement.Trigger);
        Assert.Null(cleric?.PreparedSpellReplacement.MaximumReplacements);

        Assert.Null(paladin?.CantripReplacement);
        Assert.Equal(1, paladin?.PreparedSpellReplacement.MaximumReplacements);

        Assert.Equal("spellbook", wizard?.PreparedSpellSource);
        Assert.Equal("longRest", wizard?.CantripReplacement?.Trigger);
        Assert.Null(wizard?.PreparedSpellReplacement.MaximumReplacements);
    }

    [Fact]
    public void GetVerifiedPolicy_RepresentsPactMagicAndMysticArcanumSeparately()
    {
        var policy = SpellcastingRuleManifest.GetVerifiedPolicy(Progression(
            "warlock",
            "cha",
            maximumSlotLevel: 5));

        Assert.NotNull(policy);
        Assert.Equal(SpellcastingRuleManifest.Version, policy.ManifestVersion);
        Assert.Equal("pactMagic", policy.SlotPool);
        Assert.Equal("shortOrLongRest", policy.BaseSlotRecovery);
        Assert.True(policy.UsesUniformSlotLevel);
        Assert.Equal(5, policy.MaximumSlotLevel);
        Assert.Equal([6, 7, 8, 9], policy.SpecialSpellAccess.Select(access => access.SpellLevel));
        Assert.Equal([11, 13, 15, 17], policy.SpecialSpellAccess.Select(access => access.AvailableAtClassLevel));
        Assert.All(policy.SpecialSpellAccess, access =>
        {
            Assert.Equal(1, access.Uses);
            Assert.Equal("longRest", access.Recovery);
            Assert.Equal("classLevelGained", access.ReplacementTrigger);
            Assert.True(access.RequiresSameSpellLevel);
        });
    }

    [Fact]
    public void GetVerifiedPolicy_RejectsProviderFactsThatDisagreeWithTheManifest()
    {
        var wrongAbility = Progression("wizard", "cha");
        var splitPactSlots = Progression("warlock", "cha") with
        {
            Spellcasting = Progression("warlock", "cha").Spellcasting! with
            {
                Levels = [new ClassSpellcastingLevel(
                    1,
                    2,
                    2,
                    [new SpellSlotCapacity(1, 1), new SpellSlotCapacity(2, 1)])]
            }
        };

        Assert.Throws<SpellcastingRuleContentException>(() =>
            SpellcastingRuleManifest.GetVerifiedPolicy(wrongAbility));
        Assert.Throws<SpellcastingRuleContentException>(() =>
            SpellcastingRuleManifest.GetVerifiedPolicy(splitPactSlots));
    }

    [Fact]
    public void GetVerifiedPolicy_ReturnsNullForANonCasterWithoutAManifestEntry()
    {
        var progression = Progression("fighter", "int") with { Spellcasting = null };

        Assert.Null(SpellcastingRuleManifest.GetVerifiedPolicy(progression));
    }

    private static ClassProgressionDocument Progression(
        string classId,
        string abilityId,
        int cantripsKnown = 3,
        int maximumSlotLevel = 9) => new(
            new CatalogReference(classId, classId),
            8,
            [],
            [],
            new CatalogSource(
                "Test provider",
                "2024",
                "SRD-5.2.1",
                DateTimeOffset.UnixEpoch),
            new ClassSpellcastingProgression(
                1,
                new CatalogReference(abilityId, abilityId.ToUpperInvariant()),
                [new ClassSpellcastingLevel(
                    1,
                    cantripsKnown,
                    4,
                    [new SpellSlotCapacity(maximumSlotLevel, 1)])]));
}
