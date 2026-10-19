namespace CharacterForge.Api.Features.Characters;

public sealed record AbilityModifiers(
    int Strength,
    int Dexterity,
    int Constitution,
    int Intelligence,
    int Wisdom,
    int Charisma);

public sealed record CharacterDerivedValues(
    AbilityScores BaseAbilities,
    AbilityScores EffectiveAbilities,
    AbilityModifiers AbilityModifiers,
    int ProficiencyBonus,
    int ArmorClass,
    int WalkingSpeed,
    bool HasStealthDisadvantage,
    int? HitPointMaximum,
    int HitDie,
    IReadOnlyList<GrantedProficiency> GrantedProficiencies,
    SpellcastingDerivedValues? Spellcasting = null,
    IReadOnlyList<ResolvedWeaponMastery>? WeaponMasteries = null,
    IReadOnlyList<ResolvedWeaponAttack>? WeaponAttacks = null);

public sealed record SpellcastingDerivedValues(
    ContentReference Ability,
    int CantripsKnown,
    int PreparedSpells,
    IReadOnlyList<SpellSlotAvailability> Slots,
    int SpellSaveDc,
    int SpellAttackModifier);

public sealed record ProficiencySource(
    string Category,
    ContentReference Selection);

public sealed record ProficiencyGrant(
    ContentReference Proficiency,
    ProficiencySource Source,
    bool IsSkill = false);

public sealed record GrantedProficiency(
    ContentReference Proficiency,
    IReadOnlyList<ProficiencySource> Sources,
    bool IsSkill);

public sealed record ProficiencyChoiceRule(
    string Id,
    string Prompt,
    int Count,
    IReadOnlyList<ContentReference> Options,
    ProficiencySource Source,
    IReadOnlySet<string>? SkillOptionIds = null);

public sealed record SubclassRule(
    ContentReference Subclass,
    int AvailableAtLevel);

public sealed record SpellOptionRule(
    ContentReference Spell,
    int SpellLevel);

public sealed record SpellSelectionRule(
    string PreparedSpellSource,
    int CantripCount,
    int PreparedSpellCount,
    int MaximumPreparedSpellLevel,
    IReadOnlyList<SpellOptionRule> ClassSpells,
    int MinimumSpellbookSpells = 0);

public sealed record EquipmentItemRule(
    ContentReference Item,
    IReadOnlySet<string> CategoryIds,
    ArmorEquipmentRule? Armor,
    WeaponEquipmentRule? Weapon = null);

public sealed record ArmorEquipmentRule(
    int BaseArmorClass,
    bool AddsDexterity,
    int? MaximumDexterityBonus,
    int StrengthMinimum = 0,
    bool ImposesStealthDisadvantage = false);

public sealed record WeaponDamageRule(string Dice, ContentReference Type);

public sealed record WeaponRangeRule(int Normal, int? Long);

public sealed record WeaponEquipmentRule(
    WeaponDamageRule Damage,
    WeaponDamageRule? TwoHandedDamage,
    WeaponRangeRule? Range,
    IReadOnlySet<string> PropertyIds,
    string Kind,
    ContentReference Mastery);

public sealed record WeaponMasteryRule(
    int Capacity,
    string ManifestVersion,
    IReadOnlyDictionary<string, string> SpecificProficiencyWeapons);

public sealed record ResolvedWeaponMastery(
    ContentReference Weapon,
    ContentReference Mastery);

public sealed record ResolvedWeaponAttack(
    ContentReference Weapon,
    string AbilityId,
    int AttackModifier,
    WeaponDamageRule Damage,
    int DamageModifier,
    bool IsProficient,
    bool TwoHanded,
    WeaponRangeRule? Range,
    ContentReference? Mastery);

