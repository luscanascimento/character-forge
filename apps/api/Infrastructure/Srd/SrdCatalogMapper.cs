using System.Globalization;
using CharacterForge.Api.Features.Catalog;
using CharacterForge.Api.Features.Characters;

namespace CharacterForge.Api.Infrastructure.Srd;

internal static class SrdCatalogMapper
{
    public static CatalogItemDetail Map(SrdClassDetail item) => new(
        item.Index,
        item.Name,
        CatalogCategory.Classes.ToSlug(),
        item.PrimaryAbility is null ? [] : [item.PrimaryAbility.Desc],
        Compact([
            new("Hit Die", $"d{item.HitDie}"),
            new("Primary Ability", item.PrimaryAbility?.Desc ?? string.Empty),
            new("Spellcasting Ability", item.Spellcasting?.SpellcastingAbility.Name ?? string.Empty)
        ]),
        CompactSections([
            Section("Proficiencies", item.Proficiencies),
            Section("Saving Throws", item.SavingThrows),
            Section("Subclasses", item.Subclasses)
        ]),
        CharacterCreation: new CatalogCharacterCreationFacts(
            item.HitDie,
            ProficiencyReferences(item.Proficiencies),
            ProficiencyChoices($"classes/{item.Index}", item.ProficiencyChoices),
            EquipmentChoices($"classes/{item.Index}", item.StartingEquipmentOptions)));

    public static CatalogItemDetail Map(
        SrdSpeciesDetail item,
        IReadOnlyList<SrdTraitDetail> traits) => new(
        item.Index,
        item.Name,
        CatalogCategory.Species.ToSlug(),
        [],
        [
            new("Creature Type", item.Type),
            new("Size", item.Size),
            new("Speed", $"{item.Speed} ft.")
        ],
        CompactSections([
            Section("Traits", item.Traits),
            Section("Subspecies", item.Subspecies)
        ]),
        CharacterCreation: new CatalogCharacterCreationFacts(
            HitDie: null,
            ProficiencyReferences(item.Proficiencies),
            traits
                .Where(trait => trait.ProficiencyChoice is not null)
                .Select(trait => ProficiencyChoice(
                    $"species/{item.Index}/traits/{trait.Index}/proficiencies/0",
                    trait.ProficiencyChoice!))
                .ToArray()));

    public static CatalogItemDetail Map(SrdBackgroundDetail item) => new(
        item.Index,
        item.Name,
        CatalogCategory.Backgrounds.ToSlug(),
        [],
        Compact([
            new("Ability Scores", JoinNames(item.AbilityScores)),
            new("Origin Feat", item.Feat is null
                ? string.Empty
                : item.Feat.Note is null ? item.Feat.Name : $"{item.Feat.Name} ({item.Feat.Note})")
        ]),
        CompactSections([
            Section("Proficiencies", item.Proficiencies),
            Section("Feat", item.Feat is null ? [] : [item.Feat])
        ]),
        CharacterCreation: new CatalogCharacterCreationFacts(
            HitDie: null,
            ProficiencyReferences(item.Proficiencies),
            ProficiencyChoices($"backgrounds/{item.Index}", item.ProficiencyChoices),
            EquipmentChoices($"backgrounds/{item.Index}", item.EquipmentOptions)));

    public static CatalogItemDetail Map(SrdFeatDetail item) => new(
        item.Index,
        item.Name,
        CatalogCategory.Feats.ToSlug(),
        Text(item.Description),
        Compact([new("Type", TitleCase(item.Type))]),
        [],
        Feat: FeatFacts(item));

    public static CatalogItemDetail Map(SrdSpellDetail item) => new(
        item.Index,
        item.Name,
        CatalogCategory.Spells.ToSlug(),
        Text(item.Description),
        Compact([
            new("Level", item.Level == 0 ? "Cantrip" : item.Level.ToString(CultureInfo.InvariantCulture)),
            new("School", item.School.Name),
            new("Casting Time", item.CastingTime),
            new("Range", item.Range),
            new("Components", item.Components is null ? string.Empty : string.Join(", ", item.Components)),
            new("Duration", item.Duration),
            new("Ritual", YesNo(item.Ritual)),
            new("Concentration", YesNo(item.Concentration)),
            new("Material", item.Material ?? string.Empty)
        ]),
        CompactSections([
            Section("Classes", item.Classes),
            Section("Subclasses", item.Subclasses)
        ]),
        TextSections: string.IsNullOrWhiteSpace(item.HigherLevel)
            ? []
            : [new CatalogTextSection("At Higher Levels", Text(item.HigherLevel))]);

