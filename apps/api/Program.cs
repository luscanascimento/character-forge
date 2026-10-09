using CharacterForge.Api.Features.Catalog;
using CharacterForge.Api.Features.Characters;
using CharacterForge.Api.Features.FeatureRules;
using CharacterForge.Api.Features.Meta;
using CharacterForge.Api.Features.Progression;
using CharacterForge.Api.Infrastructure;
using CharacterForge.Api.Infrastructure.Srd;
using Microsoft.Extensions.Options;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.ConfigureKestrel(options => options.AddServerHeader = false);

builder.Services.AddProblemDetails(options =>
{
    options.CustomizeProblemDetails = context =>
    {
        context.ProblemDetails.Extensions["traceId"] = context.HttpContext.TraceIdentifier;
    };
});
builder.Services.AddExceptionHandler<SrdProviderExceptionHandler>();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddOpenApi();
builder.Services.AddHealthChecks();
builder.Services.AddMemoryCache();
builder.Services.AddRateLimiter(rateLimiter =>
{
    rateLimiter.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    rateLimiter.AddPolicy("catalog", httpContext => RateLimitPartition.GetFixedWindowLimiter(
        httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 120,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
            AutoReplenishment = true
        }));
});

builder.Services
    .AddOptions<SrdApiOptions>()
    .Bind(builder.Configuration.GetSection(SrdApiOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();

builder.Services.AddHttpClient<ISrdContentSource, SrdApiClient>((services, client) =>
{
    var options = services.GetRequiredService<IOptions<SrdApiOptions>>().Value;
    client.BaseAddress = new Uri(options.BaseUrl, UriKind.Absolute);
    client.Timeout = TimeSpan.FromSeconds(options.TimeoutSeconds);
    client.DefaultRequestHeaders.UserAgent.ParseAdd("CharacterForge/1.0");
});
builder.Services.AddScoped<CatalogService>();
builder.Services.AddScoped<CharacterEvaluationService>();
builder.Services.AddScoped<SpellReplacementEvaluationService>();
builder.Services.AddScoped<ClassProgressionService>();
builder.Services.AddScoped<FeatureRuleService>();

var allowedOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>() ?? [];

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        if (allowedOrigins.Length > 0)
        {
            policy.WithOrigins(allowedOrigins)
                .WithMethods("GET", "POST")
                .AllowAnyHeader();
        }
    });
});

var app = builder.Build();

app.UseExceptionHandler();
app.UseSecurityHeaders();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}
else
{
    app.UseHsts();
    app.UseHttpsRedirection();
}

app.UseCors();
app.UseRateLimiter();

app.MapHealthChecks("/health");
app.MapMetaEndpoints();
app.MapCatalogEndpoints();
app.MapCharacterEndpoints();
app.MapClassProgressionEndpoints();
app.MapFeatureRuleEndpoints();

app.Run();

public partial class Program;
