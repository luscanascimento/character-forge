namespace CharacterForge.Api.Features.Catalog;

public static class CatalogEndpoints
{
    public static IEndpointRouteBuilder MapCatalogEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/catalog")
            .WithTags("Catalog")
            .RequireRateLimiting("catalog");

        group.MapGet("/{category}", GetPageAsync)
            .WithName("GetCatalogPage")
            .Produces<CatalogPage>()
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);

        group.MapGet("/{category}/{id}", GetItemAsync)
            .WithName("GetCatalogItem")
            .Produces<CatalogItemDetail>()
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);

        return endpoints;
    }

    private static async Task<IResult> GetPageAsync(
        string category,
        [AsParameters] CatalogRequest request,
        CatalogService service,
        CancellationToken cancellationToken)
    {
        if (!CatalogCategoryExtensions.TryParse(category, out var parsedCategory))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                [nameof(category)] = ["Unknown catalog category."]
            });
        }

        var errors = CatalogService.Validate(parsedCategory, request);
        if (errors.Count > 0)
        {
            return Results.ValidationProblem(errors);
        }

        var query = new CatalogQuery(
            request.Search?.Trim(),
            request.Page ?? 1,
            request.PageSize ?? 24,
            request.Sort ?? "name",
            request.Level,
            request.School,
            request.CharacterClass);

        return Results.Ok(await service.GetPageAsync(parsedCategory, query, cancellationToken));
    }

    private static async Task<IResult> GetItemAsync(
        string category,
        string id,
        CatalogService service,
        CancellationToken cancellationToken)
    {
        if (!CatalogCategoryExtensions.TryParse(category, out var parsedCategory))
        {
            return Results.NotFound();
        }

        var errors = CatalogService.Validate(parsedCategory, new CatalogRequest(), id);
        if (errors.Count > 0)
        {
            return Results.ValidationProblem(errors);
        }

        var item = await service.GetItemAsync(parsedCategory, id, cancellationToken);
        return item is null
            ? Results.Problem(
                statusCode: StatusCodes.Status404NotFound,
                title: "The archive contains no such entry.",
                detail: $"No {category} entry was found for '{id}'.")
            : Results.Ok(item);
    }
}
