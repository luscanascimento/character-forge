using CharacterForge.Api.Features.Characters;

namespace CharacterForge.Api.Features.Meta;

public static class MetaEndpoints
{
    public static IEndpointRouteBuilder MapMetaEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/meta", () => TypedResults.Ok(new AppMetadata(
                Name: "Character Forge",
                CharacterRules.Ruleset,
                CharacterRules.RulesVersion,
                Status: "ready")))
            .WithName("GetAppMetadata")
            .WithSummary("Returns the application and active ruleset metadata.")
            .Produces<AppMetadata>();

        return endpoints;
    }
}

public sealed record AppMetadata(
    string Name,
    string Ruleset,
    string RulesVersion,
    string Status);
