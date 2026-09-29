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

public sealed record CharacterRulesContext(
    int HitDie,
    IReadOnlyList<ProficiencyGrant> ProficiencyGrants);

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

        var abilities = character.Abilities!;
        var progression = character.ClassProgressions![0];

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
                ProficiencyRules.GetBonus(progression.Level),
                ArmorClassRules.GetUnarmored(abilities.Dexterity),
                progression.Level == 1
                    ? HitPointRules.GetLevelOneMaximum(context.HitDie, abilities.Constitution)
                    : null,
                context.HitDie,
                ProficiencyRules.MergeGrants(context.ProficiencyGrants)));
    }
}
