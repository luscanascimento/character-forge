using System.Text.RegularExpressions;

namespace CharacterForge.Api.Features.Characters;

public sealed record RuleViolation(
    string Code,
    string Message,
    string Source,
    string Severity,
    string Requirement);

public sealed record ValidationResult(IReadOnlyList<RuleViolation> Violations)
{
    public bool IsValid => Violations.Count == 0;
}

public static partial class CharacterValidator
{
    private const string ErrorSeverity = "error";

    public static ValidationResult Validate(Character character)
    {
        var violations = new List<RuleViolation>();

        ValidateIdentity(character, violations);
        ValidateRulesIdentity(character, violations);
        ValidateAbilities(character.Abilities, violations);
        ValidateReference(character.Species, "species", "species", "Species", violations);
        ValidateReference(character.Background, "background", "background", "Background", violations);
        ValidateClassProgressions(character.ClassProgressions, violations);
        ValidateFeatureChoices(character.FeatureChoices, violations);
        ValidateSpellSelections(character.Spells, violations);
        ValidateEquipment(character.Equipment, violations);

        return new ValidationResult(violations);
    }

    private static void ValidateEquipment(
        EquipmentSelections? equipment,
        ICollection<RuleViolation> violations)
    {
        for (var index = 0; index < (equipment?.Items?.Count ?? 0); index++)
        {
            var selection = equipment!.Items![index];
            var source = $"equipment.items[{index}]";
            ValidateReference(
                selection.Item,
                "equipment.reference",
                $"{source}.item",
                "Equipment",
                violations);
            if (selection.Quantity is < 1 or > 999)
            {
                AddViolation(
                    violations,
                    "character.equipment.quantity.outOfRange",
                    "Equipment quantity must be between 1 and 999.",
                    $"{source}.quantity",
                    "1..999");
            }
        }
    }

    private static void ValidateSpellSelections(
        SpellSelections? spells,
        ICollection<RuleViolation> violations)
    {
        if (spells is null)
        {
            return;
        }

        ValidateSpellReferences(spells.Cantrips, "cantrips", "Cantrip", violations);
        ValidateSpellReferences(spells.Spellbook, "spellbook", "Spellbook spell", violations);
        ValidateSpellReferences(spells.PreparedSpells, "preparedSpells", "Prepared spell", violations);
    }

    private static void ValidateSpellReferences(
        IReadOnlyList<ContentReference>? references,
        string group,
        string label,
        ICollection<RuleViolation> violations)
    {
        for (var index = 0; index < (references?.Count ?? 0); index++)
        {
            ValidateReference(
                references![index],
                $"spell.{group}.reference",
                $"spells.{group}[{index}]",
                label,
                violations);
        }
    }

    private static void ValidateFeatureChoices(
        IReadOnlyList<FeatureChoiceSelection>? choices,
        ICollection<RuleViolation> violations)
    {
        if (choices is null)
        {
            return;
        }

        for (var index = 0; index < choices.Count; index++)
        {
            var choice = choices[index];
            var source = $"featureChoices[{index}]";
            if (string.IsNullOrWhiteSpace(choice.RequirementId))
            {
                AddViolation(
                    violations,
                    "character.featureChoice.requirement.required",
                    "Feature requirement id is required.",
                    $"{source}.requirementId",
                    "Keep the requirement id supplied by the active feature rules.");
            }
            if (string.IsNullOrWhiteSpace(choice.BranchId))
            {
                AddViolation(
                    violations,
                    "character.featureChoice.branch.required",
                    "Feature choice branch id is required.",
                    $"{source}.branchId",
                    "Keep the branch id supplied by the active feature rules.");
            }

            for (var optionIndex = 0; optionIndex < (choice.Selections?.Count ?? 0); optionIndex++)
            {
                ValidateReference(
                    choice.Selections![optionIndex],
                    "featureChoice.selection.reference",
                    $"{source}.selections[{optionIndex}]",
                    "Feature option",
                    violations);
            }
        }
    }

    private static void ValidateIdentity(Character character, ICollection<RuleViolation> violations)
    {
        if (character.Id == Guid.Empty)
        {
            AddViolation(
                violations,
                "character.id.required",
                "Character id is required.",
                "id",
                "Use a non-empty UUID.");
        }

        if (string.IsNullOrWhiteSpace(character.Name))
        {
            AddViolation(
                violations,
                "character.name.required",
                "Character name is required.",
                "name",
                "Choose a character name.");
        }
    }

