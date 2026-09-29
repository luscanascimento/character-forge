using CharacterForge.Api.Features.Characters;

namespace CharacterForge.Api.Tests;

public sealed class ProficiencyChoiceRulesTests
{
    [Fact]
    public void Resolve_AcceptsEveryRequiredChoiceAndUsesCanonicalOptions()
    {
        var rules = CreateRules();
        var selections = new[]
        {
            new ProficiencyChoiceSelection(
                rules[0].Id,
                [
                    new ContentReference("skill-arcana", "Spoofed name"),
                    new ContentReference("skill-history", "History")
                ]),
            new ProficiencyChoiceSelection(
                rules[1].Id,
                [new ContentReference("skill-perception", "Perception")])
        };

        var result = ProficiencyChoiceRules.Resolve(selections, rules, CreateFixedGrants());

        Assert.True(result.Validation.IsValid);
        Assert.Equal(4, result.Grants.Count);
        Assert.Contains(
            result.Grants,
            grant => grant.Proficiency is { Id: "skill-arcana", Name: "Skill: Arcana" });
    }

    [Fact]
    public void Resolve_ReportsEveryMissingChoice()
    {
        var result = ProficiencyChoiceRules.Resolve(null, CreateRules(), CreateFixedGrants());

        Assert.Equal(
            2,
            result.Validation.Violations.Count(
                violation => violation.Code == "character.proficiencyChoice.required"));
    }

    [Fact]
    public void Resolve_ReportsStaleChoiceId()
    {
        var selections = new[]
        {
            new ProficiencyChoiceSelection(
                "classes/removed/proficiencies/0",
                [new ContentReference("skill-arcana", "Skill: Arcana")])
        };

        var result = ProficiencyChoiceRules.Resolve(selections, CreateRules(), CreateFixedGrants());

        Assert.Contains(
            result.Validation.Violations,
            violation => violation.Code == "character.proficiencyChoice.stale");
    }

    [Fact]
    public void Resolve_ReportsWrongCountAndDisallowedOption()
    {
        var rules = CreateRules();
        var selections = new[]
        {
            new ProficiencyChoiceSelection(
                rules[0].Id,
                [new ContentReference("skill-arcana", "Skill: Arcana")]),
            new ProficiencyChoiceSelection(
                rules[1].Id,
                [new ContentReference("skill-deception", "Skill: Deception")])
        };

        var result = ProficiencyChoiceRules.Resolve(selections, rules, CreateFixedGrants());

        Assert.Contains(
            result.Validation.Violations,
            violation => violation.Code == "character.proficiencyChoice.count");
        Assert.Contains(
            result.Validation.Violations,
            violation => violation.Code == "character.proficiencyChoice.option.invalid");
    }

    [Fact]
    public void Resolve_RejectsChoiceThatDuplicatesFixedGrant()
    {
        var rules = CreateRules();
        var selections = new[]
        {
            new ProficiencyChoiceSelection(
                rules[0].Id,
                [
                    new ContentReference("skill-insight", "Skill: Insight"),
                    new ContentReference("skill-history", "Skill: History")
                ]),
            new ProficiencyChoiceSelection(
                rules[1].Id,
                [new ContentReference("skill-perception", "Skill: Perception")])
        };

        var result = ProficiencyChoiceRules.Resolve(selections, rules, CreateFixedGrants());

        Assert.Contains(
            result.Validation.Violations,
            violation => violation.Code == "character.proficiencyChoice.selection.duplicate");
    }

    [Fact]
    public void Resolve_RejectsProficiencySelectedByTwoChoices()
    {
        var source = new ProficiencySource("species", new ContentReference("human", "Human"));
        var rules = new[]
        {
            Choice("first", 1, source, "skill-perception"),
            Choice("second", 1, source, "skill-perception")
        };
        var selections = new[]
        {
            new ProficiencyChoiceSelection(
                "first",
                [new ContentReference("skill-perception", "Skill: Perception")]),
            new ProficiencyChoiceSelection(
                "second",
                [new ContentReference("skill-perception", "Skill: Perception")])
        };

        var result = ProficiencyChoiceRules.Resolve(selections, rules, []);

        Assert.Contains(
            result.Validation.Violations,
            violation => violation.Code == "character.proficiencyChoice.selection.duplicate");
    }

    [Fact]
    public void Resolve_RejectsDuplicateChoiceSubmission()
    {
        var rules = CreateRules();
        var selections = new[]
        {
            new ProficiencyChoiceSelection(rules[0].Id, []),
            new ProficiencyChoiceSelection(rules[0].Id, [])
        };

        var result = ProficiencyChoiceRules.Resolve(selections, rules, CreateFixedGrants());

        Assert.Contains(
            result.Validation.Violations,
            violation => violation.Code == "character.proficiencyChoice.duplicate");
    }

    private static IReadOnlyList<ProficiencyChoiceRule> CreateRules()
    {
        var classSource = new ProficiencySource(
            "classes",
            new ContentReference("wizard", "Wizard"));
        var speciesSource = new ProficiencySource(
            "species",
            new ContentReference("elf", "Elf"));

        return
        [
            Choice(
                "classes/wizard/proficiencies/0",
                2,
                classSource,
                "skill-arcana",
                "skill-history",
                "skill-insight"),
            Choice(
                "species/elf/traits/keen-senses/proficiencies/0",
                1,
                speciesSource,
                "skill-perception",
                "skill-survival")
        ];
    }

    private static ProficiencyChoiceRule Choice(
        string id,
        int count,
        ProficiencySource source,
        params string[] optionIds) => new(
        id,
        $"Choose {count}",
        count,
        optionIds
            .Select(option => new ContentReference(
                option,
                $"Skill: {char.ToUpperInvariant(option[6]) + option[7..]}"))
            .ToArray(),
        source);

    private static IReadOnlyList<ProficiencyGrant> CreateFixedGrants() =>
    [
        new ProficiencyGrant(
            new ContentReference("skill-insight", "Skill: Insight"),
            new ProficiencySource("backgrounds", new ContentReference("acolyte", "Acolyte")))
    ];
}
