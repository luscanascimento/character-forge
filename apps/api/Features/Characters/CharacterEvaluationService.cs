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
                            StringComparison.Ordinal))).ToArray())).ToArray()));
    }

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
