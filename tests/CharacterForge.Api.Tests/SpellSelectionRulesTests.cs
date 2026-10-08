using CharacterForge.Api.Features.Characters;

namespace CharacterForge.Api.Tests;

public sealed class SpellSelectionRulesTests
{
    private static readonly SpellSelectionRule BardLevelOne = new(
        "classSpellList",
        2,
        4,
        1,
        [
            Spell("dancing-lights", "Dancing Lights", 0),
            Spell("light", "Light", 0),
            Spell("mage-hand", "Mage Hand", 0),
            Spell("charm-person", "Charm Person", 1),
            Spell("cure-wounds", "Cure Wounds", 1),
            Spell("detect-magic", "Detect Magic", 1),
            Spell("heroism", "Heroism", 1),
            Spell("shatter", "Shatter", 2)
        ]);

    [Fact]
    public void AcceptsExactDistinctSelectionsFromTheEligibleClassList()
    {
        var result = SpellSelectionRules.Validate(ValidSelections(), BardLevelOne);

        Assert.True(result.IsValid);
    }

    [Fact]
    public void RequiresTheProgressionCounts()
    {
        var result = SpellSelectionRules.Validate(
            new SpellSelections([Reference("light", "Light")], []),
            BardLevelOne);

        Assert.Contains(result.Violations, violation =>
            violation.Code == "character.spells.cantrips.count");
        Assert.Contains(result.Violations, violation =>
            violation.Code == "character.spells.preparedSpells.count");
    }

    [Fact]
    public void RejectsDuplicatesWrongListsAndSpellLevelsWithoutMutatingSelections()
    {
        var selections = new SpellSelections(
            [Reference("light", "Light"), Reference("light", "Light")],
            [
                Reference("shatter", "Shatter"),
                Reference("fireball", "Fireball"),
                Reference("charm-person", "Charm Person"),
                Reference("cure-wounds", "Cure Wounds")
            ]);

        var result = SpellSelectionRules.Validate(selections, BardLevelOne);

        Assert.Contains(result.Violations, violation =>
            violation.Code == "character.spells.cantrips.duplicate");
        Assert.Contains(result.Violations, violation =>
            violation.Code == "character.spells.preparedSpells.level");
        Assert.Contains(result.Violations, violation =>
            violation.Code == "character.spells.preparedSpells.notInClassList");
        Assert.Equal("shatter", selections.PreparedSpells![0].Id);
    }

    [Fact]
    public void RejectsAStaleCatalogName()
    {
        var selections = ValidSelections() with
        {
            Cantrips = [Reference("light", "Old Light"), Reference("mage-hand", "Mage Hand")]
        };

        var result = SpellSelectionRules.Validate(selections, BardLevelOne);

        Assert.Contains(result.Violations, violation =>
            violation.Code == "character.spells.cantrips.name.mismatch" &&
            violation.Requirement == "Light");
    }

    [Fact]
    public void RequiresWizardPreparedSpellsToBeOwnedInTheCanonicalSpellbook()
    {
        var wizard = BardLevelOne with
        {
            PreparedSpellSource = "spellbook",
            MinimumSpellbookSpells = 4
        };
        var spellbook = new[]
        {
            Reference("charm-person", "Charm Person"),
            Reference("cure-wounds", "Cure Wounds"),
            Reference("detect-magic", "Detect Magic"),
            Reference("heroism", "Heroism")
        };
        var valid = ValidSelections() with { Spellbook = spellbook };

        Assert.True(SpellSelectionRules.Validate(valid, wizard).IsValid);

        var missingOwnership = SpellSelectionRules.Validate(
            valid with
            {
                Spellbook = spellbook.Take(3).ToArray(),
                PreparedSpells =
                [
                    Reference("charm-person", "Charm Person"),
                    Reference("cure-wounds", "Cure Wounds"),
                    Reference("detect-magic", "Detect Magic"),
                    Reference("heroism", "Heroism")
                ]
            },
            wizard);
        Assert.Contains(missingOwnership.Violations, violation =>
            violation.Code == "character.spells.spellbook.count");
        Assert.Contains(missingOwnership.Violations, violation =>
            violation.Code == "character.spells.preparedSpells.level" &&
            violation.Source == "spells.preparedSpells[3]");
    }

    [Fact]
    public void RejectsRetainedSelectionsForANonSpellcastingClass()
    {
        var result = SpellSelectionRules.Validate(ValidSelections(), null);

        Assert.Contains(result.Violations, violation =>
            violation.Code == "character.spells.unsupported" && violation.Source == "spells");
    }

    private static SpellSelections ValidSelections() => new(
        [Reference("light", "Light"), Reference("mage-hand", "Mage Hand")],
        [
            Reference("charm-person", "Charm Person"),
            Reference("cure-wounds", "Cure Wounds"),
            Reference("detect-magic", "Detect Magic"),
            Reference("heroism", "Heroism")
        ]);

    private static SpellOptionRule Spell(string id, string name, int level) =>
        new(Reference(id, name), level);

    private static ContentReference Reference(string id, string name) => new(id, name);
}
