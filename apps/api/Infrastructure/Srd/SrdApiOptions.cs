using System.ComponentModel.DataAnnotations;

namespace CharacterForge.Api.Infrastructure.Srd;

public sealed class SrdApiOptions
{
    public const string SectionName = "SrdApi";

    [Required, Url]
    public string BaseUrl { get; init; } = "https://www.dnd5eapi.co/api/2024/";

    [Range(1, 30)]
    public int TimeoutSeconds { get; init; } = 8;

    [Range(1, 1440)]
    public int CacheDurationMinutes { get; init; } = 360;
}
