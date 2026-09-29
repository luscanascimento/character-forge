namespace CharacterForge.Api.Features.Characters;

public static class CharacterEndpoints
{
    public static IEndpointRouteBuilder MapCharacterEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/api/characters/validate", async (
                Character character,
                CharacterEvaluationService service,
                CancellationToken cancellationToken) =>
                TypedResults.Ok(await service.EvaluateAsync(character, cancellationToken)))
            .WithName("ValidateCharacter")
            .WithSummary("Validates a draft character and calculates its derived rules values.")
            .Produces<CharacterEvaluation>()
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable)
            .RequireRateLimiting("catalog");

        return endpoints;
    }
}
