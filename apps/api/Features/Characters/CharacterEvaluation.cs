namespace CharacterForge.Api.Features.Characters;

public sealed record AbilityModifiers(
    int Strength,
    int Dexterity,
    int Constitution,
    int Intelligence,
    int Wisdom,
    int Charisma);

public sealed record CharacterDerivedValues(
    AbilityModifiers AbilityModifiers,
    int ProficiencyBonus,
    int ArmorClass,
    int? HitPointMaximum,
    int HitDie,
    IReadOnlyList<GrantedProficiency> GrantedProficiencies);

public sealed record ProficiencySource(
    string Category,
    ContentReference Selection);

public sealed record ProficiencyGrant(
    ContentReference Proficiency,
    ProficiencySource Source);

public sealed record GrantedProficiency(
    ContentReference Proficiency,
    IReadOnlyList<ProficiencySource> Sources);

public sealed record ProficiencyChoiceRule(
    string Id,
    string Prompt,
    int Count,
    IReadOnlyList<ContentReference> Options,
    ProficiencySource Source);

public sealed record SubclassRule(
    ContentReference Subclass,
    int AvailableAtLevel);

public sealed record CharacterRulesContext(
    int HitDie,
    IReadOnlyList<ProficiencyGrant> ProficiencyGrants,
    IReadOnlyList<ProficiencyChoiceRule> ProficiencyChoices,
    IReadOnlyList<SubclassRule> Subclasses,
    IReadOnlyList<FeatureChoiceRequirementRule>? FeatureChoices = null);

public sealed record CharacterEvaluation(
    ValidationResult Validation,
    CharacterDerivedValues? Derived);

public static class CharacterEvaluator
{
    public static CharacterEvaluation Evaluate(Character character, CharacterRulesContext context)
    {
        var validation = CharacterValidator.Validate(character);
        if (!validation.IsValid)
        {
            return new CharacterEvaluation(validation, null);
        }

        var classProgression = character.ClassProgressions![0];
        var progressionValidation = ClassProgressionRules.Validate(
            classProgression,
            context.Subclasses);
        var proficiencyResolution = ProficiencyChoiceRules.Resolve(
            character.ProficiencyChoices,
            context.ProficiencyChoices,
            context.ProficiencyGrants);
        var featureChoiceValidation = FeatureChoiceRules.Validate(
            character.FeatureChoices,
            context.FeatureChoices ?? [],
            classProgression);
        var ruleViolations = progressionValidation.Violations
            .Concat(proficiencyResolution.Validation.Violations)
            .Concat(featureChoiceValidation.Violations)
            .ToArray();
        if (ruleViolations.Length > 0)
        {
            return new CharacterEvaluation(new ValidationResult(ruleViolations), null);
        }

        var abilities = character.Abilities!;

        return new CharacterEvaluation(
            validation,
            new CharacterDerivedValues(
                new AbilityModifiers(
                    AbilityRules.GetModifier(abilities.Strength),
                    AbilityRules.GetModifier(abilities.Dexterity),
                    AbilityRules.GetModifier(abilities.Constitution),
                    AbilityRules.GetModifier(abilities.Intelligence),
                    AbilityRules.GetModifier(abilities.Wisdom),
                    AbilityRules.GetModifier(abilities.Charisma)),
                ProficiencyRules.GetBonus(classProgression.Level),
                ArmorClassRules.GetUnarmored(abilities.Dexterity),
                HitPointRules.GetFixedMaximum(
                    context.HitDie,
                    abilities.Constitution,
                    classProgression.Level),
                context.HitDie,
                ProficiencyRules.MergeGrants(proficiencyResolution.Grants)));
    }
}
