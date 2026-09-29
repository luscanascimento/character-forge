namespace CharacterForge.Api.Features.Catalog;

public enum CatalogCategory
{
    Classes,
    Species,
    Backgrounds,
    Feats,
    Spells,
    Equipment
}

public static class CatalogCategoryExtensions
{
    public static bool TryParse(string value, out CatalogCategory category) =>
        Enum.TryParse(value, ignoreCase: true, out category) &&
        Enum.IsDefined(category);

    public static string ToSlug(this CatalogCategory category) => category switch
    {
        CatalogCategory.Classes => "classes",
        CatalogCategory.Species => "species",
        CatalogCategory.Backgrounds => "backgrounds",
        CatalogCategory.Feats => "feats",
        CatalogCategory.Spells => "spells",
        CatalogCategory.Equipment => "equipment",
        _ => throw new ArgumentOutOfRangeException(nameof(category), category, null)
    };
}
