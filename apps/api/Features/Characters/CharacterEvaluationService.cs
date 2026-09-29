using CharacterForge.Api.Features.Catalog;
using CharacterForge.Api.Infrastructure.Srd;

namespace CharacterForge.Api.Features.Characters;

public sealed class CharacterEvaluationService(CatalogService catalog)
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

        await Task.WhenAll(classTask, speciesTask, backgroundTask);

        var selectedClass = await classTask;
        var species = await speciesTask;
        var background = await backgroundTask;
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

        var grants = new List<ProficiencyGrant>();
        AddGrants(grants, selectedClass!, classFacts);
        AddGrants(grants, species!, RequireFacts(species!, "species"));
        AddGrants(grants, background!, RequireFacts(background!, "background"));

        return CharacterEvaluator.Evaluate(character, new CharacterRulesContext(hitDie, grants));
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

    private static void AddGrants(
        ICollection<ProficiencyGrant> grants,
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
                source));
        }
    }
}