    public static CatalogItemDetail Map(SrdEquipmentDetail item)
    {
        var descriptions = item.Description?
            .Where(description => !string.IsNullOrWhiteSpace(description))
            .SelectMany(description => description.Split("\n", StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            .ToList() ?? [];
        if (item.Notes is not null)
        {
            descriptions.AddRange(item.Notes.Where(note => !string.IsNullOrWhiteSpace(note)));
        }

        return new(
            item.Index,
            item.Name,
            CatalogCategory.Equipment.ToSlug(),
            descriptions,
            Compact([
                new("Category", JoinNames(item.EquipmentCategories)),
                new("Cost", item.Cost is null ? string.Empty : $"{item.Cost.Quantity:g} {item.Cost.Unit}"),
                new("Weight", item.Weight is null ? string.Empty : $"{item.Weight:g} lb."),
                new("Damage", FormatDamage(item.Damage)),
                new("Two-Handed Damage", FormatDamage(item.TwoHandedDamage)),
                new("Range", FormatRange(item.Range)),
                new("Armor Class", FormatArmorClass(item.ArmorClass)),
                new("Strength Minimum", item.StrengthMinimum?.ToString(CultureInfo.InvariantCulture) ?? string.Empty),
                new("Stealth Disadvantage", item.StealthDisadvantage is null ? string.Empty : YesNo(item.StealthDisadvantage.Value)),
                new("Don / Doff", item.DonTime is null && item.DoffTime is null
                    ? string.Empty
                    : $"{item.DonTime ?? "—"} / {item.DoffTime ?? "—"}"),
                new("Mastery", item.Mastery?.Name ?? string.Empty)
            ]),
            CompactSections([Section("Properties", item.Properties)]),
            Equipment: EquipmentFacts(item));
    }

    private static List<string> Text(params string?[] values) => values
        .Where(value => !string.IsNullOrWhiteSpace(value))
        .SelectMany(value => value!.Split("\n", StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        .ToList();

    private static IReadOnlyList<CatalogAttribute> Compact(IEnumerable<CatalogAttribute> attributes) =>
        attributes.Where(attribute => !string.IsNullOrWhiteSpace(attribute.Value)).ToArray();

    private static IReadOnlyList<CatalogSection> CompactSections(IEnumerable<CatalogSection> sections) =>
        sections.Where(section => section.Entries.Count > 0).ToArray();

    private static CatalogSection Section(string title, IReadOnlyList<SrdReference>? references) => new(
        title,
        References(references));

    private static IReadOnlyList<CatalogReference> References(IReadOnlyList<SrdReference>? references) =>
        references?.Select(reference => new CatalogReference(reference.Index, reference.Name, reference.Note)).ToArray()
        ?? [];

    private static IReadOnlyList<CatalogProficiencyReference> ProficiencyReferences(
        IReadOnlyList<SrdReference>? references) =>
        references?.Select(ProficiencyReference).ToArray() ?? [];

    private static IReadOnlyList<CatalogProficiencyChoice> ProficiencyChoices(
        string source,
        IReadOnlyList<SrdChoice>? choices) => choices?
        .Select((choice, index) => ProficiencyChoice($"{source}/proficiencies/{index}", choice))
        .ToArray() ?? [];

    private static CatalogProficiencyChoice ProficiencyChoice(string id, SrdChoice choice)
    {
        var options = FlattenProficiencyOptions(choice)
            .DistinctBy(option => option.Id, StringComparer.OrdinalIgnoreCase)
            .ToArray();
        if (choice.Choose < 1 || options.Length < choice.Choose)
        {
            throw new SrdProviderException($"The SRD provider returned an invalid proficiency choice at '{id}'.");
        }

        return new CatalogProficiencyChoice(id, choice.Desc, choice.Choose, options);
    }

    private static IReadOnlyList<CatalogEquipmentChoice> EquipmentChoices(
        string source,
        IReadOnlyList<SrdChoice>? choices) => choices?
        .Select((choice, index) => EquipmentChoice($"{source}/equipment/{index}", choice))
        .ToArray() ?? [];

    private static CatalogEquipmentChoice EquipmentChoice(string id, SrdChoice choice)
    {
        if (!string.Equals(choice.Type, "equipment", StringComparison.Ordinal) || choice.Choose < 1)
        {
            throw InvalidEquipmentChoice(id);
        }

        if (string.Equals(choice.From.OptionSetType, "equipment_category", StringComparison.Ordinal))
        {
            var category = choice.From.EquipmentCategory;
            if (choice.Choose != 1 || choice.From.Options is { Count: > 0 } || !ValidReference(category))
            {
                throw InvalidEquipmentChoice(id);
            }

            return new CatalogEquipmentChoice(
                id,
                choice.Desc,
                choice.Choose,
                [],
                Reference(category!));
        }

        if (!string.Equals(choice.From.OptionSetType, "options_array", StringComparison.Ordinal) ||
            choice.From.Options is not { Count: > 0 } options ||
            options.Count < choice.Choose)
        {
            throw InvalidEquipmentChoice(id);
        }

        return new CatalogEquipmentChoice(
            id,
            choice.Desc,
            choice.Choose,
            options.Select((option, index) => EquipmentOption($"{id}/options/{index}", option)).ToArray());
    }

    private static CatalogEquipmentOption EquipmentOption(string id, SrdOption option) => option.OptionType switch
    {
        "multiple" when option.Items is { Count: > 0 } => new CatalogEquipmentOption(
            "bundle",
            1,
            Items: option.Items.Select((item, index) => EquipmentOption($"{id}/items/{index}", item)).ToArray()),
        "counted_reference" when option.Count is > 0 && ValidReference(option.Of) => new CatalogEquipmentOption(
            EquipmentReferenceKind(id, option.Of!),
            option.Count.Value,
            Reference(option.Of!)),
        "money" when option.Count is >= 0 && !string.IsNullOrWhiteSpace(option.Unit) => new CatalogEquipmentOption(
            "currency",
            option.Count.Value,
            CurrencyUnit: option.Unit.Trim().ToLowerInvariant()),
        "choice" when option.Choice is not null => new CatalogEquipmentOption(
            "choice",
            1,
            Choice: EquipmentChoice($"{id}/choice", option.Choice)),
        _ => throw InvalidEquipmentChoice(id)
    };

    private static string EquipmentReferenceKind(string id, SrdReference reference)
    {
        if (reference.Url?.StartsWith("/api/2024/equipment/", StringComparison.Ordinal) == true)
        {
            return "item";
        }

        if (reference.Url?.StartsWith("/api/2024/equipment-categories/", StringComparison.Ordinal) == true)
        {
            return "equipmentCategory";
        }

        throw InvalidEquipmentChoice(id);
    }

    private static SrdProviderException InvalidEquipmentChoice(string id) => new(
        $"The SRD provider returned an invalid equipment choice at '{id}'.");

    private static IEnumerable<CatalogProficiencyReference> FlattenProficiencyOptions(SrdChoice choice)
    {
        foreach (var option in choice.From.Options ?? [])
        {
            if (option.Item is not null)
            {
                yield return ProficiencyReference(option.Item);
            }

            if (option.Choice is not null)
            {
                foreach (var nested in FlattenProficiencyOptions(option.Choice))
                {
                    yield return nested;
                }
            }
        }
    }

    private static CatalogProficiencyReference ProficiencyReference(SrdReference reference)
    {
        var id = reference.Url?.Split('/', StringSplitOptions.RemoveEmptyEntries).LastOrDefault()
            ?? reference.Index;
        var isSkill = reference.Url?.Contains("/skills/", StringComparison.Ordinal) == true
            || id.StartsWith("skill-", StringComparison.Ordinal);

        return new CatalogProficiencyReference(
            isSkill && !id.StartsWith("skill-", StringComparison.Ordinal) ? $"skill-{id}" : id,
            isSkill && !reference.Name.StartsWith("Skill:", StringComparison.Ordinal)
                ? $"Skill: {reference.Name}"
                : reference.Name,
            isSkill);
    }

    private static CatalogFeatFacts FeatFacts(SrdFeatDetail item)
    {
        if (string.IsNullOrWhiteSpace(item.Type))
        {
            throw new SrdProviderException($"The SRD provider returned a feat without a type for '{item.Index}'.");
        }

        var minimumLevel = item.Prerequisites?.MinimumLevel;
        if (minimumLevel is < CharacterRules.MinimumLevel or > CharacterRules.MaximumLevel)
        {
            throw new SrdProviderException($"The SRD provider returned an invalid minimum level for feat '{item.Index}'.");
        }

        var requiredFeature = item.Prerequisites?.FeatureNamed;
        if (requiredFeature is not null && string.IsNullOrWhiteSpace(requiredFeature))
        {
            throw new SrdProviderException($"The SRD provider returned an invalid required feature for feat '{item.Index}'.");
        }

        return new CatalogFeatFacts(
            item.Type.Trim().ToLowerInvariant(),
            minimumLevel,
            requiredFeature?.Trim(),
            !string.IsNullOrWhiteSpace(item.Repeatable),
            AbilityScorePrerequisite(item.Index, item.PrerequisiteOptions));
    }

    private static CatalogAbilityScorePrerequisiteChoice? AbilityScorePrerequisite(
        string featId,
        SrdChoice? choice)
    {
        if (choice is null)
        {
            return null;
        }

        if (!string.Equals(choice.Type, "ability-scores", StringComparison.Ordinal)
            || choice.Choose < 1
            || choice.From is null
            || !string.Equals(choice.From.OptionSetType, "options_array", StringComparison.Ordinal)
            || choice.From.Options is not { Count: > 0 })
        {
            throw new SrdProviderException($"The SRD provider returned an invalid ability prerequisite for feat '{featId}'.");
        }

        var options = choice.From.Options.Select(option =>
        {
            if (!string.Equals(option.OptionType, "score_prerequisite", StringComparison.Ordinal)
                || option.AbilityScore is null
                || string.IsNullOrWhiteSpace(option.AbilityScore.Index)
                || string.IsNullOrWhiteSpace(option.AbilityScore.Name)
                || option.MinimumScore is not int minimumScore
                || minimumScore is < CharacterRules.MinimumAbilityScore or > CharacterRules.MaximumAbilityScore)
            {
                throw new SrdProviderException($"The SRD provider returned an invalid ability prerequisite for feat '{featId}'.");
            }

            return new CatalogAbilityScorePrerequisite(
                new CatalogReference(option.AbilityScore.Index, option.AbilityScore.Name),
                minimumScore);
        }).ToArray();

        if (options.Length < choice.Choose
            || options.Select(option => option.Ability.Id).Distinct(StringComparer.OrdinalIgnoreCase).Count() != options.Length)
        {
            throw new SrdProviderException($"The SRD provider returned an invalid ability prerequisite for feat '{featId}'.");
        }

        return new CatalogAbilityScorePrerequisiteChoice(choice.Choose, options);
    }

    private static CatalogEquipmentFacts EquipmentFacts(SrdEquipmentDetail item)
    {
        if (item.EquipmentCategories is not { Count: > 0 } ||
            item.EquipmentCategories.Any(category => !ValidReference(category)) ||
            item.EquipmentCategories.Select(category => category.Index)
                .Distinct(StringComparer.OrdinalIgnoreCase).Count() != item.EquipmentCategories.Count ||
            item.Cost is { Quantity: < 0 } ||
            item.Cost is not null && string.IsNullOrWhiteSpace(item.Cost.Unit) ||
            item.Weight is < 0)
        {
            throw new SrdProviderException($"The SRD provider returned invalid equipment facts for '{item.Index}'.");
        }

        var categories = References(item.EquipmentCategories);
        var categoryIds = categories.Select(category => category.Id).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var isWeapon = categoryIds.Contains("weapons");
        var isArmor = categoryIds.Contains("armor");
        if (isWeapon == isArmor ||
            !isWeapon && (item.Damage is not null || item.TwoHandedDamage is not null || item.Mastery is not null) ||
            !isArmor && item.ArmorClass is not null)
        {
            if (isWeapon || isArmor || item.Damage is not null || item.TwoHandedDamage is not null ||
                item.Mastery is not null || item.ArmorClass is not null)
            {
                throw new SrdProviderException($"The SRD provider returned conflicting equipment facts for '{item.Index}'.");
            }
        }

        return new CatalogEquipmentFacts(
            categories,
            item.Cost is null ? null : new CatalogMoney(item.Cost.Quantity, item.Cost.Unit.Trim().ToLowerInvariant()),
            item.Weight,
            isWeapon ? WeaponFacts(item) : null,
            isArmor ? ArmorFacts(item) : null);
    }

    private static CatalogWeaponFacts WeaponFacts(SrdEquipmentDetail item)
    {
        if (!ValidDamage(item.Damage) || !ValidReference(item.Mastery) ||
            item.TwoHandedDamage is not null && !ValidDamage(item.TwoHandedDamage) ||
            item.Range is not null && item.Range.Normal is not > 0 ||
            item.Range is { Long: not null } && item.Range.Long <= item.Range.Normal ||
            item.Properties?.Any(property => !ValidReference(property)) == true)
        {
            throw new SrdProviderException($"The SRD provider returned invalid weapon facts for '{item.Index}'.");
        }

        return new CatalogWeaponFacts(
            Damage(item.Damage!),
            item.TwoHandedDamage is null ? null : Damage(item.TwoHandedDamage),
            item.Range is null ? null : new CatalogRange(item.Range.Normal!.Value, item.Range.Long),
            References(item.Properties),
            Reference(item.Mastery!));
    }

    private static CatalogArmorFacts ArmorFacts(SrdEquipmentDetail item)
    {
        if (item.ArmorClass is null || item.ArmorClass.Base < 1 ||
            item.ArmorClass.MaxBonus is < 0 ||
            !item.ArmorClass.DexBonus && item.ArmorClass.MaxBonus is > 0 ||
            item.StrengthMinimum is null or < 0 or > CharacterRules.MaximumAbilityScore ||
            item.StealthDisadvantage is null)
        {
            throw new SrdProviderException($"The SRD provider returned invalid armor facts for '{item.Index}'.");
        }

        return new CatalogArmorFacts(
            item.ArmorClass.Base,
            item.ArmorClass.DexBonus,
            item.ArmorClass.DexBonus ? item.ArmorClass.MaxBonus : null,
            item.StrengthMinimum.Value,
            item.StealthDisadvantage.Value);
    }

    private static bool ValidDamage(SrdDamage? damage) => damage is not null &&
        !string.IsNullOrWhiteSpace(damage.DamageDice) && ValidReference(damage.DamageType);

    private static CatalogDamage Damage(SrdDamage damage) => new(
        damage.DamageDice!,
        Reference(damage.DamageType!));

    private static bool ValidReference(SrdReference? reference) => reference is not null &&
        !string.IsNullOrWhiteSpace(reference.Index) &&
        !string.IsNullOrWhiteSpace(reference.Name);

    private static CatalogReference Reference(SrdReference reference) => new(
        reference.Index,
        reference.Name,
        reference.Note);

    private static string JoinNames(IReadOnlyList<SrdReference>? references) =>
        references is null ? string.Empty : string.Join(", ", references.Select(reference => reference.Name));

    private static string FormatDamage(SrdDamage? damage) => damage is null
        ? string.Empty
        : string.Join(" ", new[] { damage.DamageDice, damage.DamageType?.Name }
            .Where(part => !string.IsNullOrWhiteSpace(part)));

    private static string FormatRange(SrdRange? range) => range switch
    {
        null => string.Empty,
        { Normal: not null, Long: not null } => $"{range.Normal}/{range.Long} ft.",
        { Normal: not null } => $"{range.Normal} ft.",
        _ => string.Empty
    };

    private static string FormatArmorClass(SrdArmorClass? armorClass)
    {
        if (armorClass is null)
        {
            return string.Empty;
        }

        var dexterity = armorClass.DexBonus switch
        {
            false => string.Empty,
            true when armorClass.MaxBonus is > 0 => $" + Dex (max {armorClass.MaxBonus})",
            true => " + Dex"
        };

        return $"{armorClass.Base}{dexterity}";
    }

    private static string YesNo(bool value) => value ? "Yes" : "No";

    private static string TitleCase(string? value) => string.IsNullOrWhiteSpace(value)
        ? string.Empty
        : CultureInfo.InvariantCulture.TextInfo.ToTitleCase(value.Replace('-', ' '));
}
