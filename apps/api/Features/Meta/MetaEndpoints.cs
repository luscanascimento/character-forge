namespace CharacterForge.Api.Features.Meta;

public static class MetaEndpoints
{
    private const string Ruleset = "2024";
    private const string RulesVersion = "SRD-5.2.1";

    public static IEndpointRouteBuilder MapMetaEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/meta", () => TypedResults.Ok(new AppMetadata(
                Name: "Character Forge",
                Ruleset,
                RulesVersion,
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
