using System.Text.Json;
using System.Text.Json.Serialization;

namespace CharacterForge.Api.Infrastructure.Srd;

internal sealed record SrdListResponse(int Count, IReadOnlyList<SrdListItem> Results);

internal sealed record SrdListItem(string Index, string Name, int? Level);

internal sealed record SrdReference(
    string Index,
    string Name,
    string? Note = null,
    string? Url = null);

internal sealed record SrdChoice(
    string Desc,
    int Choose,
    string Type,
    SrdOptionSet From);

internal sealed record SrdOptionSet(
    [property: JsonPropertyName("option_set_type")] string OptionSetType,
    IReadOnlyList<SrdOption>? Options);

internal sealed record SrdOption(
    [property: JsonPropertyName("option_type")] string OptionType,
    SrdReference? Item,
    SrdChoice? Choice,
    [property: JsonPropertyName("ability_score")] SrdReference? AbilityScore,
    [property: JsonPropertyName("minimum_score")] int? MinimumScore);

internal sealed record SrdPrimaryAbility(
    string Desc,
    [property: JsonPropertyName("ability_scores")] IReadOnlyList<SrdReference>? AbilityScores);

internal sealed record SrdSpellcasting(
    int Level,
    [property: JsonPropertyName("spellcasting_ability")] SrdReference SpellcastingAbility);

internal sealed record SrdClassDetail(
    string Index,
    string Name,
    [property: JsonPropertyName("primary_ability")] SrdPrimaryAbility? PrimaryAbility,
    [property: JsonPropertyName("hit_die")] int HitDie,
    IReadOnlyList<SrdReference>? Proficiencies,
    [property: JsonPropertyName("proficiency_choices")] IReadOnlyList<SrdChoice>? ProficiencyChoices,
    [property: JsonPropertyName("saving_throws")] IReadOnlyList<SrdReference>? SavingThrows,
    IReadOnlyList<SrdReference>? Subclasses,
    SrdSpellcasting? Spellcasting);

internal sealed record SrdClassLevel(
    int Level,
    [property: JsonPropertyName("prof_bonus")] int ProficiencyBonus,
    IReadOnlyList<SrdReference>? Features,
    SrdClassLevelSpellcasting? Spellcasting);

internal sealed record SrdClassLevelSpellcasting(
    [property: JsonPropertyName("cantrips_known")] int? CantripsKnown,
    [property: JsonPropertyName("prepared_spells")] int? PreparedSpells,
    [property: JsonPropertyName("spell_slots_level_1")] int? SpellSlotsLevel1,
    [property: JsonPropertyName("spell_slots_level_2")] int? SpellSlotsLevel2,
    [property: JsonPropertyName("spell_slots_level_3")] int? SpellSlotsLevel3,
    [property: JsonPropertyName("spell_slots_level_4")] int? SpellSlotsLevel4,
    [property: JsonPropertyName("spell_slots_level_5")] int? SpellSlotsLevel5,
    [property: JsonPropertyName("spell_slots_level_6")] int? SpellSlotsLevel6,
    [property: JsonPropertyName("spell_slots_level_7")] int? SpellSlotsLevel7,
    [property: JsonPropertyName("spell_slots_level_8")] int? SpellSlotsLevel8,
    [property: JsonPropertyName("spell_slots_level_9")] int? SpellSlotsLevel9);

internal sealed record SrdSubclassLevel(
    int Level,
    SrdReference Class,
    SrdReference Subclass,
    IReadOnlyList<SrdReference>? Features);

internal sealed record SrdSubclassProgression(
    SrdReference Reference,
    IReadOnlyList<SrdSubclassLevel> Levels);

internal sealed record SrdSpeciesDetail(
    string Index,
    string Name,
    string Type,
    string Size,
    int Speed,
    IReadOnlyList<SrdReference>? Proficiencies,
    IReadOnlyList<SrdReference>? Traits,
    IReadOnlyList<SrdReference>? Subspecies);

