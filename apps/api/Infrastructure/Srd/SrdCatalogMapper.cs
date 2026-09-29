using System.Globalization;
using CharacterForge.Api.Features.Catalog;

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
            ProficiencyChoices($"classes/{item.Index}", item.ProficiencyChoices)));

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
            ProficiencyChoices($"backgrounds/{item.Index}", item.ProficiencyChoices)));

    public static CatalogItemDetail Map(SrdFeatDetail item) => new(
        item.Index,
        item.Name,
        CatalogCategory.Feats.ToSlug(),
        Text(item.Description),
        Compact([new("Type", TitleCase(item.Type))]),
        []);

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
            CompactSections([Section("Properties", item.Properties)]));
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

    private static IReadOnlyList<CatalogReference> ProficiencyReferences(
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

    private static IEnumerable<CatalogReference> FlattenProficiencyOptions(SrdChoice choice)
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

    private static CatalogReference ProficiencyReference(SrdReference reference)
    {
        var id = reference.Url?.Split('/', StringSplitOptions.RemoveEmptyEntries).LastOrDefault()
            ?? reference.Index;
        var isSkill = reference.Url?.Contains("/skills/", StringComparison.Ordinal) == true;

        return new CatalogReference(
            isSkill && !id.StartsWith("skill-", StringComparison.Ordinal) ? $"skill-{id}" : id,
            isSkill && !reference.Name.StartsWith("Skill:", StringComparison.Ordinal)
                ? $"Skill: {reference.Name}"
                : reference.Name,
            reference.Note);
    }

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
