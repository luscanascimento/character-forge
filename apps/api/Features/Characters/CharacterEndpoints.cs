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

        endpoints.MapPost("/api/characters/validate-spell-replacement", async (
                SpellReplacementEvaluationRequest request,
                SpellReplacementEvaluationService service,
                CancellationToken cancellationToken) =>
                TypedResults.Ok(await service.EvaluateAsync(request, cancellationToken)))
            .WithName("ValidateSpellReplacement")
            .WithSummary("Validates a canonical character transition against class spell replacement limits.")
            .Produces<SpellReplacementEvaluation>()
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable)
            .RequireRateLimiting("catalog");

        endpoints.MapPost("/api/characters/evaluate-feat", async (
                FeatEligibilityRequest request,
                FeatEligibilityEvaluationService service,
                CancellationToken cancellationToken) =>
                TypedResults.Ok(await service.EvaluateAsync(request, cancellationToken)))
            .WithName("EvaluateFeatEligibility")
            .WithSummary("Evaluates canonical feat prerequisites without persisting unsupported feat effects.")
            .Produces<FeatEligibilityEvaluation>()
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable)
            .RequireRateLimiting("catalog");

        return endpoints;
    }
}
