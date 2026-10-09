using CharacterForge.Api.Features.Characters;

namespace CharacterForge.Api.Tests;

public sealed class SpellReplacementRulesTests
{
    private static readonly SpellReplacementRulesContext BardRules = new(
        new SpellReplacementPolicyRule(SpellReplacementRules.ClassLevelGained, 1),
        new SpellReplacementPolicyRule(SpellReplacementRules.ClassLevelGained, 1));

    [Fact]
    public void AcceptsOneReplacementPerGroupWhenExactlyOneClassLevelIsGained()
    {
        var previous = Character(1, ["light", "mage-hand"], ["charm-person", "cure-wounds"]);
        var current = Character(2, ["light", "minor-illusion"], ["charm-person", "heroism"]);

        var result = SpellReplacementRules.Validate(
            previous,
            current,
            BardRules,
            SpellReplacementRules.ClassLevelGained);

        Assert.True(result.IsValid);
    }

    [Fact]
    public void DoesNotCountNewCapacityAsAReplacement()
    {
        var previous = Character(3, ["light", "mage-hand"], ["charm-person", "cure-wounds"]);
        var current = Character(
            4,
            ["light", "mage-hand", "minor-illusion"],
            ["charm-person", "cure-wounds", "heroism"]);

        var result = SpellReplacementRules.Validate(
            previous,
            current,
            BardRules,
            SpellReplacementRules.ClassLevelGained);

        Assert.True(result.IsValid);
    }

    [Fact]
    public void RejectsMoreThanThePolicyLimit()
    {
        var previous = Character(1, ["light", "mage-hand"], ["charm-person", "cure-wounds"]);
        var current = Character(2, ["guidance", "minor-illusion"], ["heroism", "command"]);

        var result = SpellReplacementRules.Validate(
            previous,
            current,
            BardRules,
            SpellReplacementRules.ClassLevelGained);

        Assert.Contains(result.Violations, violation =>
            violation.Code == "character.spellReplacement.cantrips.limit");
        Assert.Contains(result.Violations, violation =>
            violation.Code == "character.spellReplacement.preparedSpells.limit");
    }

    [Fact]
    public void EnforcesTheConfiguredEventTrigger()
    {
        var previous = Character(2, ["light", "mage-hand"], ["charm-person", "cure-wounds"]);
        var current = Character(2, ["light", "minor-illusion"], ["charm-person", "heroism"]);

        var result = SpellReplacementRules.Validate(
            previous,
            current,
            BardRules,
            SpellReplacementRules.LongRest);

        Assert.Contains(result.Violations, violation =>
            violation.Code == "character.spellReplacement.cantrips.trigger");
        Assert.Contains(result.Violations, violation =>
            violation.Code == "character.spellReplacement.preparedSpells.trigger");
    }

    [Fact]
    public void AcceptsAnyNumberWhenTheLongRestPolicyHasNoMaximum()
    {
        var rules = new SpellReplacementRulesContext(
            new SpellReplacementPolicyRule(SpellReplacementRules.ClassLevelGained, 1),
            new SpellReplacementPolicyRule(SpellReplacementRules.LongRest, null));
        var previous = Character(2, ["light", "mage-hand"], ["bless", "command", "cure-wounds"]);
        var current = Character(2, ["light", "mage-hand"], ["aid", "augury", "hold-person"]);

        var result = SpellReplacementRules.Validate(
            previous,
            current,
            rules,
            SpellReplacementRules.LongRest);

        Assert.True(result.IsValid);
    }

    [Fact]
    public void RejectsCantripChangesWhenTheClassHasNoBaseReplacementPolicy()
    {
        var rules = new SpellReplacementRulesContext(
            Cantrips: null,
            new SpellReplacementPolicyRule(SpellReplacementRules.LongRest, 1));
        var previous = Character(2, ["guidance", "light"], ["bless", "command"]);
        var current = Character(2, ["guidance", "thaumaturgy"], ["bless", "command"]);

        var result = SpellReplacementRules.Validate(
            previous,
            current,
            rules,
            SpellReplacementRules.LongRest);

        Assert.Contains(result.Violations, violation =>
            violation.Code == "character.spellReplacement.cantrips.unsupported");
    }

    [Fact]
    public void RejectsAnUnknownEventTrigger()
    {
        var previous = Character(2, ["light"], ["heroism"]);
        var current = Character(2, ["light"], ["heroism"]);

        var result = SpellReplacementRules.Validate(previous, current, BardRules, "shortRest");

        Assert.Contains(result.Violations, violation =>
            violation.Code == "character.spellReplacement.trigger.invalid" &&
            violation.Source == "trigger");
    }

    [Theory]
    [InlineData(SpellReplacementRules.ClassLevelGained, 1)]
    [InlineData(SpellReplacementRules.LongRest, 3)]
    public void RejectsAClassLevelThatDoesNotMatchTheEvent(string trigger, int currentLevel)
    {
        var previous = Character(2, ["light"], ["heroism"]);
        var current = Character(currentLevel, ["light"], ["heroism"]);

        var result = SpellReplacementRules.Validate(previous, current, BardRules, trigger);

        Assert.Contains(result.Violations, violation =>
            violation.Code == "character.spellReplacement.level.invalid");
    }

    private static Character Character(
        int level,
        IReadOnlyList<string> cantrips,
        IReadOnlyList<string> preparedSpells) => CharacterValidatorTests.CreateValidCharacter(level) with
        {
            ClassProgressions = [new ClassProgression(new ContentReference("bard", "Bard"), level)],
            Spells = new SpellSelections(
                cantrips.Select(Reference).ToArray(),
                preparedSpells.Select(Reference).ToArray())
        };

    private static ContentReference Reference(string id) => new(id, id);
}