    private static void ValidateRulesIdentity(Character character, ICollection<RuleViolation> violations)
    {
        if (!string.Equals(character.Ruleset, CharacterRules.Ruleset, StringComparison.Ordinal))
        {
            AddViolation(
                violations,
                "character.ruleset.unsupported",
                $"Ruleset must be '{CharacterRules.Ruleset}'.",
                "ruleset",
                CharacterRules.Ruleset);
        }

        if (!string.Equals(character.RulesVersion, CharacterRules.RulesVersion, StringComparison.Ordinal))
        {
            AddViolation(
                violations,
                "character.rulesVersion.unsupported",
                $"Rules version must be '{CharacterRules.RulesVersion}'.",
                "rulesVersion",
                CharacterRules.RulesVersion);
        }
    }

    private static void ValidateAbilities(AbilityScores? abilities, ICollection<RuleViolation> violations)
    {
        if (abilities is null)
        {
            AddViolation(
                violations,
                "character.abilities.required",
                "All six ability scores are required.",
                "abilities",
                "Provide strength, dexterity, constitution, intelligence, wisdom, and charisma.");
            return;
        }

        ValidateAbility("strength", abilities.Strength, violations);
        ValidateAbility("dexterity", abilities.Dexterity, violations);
        ValidateAbility("constitution", abilities.Constitution, violations);
        ValidateAbility("intelligence", abilities.Intelligence, violations);
        ValidateAbility("wisdom", abilities.Wisdom, violations);
        ValidateAbility("charisma", abilities.Charisma, violations);
    }

    private static void ValidateAbility(
        string ability,
        int score,
        ICollection<RuleViolation> violations)
    {
        if (score is < CharacterRules.MinimumAbilityScore or > CharacterRules.MaximumAbilityScore)
        {
            AddViolation(
                violations,
                "character.ability.outOfRange",
                $"{char.ToUpperInvariant(ability[0]) + ability[1..]} must be between " +
                    $"{CharacterRules.MinimumAbilityScore} and {CharacterRules.MaximumAbilityScore}.",
                $"abilities.{ability}",
                $"{CharacterRules.MinimumAbilityScore}..{CharacterRules.MaximumAbilityScore}");
        }
    }

    private static void ValidateReference(
        ContentReference? reference,
        string codePrefix,
        string source,
        string label,
        ICollection<RuleViolation> violations)
    {
        if (reference is null || string.IsNullOrWhiteSpace(reference.Id))
        {
            AddViolation(
                violations,
                $"character.{codePrefix}.required",
                $"{label} selection is required.",
                source,
                $"Choose one {label.ToLowerInvariant()} from the active catalog.");
            return;
        }

        if (reference.Id.Length > 80 || !CatalogIdPattern().IsMatch(reference.Id))
        {
            AddViolation(
                violations,
                $"character.{codePrefix}.id.invalid",
                $"{label} reference id is invalid.",
                $"{source}.id",
                "Use the lowercase id supplied by the active catalog.");
        }

        if (string.IsNullOrWhiteSpace(reference.Name))
        {
            AddViolation(
                violations,
                $"character.{codePrefix}.name.required",
                $"{label} reference name is required.",
                $"{source}.name",
                "Keep the catalog display name with the reference.");
        }
    }

    private static void ValidateClassProgressions(
        IReadOnlyList<ClassProgression>? progressions,
        ICollection<RuleViolation> violations)
    {
        if (progressions is null || progressions.Count == 0)
        {
            AddViolation(
                violations,
                "character.class.required",
                "A class selection is required.",
                "classProgressions",
                "Choose exactly one class.");
            return;
        }

        if (progressions.Count != 1)
        {
            AddViolation(
                violations,
                "character.class.count",
                "The current rules implementation supports exactly one class.",
                "classProgressions",
                "Exactly one class progression.");
        }

        for (var index = 0; index < progressions.Count; index++)
        {
            var progression = progressions[index];
            var source = $"classProgressions[{index}]";

            ValidateReference(
                progression.Class,
                "class.reference",
                $"{source}.class",
                "Class",
                violations);

            if (progression.Subclass is not null)
            {
                ValidateReference(
                    progression.Subclass,
                    "subclass.reference",
                    $"{source}.subclass",
                    "Subclass",
                    violations);
            }

            if (progression.Level is < CharacterRules.MinimumLevel or > CharacterRules.MaximumLevel)
            {
                AddViolation(
                    violations,
                    "character.class.level.outOfRange",
                    $"Class level must be between {CharacterRules.MinimumLevel} and {CharacterRules.MaximumLevel}.",
                    $"{source}.level",
                    $"{CharacterRules.MinimumLevel}..{CharacterRules.MaximumLevel}");
            }
        }
    }

    private static void AddViolation(
        ICollection<RuleViolation> violations,
        string code,
        string message,
        string source,
        string requirement) => violations.Add(new RuleViolation(
            code,
            message,
            source,
            ErrorSeverity,
            requirement));

    [GeneratedRegex("^[a-z0-9]+(?:-[a-z0-9]+)*$", RegexOptions.CultureInvariant)]
    private static partial Regex CatalogIdPattern();
}
