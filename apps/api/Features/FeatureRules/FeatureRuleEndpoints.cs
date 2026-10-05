using CharacterForge.Api.Features.Catalog;

namespace CharacterForge.Api.Features.FeatureRules;

public static class FeatureRuleEndpoints
{
    public static IEndpointRouteBuilder MapFeatureRuleEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/classes/{classId}/feature-choices", GetAsync)
            .WithName("GetClassFeatureChoices")
            .WithTags("Feature rules")
            .RequireRateLimiting("catalog")
            .Produces<FeatureChoiceDocument>()
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);

        return endpoints;
    }

    private static async Task<IResult> GetAsync(
        string classId,
        FeatureRuleService service,
        CancellationToken cancellationToken)
    {
        var errors = CatalogService.Validate(CatalogCategory.Classes, new CatalogRequest(), classId);
        if (errors.Count > 0)
        {
            return Results.ValidationProblem(errors);
        }

        var document = await service.GetAsync(classId, cancellationToken);
        return document is null
            ? Results.Problem(
                statusCode: StatusCodes.Status404NotFound,
                title: "The archive contains no such class feature rules.",
                detail: $"No class feature rules were found for '{classId}'.")
            : Results.Ok(document);
    }
}
