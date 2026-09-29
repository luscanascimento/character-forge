namespace CharacterForge.Api.Infrastructure;

public static class SecurityHeadersExtensions
{
    public static IApplicationBuilder UseSecurityHeaders(this IApplicationBuilder app)
    {
        return app.Use(async (context, next) =>
        {
            context.Response.OnStarting(() =>
            {
                var headers = context.Response.Headers;
                headers.XContentTypeOptions = "nosniff";
                headers.XFrameOptions = "DENY";
                headers.Append("Referrer-Policy", "no-referrer");
                headers.Append("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
                headers.Append("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
                return Task.CompletedTask;
            });

            await next();
        });
    }
}
