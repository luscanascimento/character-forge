using CharacterForge.Api.Features.Catalog;

namespace CharacterForge.Api.Features.Progression;

public static class ClassProgressionEndpoints
{
    public static IEndpointRouteBuilder MapClassProgressionEndpoints(
        this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/classes/{classId}/progression", GetAsync)
            .WithName("GetClassProgression")
            .WithTags("Class progression")
            .RequireRateLimiting("catalog")
            .Produces<ClassProgressionDocument>()
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);

        return endpoints;
    }

    private static async Task<IResult> GetAsync(
        string classId,
        ClassProgressionService service,
        CancellationToken cancellationToken)
    {
        var errors = CatalogService.Validate(
            CatalogCategory.Classes,
            new CatalogRequest(),
            classId);
        if (errors.Count > 0)
        {
            return Results.ValidationProblem(errors);
        }

        var progression = await service.GetAsync(classId, cancellationToken);
        return progression is null
            ? Results.Problem(
                statusCode: StatusCodes.Status404NotFound,
                title: "The archive contains no such class progression.",
                detail: $"No class progression was found for '{classId}'.")
            : Results.Ok(progression);
    }
}
