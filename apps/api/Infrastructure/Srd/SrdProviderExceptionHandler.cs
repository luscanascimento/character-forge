using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace CharacterForge.Api.Infrastructure.Srd;

public sealed class SrdProviderExceptionHandler(
    IProblemDetailsService problemDetailsService,
    ILogger<SrdProviderExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        if (exception is not SrdProviderException)
        {
            return false;
        }

        logger.LogWarning(exception, "The SRD content provider is unavailable. TraceId: {TraceId}",
            httpContext.TraceIdentifier);

        httpContext.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
        httpContext.Response.Headers.RetryAfter = "30";

        return await problemDetailsService.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            Exception = exception,
            ProblemDetails = new ProblemDetails
            {
                Status = StatusCodes.Status503ServiceUnavailable,
                Title = "The archive is temporarily unreachable.",
                Detail = "The SRD rules source did not respond correctly. Please try again shortly.",
                Type = "https://character-forge.dev/problems/content-provider-unavailable"
            }
        });
    }
}