public sealed record CharacterRulesContext(
    int HitDie,
    IReadOnlyList<ProficiencyGrant> ProficiencyGrants,
    IReadOnlyList<ProficiencyChoiceRule> ProficiencyChoices,
    IReadOnlyList<SubclassRule> Subclasses,
    IReadOnlyList<FeatureChoiceRequirementRule>? FeatureChoices = null,
    SpellcastingProgressionRule? Spellcasting = null,
    SpellSelectionRule? SpellSelections = null,
    IReadOnlyList<EquipmentItemRule>? Equipment = null,
    IReadOnlyList<FeatChoiceOccurrenceRule>? FeatChoices = null,
    bool RequireActiveFeatChoices = true,
    WeaponMasteryRule? WeaponMastery = null,
    int BaseWalkingSpeed = 30);

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
        var grantedProficiencies = ProficiencyRules.MergeGrants(proficiencyResolution.Grants);
        var featureChoiceRules = ResolveFeatureChoiceOptions(
            context.FeatureChoices ?? [],
            grantedProficiencies);
        var featureChoiceValidation = FeatureChoiceRules.Validate(
            character.FeatureChoices,
            featureChoiceRules,
            classProgression);
        var fightingStyleEffects = FightingStyleEffectRules.Resolve(character.FeatureChoices);
        var spellSelectionValidation = SpellSelectionRules.Validate(
            character.Spells,
            context.SpellSelections);
        var featResolution = FeatSelectionRules.Resolve(
            character.Feats,
            context.FeatChoices ?? [],
            classProgression.Level,
            character.Abilities!,
            context.RequireActiveFeatChoices);
        var effectiveAbilities = featResolution.EffectiveAbilities;
        var equipmentResolution = EquipmentRules.Resolve(
            character.Equipment,
            context.Equipment ?? [],
            effectiveAbilities.Dexterity,
            grantedProficiencies,
            effectiveAbilities.Strength,
            context.BaseWalkingSpeed,
            fightingStyleEffects.HasDefense ? 1 : 0);
        var weaponMasteryResolution = WeaponMasteryRules.Resolve(
            character.WeaponMasteries,
            context.WeaponMastery,
            character.Equipment,
            context.Equipment ?? [],
            grantedProficiencies);
        var proficiencyBonus = ProficiencyRules.GetBonus(classProgression.Level);
        var weaponAttackResolution = WeaponAttackRules.Resolve(
            character.WeaponAttacks,
            character.Equipment,
            context.Equipment ?? [],
            grantedProficiencies,
            effectiveAbilities,
            proficiencyBonus,
            weaponMasteryResolution.Masteries,
            fightingStyleEffects.HasArchery ? 2 : 0);
        var ruleViolations = progressionValidation.Violations
            .Concat(proficiencyResolution.Validation.Violations)
            .Concat(featureChoiceValidation.Violations)
            .Concat(fightingStyleEffects.Validation.Violations)
            .Concat(spellSelectionValidation.Violations)
            .Concat(featResolution.Validation.Violations)
            .Concat(equipmentResolution.Validation.Violations)
            .Concat(weaponMasteryResolution.Validation.Violations)
            .Concat(weaponAttackResolution.Validation.Violations)
            .ToArray();
        if (ruleViolations.Length > 0)
        {
            return new CharacterEvaluation(new ValidationResult(ruleViolations), null);
        }

        var baseAbilities = character.Abilities!;
        var abilities = effectiveAbilities;

        return new CharacterEvaluation(
            validation,
            new CharacterDerivedValues(
                baseAbilities,
                abilities,
                new AbilityModifiers(
                    AbilityRules.GetModifier(abilities.Strength),
                    AbilityRules.GetModifier(abilities.Dexterity),
                    AbilityRules.GetModifier(abilities.Constitution),
                    AbilityRules.GetModifier(abilities.Intelligence),
                    AbilityRules.GetModifier(abilities.Wisdom),
                    AbilityRules.GetModifier(abilities.Charisma)),
                proficiencyBonus,
                equipmentResolution.ArmorClass,
                equipmentResolution.WalkingSpeed,
                equipmentResolution.HasStealthDisadvantage,
                HitPointRules.GetFixedMaximum(
                    context.HitDie,
                    abilities.Constitution,
                    classProgression.Level),
                context.HitDie,
                grantedProficiencies,
                SpellcastingRules.Resolve(
                    context.Spellcasting,
                    classProgression.Level,
                    abilities),
                weaponMasteryResolution.Masteries,
                weaponAttackResolution.Attacks));
    }

    private static IReadOnlyList<FeatureChoiceRequirementRule> ResolveFeatureChoiceOptions(
        IReadOnlyList<FeatureChoiceRequirementRule> requirements,
        IReadOnlyList<GrantedProficiency> proficiencies)
    {
        var skills = proficiencies
            .Where(proficiency => proficiency.IsSkill)
            .Select(proficiency => proficiency.Proficiency)
            .ToArray();

        return requirements
            .Select(requirement => requirement with
            {
                Branches = requirement.Branches
                    .Select(branch => branch.UsesProficientSkills
                        ? branch with { Options = skills }
                        : branch)
                    .ToArray()
            })
            .ToArray();
    }
}