internal sealed record SrdBackgroundDetail(
    string Index,
    string Name,
    [property: JsonPropertyName("ability_scores")] IReadOnlyList<SrdReference>? AbilityScores,
    SrdReference? Feat,
    IReadOnlyList<SrdReference>? Proficiencies,
    [property: JsonPropertyName("proficiency_choices")] IReadOnlyList<SrdChoice>? ProficiencyChoices);

internal sealed record SrdTraitDetail(
    string Index,
    string Name,
    [property: JsonPropertyName("proficiency_choices")] SrdChoice? ProficiencyChoice);

internal sealed record SrdFeatDetail(
    string Index,
    string Name,
    string? Description,
    string? Type,
    string? Repeatable,
    SrdFeatPrerequisites? Prerequisites,
    [property: JsonPropertyName("prerequisite_options")] SrdChoice? PrerequisiteOptions);

internal sealed record SrdFeatPrerequisites(
    [property: JsonPropertyName("minimum_level")] int? MinimumLevel,
    [property: JsonPropertyName("feature_named")] string? FeatureNamed);

internal sealed record SrdSpellDetail(
    string Index,
    string Name,
    int Level,
    SrdReference School,
    IReadOnlyList<SrdReference>? Classes,
    IReadOnlyList<SrdReference>? Subclasses,
    [property: JsonPropertyName("casting_time")] string CastingTime,
    bool Ritual,
    string Range,
    IReadOnlyList<string>? Components,
    string? Material,
    string Duration,
    bool Concentration,
    string? Description,
    [property: JsonPropertyName("higher_level")] string? HigherLevel);

internal sealed record SrdMoney(decimal Quantity, string Unit);

internal sealed record SrdDamage(
    [property: JsonPropertyName("damage_dice")] string? DamageDice,
    [property: JsonPropertyName("damage_type")] SrdReference? DamageType);

internal sealed record SrdRange(int? Normal, int? Long);

internal sealed record SrdArmorClass(
    int Base,
    [property: JsonPropertyName("dex_bonus")] bool DexBonus,
    [property: JsonPropertyName("max_bonus")] int? MaxBonus);

internal sealed record SrdEquipmentDetail(
    string Index,
    string Name,
    [property: JsonPropertyName("equipment_categories")] IReadOnlyList<SrdReference>? EquipmentCategories,
    SrdMoney? Cost,
    decimal? Weight,
    [property: JsonConverter(typeof(StringOrArrayJsonConverter))] IReadOnlyList<string>? Description,
    IReadOnlyList<string>? Notes,
    SrdDamage? Damage,
    [property: JsonPropertyName("two_handed_damage")] SrdDamage? TwoHandedDamage,
    SrdRange? Range,
    IReadOnlyList<SrdReference>? Properties,
    SrdReference? Mastery,
    [property: JsonPropertyName("armor_class")] SrdArmorClass? ArmorClass,
    [property: JsonPropertyName("str_minimum")] int? StrengthMinimum,
    [property: JsonPropertyName("stealth_disadvantage")] bool? StealthDisadvantage,
    [property: JsonPropertyName("don_time")] string? DonTime,
    [property: JsonPropertyName("doff_time")] string? DoffTime);

internal sealed class StringOrArrayJsonConverter : JsonConverter<IReadOnlyList<string>>
{
    public override IReadOnlyList<string>? Read(
        ref Utf8JsonReader reader,
        Type typeToConvert,
        JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Null)
        {
            return null;
        }

        if (reader.TokenType == JsonTokenType.String)
        {
            return [reader.GetString() ?? string.Empty];
        }

        if (reader.TokenType != JsonTokenType.StartArray)
        {
            throw new JsonException("Expected a string or an array of strings.");
        }

        var values = new List<string>();
        while (reader.Read() && reader.TokenType != JsonTokenType.EndArray)
        {
            if (reader.TokenType != JsonTokenType.String)
            {
                throw new JsonException("Expected an array of strings.");
            }

            values.Add(reader.GetString() ?? string.Empty);
        }

        return values;
    }

    public override void Write(
        Utf8JsonWriter writer,
        IReadOnlyList<string> value,
        JsonSerializerOptions options) => JsonSerializer.Serialize(writer, value, options);
}
