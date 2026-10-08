using CharacterForge.Api.Features.Catalog;
using CharacterForge.Api.Features.Progression;
using CharacterForge.Api.Features.FeatureRules;
using CharacterForge.Api.Infrastructure.Srd;

namespace CharacterForge.Api.Features.Characters;

public sealed class CharacterEvaluationService(
    CatalogService catalog,
    ClassProgressionService classProgressions,
    FeatureRuleService featureRules)
{
    public async Task<CharacterEvaluation> EvaluateAsync(
        Character character,
        CancellationToken cancellationToken)
    {
        var validation = CharacterValidator.Validate(character);
        if (!validation.IsValid)
        {
            return new CharacterEvaluation(validation, null);
        }

        var progression = character.ClassProgressions![0];
        var classTask = catalog.GetItemAsync(
            CatalogCategory.Classes,
            progression.Class!.Id!,
            cancellationToken);
        var speciesTask = catalog.GetItemAsync(
            CatalogCategory.Species,
            character.Species!.Id!,
            cancellationToken);
        var backgroundTask = catalog.GetItemAsync(
            CatalogCategory.Backgrounds,
            character.Background!.Id!,
            cancellationToken);
        var classProgressionTask = classProgressions.GetAsync(
            progression.Class.Id!,
            cancellationToken);
        var featureRulesTask = featureRules.GetAsync(progression.Class.Id!, cancellationToken);

        await Task.WhenAll(classTask, speciesTask, backgroundTask, classProgressionTask, featureRulesTask);

        var selectedClass = await classTask;
        var species = await speciesTask;
        var background = await backgroundTask;
        var classProgression = await classProgressionTask;
        var featureRuleDocument = await featureRulesTask;
        var missingContent = MissingContentViolations(selectedClass, species, background);
        if (missingContent.Count > 0)
        {
            return new CharacterEvaluation(new ValidationResult(missingContent), null);
        }

        var classFacts = RequireFacts(selectedClass!, "class");
        if (classFacts.HitDie is not int hitDie || !HitPointRules.IsSupportedHitDie(hitDie))
        {
            throw new SrdProviderException("The selected class did not provide a supported hit die.");
        }

        if (classProgression is null || !string.Equals(
            classProgression.Class.Id,
            progression.Class.Id,
            StringComparison.OrdinalIgnoreCase))
        {
            throw new SrdProviderException("The selected class did not provide a matching progression.");
        }

        if (featureRuleDocument is null || !string.Equals(
            featureRuleDocument.Class.Id,
            progression.Class.Id,
            StringComparison.OrdinalIgnoreCase))
        {
            throw new SrdProviderException("The selected class did not provide matching feature rules.");
        }

        var spellSelectionRule = await GetSpellSelectionRuleAsync(
            classProgression,
            progression.Level,
            cancellationToken);

        var grants = new List<ProficiencyGrant>();
        var choices = new List<ProficiencyChoiceRule>();
        AddFacts(grants, choices, selectedClass!, classFacts);
        AddFacts(grants, choices, species!, RequireFacts(species!, "species"));
        AddFacts(grants, choices, background!, RequireFacts(background!, "background"));

        var subclassRules = classProgression.Subclasses
            .Select(subclass => new SubclassRule(
                new ContentReference(subclass.Subclass.Id, subclass.Subclass.Name),
                subclass.AvailableAtLevel))
            .ToArray();

        return CharacterEvaluator.Evaluate(
            character,
            new CharacterRulesContext(
                hitDie,
                grants,
                choices,
                subclassRules,
                featureRuleDocument.Requirements.Select(requirement => new FeatureChoiceRequirementRule(
                    requirement.Id,
                    requirement.SubclassId,
                    requirement.AvailableAtLevel,
                    requirement.Count,
                    requirement.Branches.Select(branch => new FeatureChoiceBranchRule(
                        branch.Id,
                        branch.SelectionCount,
                        string.Equals(branch.Availability, "supported", StringComparison.Ordinal),
                        branch.Options,
                        string.Equals(
                            branch.OptionSource,
                            "proficientSkills",
                            StringComparison.Ordinal))).ToArray())).ToArray(),
                MapSpellcasting(classProgression.Spellcasting),
                spellSelectionRule));
    }

    private async Task<SpellSelectionRule?> GetSpellSelectionRuleAsync(
        ClassProgressionDocument progression,
        int classLevel,
        CancellationToken cancellationToken)
    {
        var spellcasting = progression.Spellcasting;
        if (spellcasting?.Policy is null || classLevel < spellcasting.AvailableAtLevel)
        {
            return null;
        }

        var level = spellcasting.Levels.SingleOrDefault(level => level.ClassLevel == classLevel)
            ?? throw new SrdProviderException(
                $"The selected class did not provide spellcasting for class level {classLevel}.");
        if (level.Slots.Count == 0)
        {
            throw new SrdProviderException(
                $"The selected class did not provide spell slots for class level {classLevel}.");
        }
        var maximumSpellLevel = level.Slots.Max(slot => slot.SpellLevel);

        var page = await catalog.GetPageAsync(
            CatalogCategory.Spells,
            new CatalogQuery(
                Search: null,
                Page: 1,
                PageSize: int.MaxValue,
                Sort: "level",
                Level: null,
                School: null,
                CharacterClass: progression.Class.Id),
            cancellationToken);
        var options = page.Items.Select(item => new SpellOptionRule(
            new ContentReference(item.Id, item.Name),
            item.Level ?? throw new SrdProviderException(
                $"Spell '{item.Id}' did not provide a spell level."))).ToArray();
        var minimumSpellbookSpells = spellcasting.Policy.Spellbook is null
            ? 0
            : spellcasting.Policy.Spellbook.InitialSpells
                + spellcasting.Policy.Spellbook.SpellsPerAdditionalClassLevel * (classLevel - 1);
        if (options.Select(option => option.Spell.Id).Distinct(StringComparer.OrdinalIgnoreCase).Count() !=
                options.Length ||
            options.Count(option => option.SpellLevel == 0) < level.CantripsKnown ||
            options.Count(option => option.SpellLevel is >= 1 && option.SpellLevel <= maximumSpellLevel) <
            Math.Max(level.PreparedSpells, minimumSpellbookSpells))
        {
            throw new SrdProviderException(
                $"The spell catalog did not provide enough eligible options for class '{progression.Class.Id}'.");
        }

        return new SpellSelectionRule(
            spellcasting.Policy.PreparedSpellSource,
            level.CantripsKnown,
            level.PreparedSpells,
            maximumSpellLevel,
            options,
            minimumSpellbookSpells);
    }

    private static SpellcastingProgressionRule? MapSpellcasting(
        ClassSpellcastingProgression? progression) => progression is null
            ? null
            : new SpellcastingProgressionRule(
                progression.AvailableAtLevel,
                new ContentReference(progression.Ability.Id, progression.Ability.Name),
                progression.Levels.Select(level => new SpellcastingLevelRule(
                    level.ClassLevel,
                    level.CantripsKnown,
                    level.PreparedSpells,
                    level.Slots.Select(slot => new SpellSlotAvailability(
                        slot.SpellLevel,
                        slot.Count)).ToArray())).ToArray());

    private static List<RuleViolation> MissingContentViolations(
        CatalogItemDetail? selectedClass,
        CatalogItemDetail? species,
        CatalogItemDetail? background)
    {
        var violations = new List<RuleViolation>();
        AddMissingContentViolation(violations, selectedClass, "class", "classProgressions[0].class");
        AddMissingContentViolation(violations, species, "species", "species");
        AddMissingContentViolation(violations, background, "background", "background");
        return violations;
    }

    private static void AddMissingContentViolation(
        ICollection<RuleViolation> violations,
        CatalogItemDetail? item,
        string category,
        string source)
    {
        if (item is not null)
        {
            return;
        }

        violations.Add(new RuleViolation(
            $"character.{category}.notFound",
            $"The selected {category} is not in the active catalog.",
            source,
            "error",
            $"Choose a {category} from the 2024 / SRD-5.2.1 catalog."));
    }

    private static CatalogCharacterCreationFacts RequireFacts(CatalogItemDetail item, string category) =>
        item.CharacterCreation
        ?? throw new SrdProviderException($"The selected {category} did not provide character creation facts.");

    private static void AddFacts(
        ICollection<ProficiencyGrant> grants,
        ICollection<ProficiencyChoiceRule> choices,
        CatalogItemDetail item,
        CatalogCharacterCreationFacts facts)
    {
        var source = new ProficiencySource(
            item.Category,
            new ContentReference(item.Id, item.Name));

        foreach (var proficiency in facts.GrantedProficiencies)
        {
            grants.Add(new ProficiencyGrant(
                new ContentReference(proficiency.Id, proficiency.Name),
                source,
                proficiency.IsSkill));
        }

        foreach (var choice in facts.ProficiencyChoices)
        {
            choices.Add(new ProficiencyChoiceRule(
                choice.Id,
                choice.Prompt,
                choice.Count,
                choice.Options
                    .Select(option => new ContentReference(option.Id, option.Name))
                    .ToArray(),
                source,
                choice.Options
                    .Where(option => option.IsSkill)
                    .Select(option => option.Id)
                    .ToHashSet(StringComparer.OrdinalIgnoreCase)));
        }
    }
}
