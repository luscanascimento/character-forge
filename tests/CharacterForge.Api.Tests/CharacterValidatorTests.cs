using CharacterForge.Api.Features.Characters;

namespace CharacterForge.Api.Tests;

public sealed class CharacterValidatorTests
{
    [Fact]
    public void Validate_AcceptsCompleteSingleClassCharacter()
    {
        var result = CharacterValidator.Validate(CreateValidCharacter());

        Assert.True(result.IsValid);
        Assert.Empty(result.Violations);
    }

    [Fact]
    public void Validate_ReportsMissingRequiredChoices()
    {
        var character = CreateValidCharacter() with
        {
            Species = null,
            Background = null,
            ClassProgressions = []
        };

        var result = CharacterValidator.Validate(character);

        Assert.False(result.IsValid);
        Assert.Contains(result.Violations, violation => violation.Code == "character.species.required");
        Assert.Contains(result.Violations, violation => violation.Code == "character.background.required");
        Assert.Contains(result.Violations, violation => violation.Code == "character.class.required");
    }

    [Fact]
    public void Validate_ReportsEveryOutOfBoundsAbility()
    {
        var character = CreateValidCharacter() with
        {
            Abilities = new AbilityScores(0, 31, 10, 10, 10, 10)
        };

        var result = CharacterValidator.Validate(character);

        Assert.Collection(
            result.Violations.Where(violation => violation.Code == "character.ability.outOfRange"),
            violation => Assert.Equal("abilities.strength", violation.Source),
            violation => Assert.Equal("abilities.dexterity", violation.Source));
    }

    [Fact]
    public void Validate_ReportsRulesIdentityMismatch()
    {
        var character = CreateValidCharacter() with
        {
            Ruleset = "2014",
            RulesVersion = "SRD-5.1"
        };

        var result = CharacterValidator.Validate(character);

        Assert.Contains(result.Violations, violation => violation.Code == "character.ruleset.unsupported");
        Assert.Contains(result.Violations, violation => violation.Code == "character.rulesVersion.unsupported");
    }

    [Fact]
    public void Validate_RejectsMultipleClassProgressionsWithoutLosingTheirShape()
    {
        var character = CreateValidCharacter() with
        {
            ClassProgressions =
            [
                new(new ContentReference("fighter", "Fighter"), 1),
                new(new ContentReference("wizard", "Wizard"), 1)
            ]
        };

        var result = CharacterValidator.Validate(character);

        var violation = Assert.Single(
            result.Violations,
            item => item.Code == "character.class.count");
        Assert.Equal("classProgressions", violation.Source);
    }

    [Fact]
    public void Validate_ReportsIncompleteClassProgression()
    {
        var character = CreateValidCharacter() with
        {
            ClassProgressions = [new ClassProgression(null, 0)]
        };

        var result = CharacterValidator.Validate(character);

        Assert.Contains(
            result.Violations,
            violation => violation.Code == "character.class.reference.required" &&
                violation.Source == "classProgressions[0].class");
        Assert.Contains(
            result.Violations,
            violation => violation.Code == "character.class.level.outOfRange" &&
                violation.Source == "classProgressions[0].level");
    }

    [Fact]
    public void Validate_RejectsCatalogReferencesThatAreNotCanonicalSlugs()
    {
        var character = CreateValidCharacter() with
        {
            Species = new ContentReference("Elf/../../2014", "Elf")
        };

        var result = CharacterValidator.Validate(character);

        Assert.Contains(
            result.Violations,
            violation => violation.Code == "character.species.id.invalid" &&
                violation.Source == "species.id");
    }

    [Fact]
    public void Validate_RejectsMalformedSpellReferences()
    {
        var character = CreateValidCharacter() with
        {
            Spells = new SpellSelections(
                [new ContentReference("Bad Id", "")],
                [new ContentReference(null, "Missing")])
        };

        var result = CharacterValidator.Validate(character);

        Assert.Contains(result.Violations, violation =>
            violation.Source == "spells.cantrips[0].id");
        Assert.Contains(result.Violations, violation =>
            violation.Source == "spells.cantrips[0].name");
        Assert.Contains(result.Violations, violation =>
            violation.Source == "spells.preparedSpells[0]");
    }

    internal static Character CreateValidCharacter(int level = 1) => new(
        Guid.Parse("f33771b4-ae75-47b6-bad0-df2a80896a67"),
        "Arannis",
        CharacterRules.Ruleset,
        CharacterRules.RulesVersion,
        new AbilityScores(8, 14, 13, 12, 10, 16),
        new ContentReference("elf", "Elf"),
        new ContentReference("acolyte", "Acolyte"),
        [new ClassProgression(
            new ContentReference("wizard", "Wizard"),
            level,
            level >= 3 ? new ContentReference("evoker", "Evoker") : null)],
        [
            new ProficiencyChoiceSelection(
                "classes/wizard/proficiencies/0",
                [
                    new ContentReference("skill-arcana", "Skill: Arcana"),
                    new ContentReference("skill-history", "Skill: History")
                ]),
            new ProficiencyChoiceSelection(
                "species/elf/traits/keen-senses/proficiencies/0",
                [new ContentReference("skill-perception", "Skill: Perception")])
        ]);
}
