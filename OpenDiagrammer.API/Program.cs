using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi;
using OpenDiagrammer.API.Authentication;
using OpenDiagrammer.API.Hosting;
using OpenDiagrammer.API.Http;
using OpenDiagrammer.Core;
using OpenDiagrammer.Data;
using OpenDiagrammer.Infrastructure;
using Scalar.AspNetCore;
using Serilog;
using Serilog.Events;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog(
    (context, services, configuration) =>
        configuration
            .ReadFrom.Configuration(context.Configuration)
            .ReadFrom.Services(services)
            .Enrich.FromLogContext()
);

builder.Services.AddProblemDetails();

builder.Services.AddControllers();

builder.Services.AddOpenApi(
    "v1",
    options =>
    {
        options.AddDocumentTransformer(
            (document, context, cancellationToken) =>
            {
                document.Info.Title = "OpenDiagrammer";
                document.Info.Version = "v1";
                document.Servers = [new OpenApiServer { Url = "/api" }];

                document.Components ??= new OpenApiComponents();

                return Task.CompletedTask;
            }
        );
    }
);

builder.Services.AddCoreServices();

builder.Services.AddInfrastructureServices(builder.Configuration);

builder.Services.AddDataServices(builder.Configuration);

builder.Services.AddOpenDiagrammerAuthentication(builder.Configuration);

// Every other Angular asset is content-hashed and safe to cache forever, but index.html keeps its
// name across deploys. Without this it can be served from cache and reference a previous deploy's
// bundle. Applies to UseStaticFiles and MapFallbackToFile, which both read these options.
builder.Services.Configure<StaticFileOptions>(options =>
{
    options.OnPrepareResponse = context =>
    {
        if (string.Equals(context.File.Name, "index.html", StringComparison.OrdinalIgnoreCase))
        {
            context.Context.Response.Headers.CacheControl = "no-cache, must-revalidate";
        }
    };
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<OpenDiagrammerDbContext>();
    if (db.Database.IsRelational())
    {
        db.Database.Migrate();
    }
}

app.UseSerilogRequestLogging(options =>
{
    options.MessageTemplate =
        "HTTP {RequestMethod} {RequestPath} responded {StatusCode} in {Elapsed:0.0000} ms";
    options.GetLevel = (httpContext, _, exception) =>
        exception is not null
        || httpContext.Response.StatusCode >= StatusCodes.Status500InternalServerError
            ? LogEventLevel.Error
        : httpContext.Response.StatusCode >= StatusCodes.Status400BadRequest ? LogEventLevel.Warning
        : LogEventLevel.Information;
    options.EnrichDiagnosticContext = (diagnosticContext, httpContext) =>
    {
        diagnosticContext.Set("TraceIdentifier", httpContext.TraceIdentifier);
        diagnosticContext.Set("RequestHost", httpContext.Request.Host.Value);
        diagnosticContext.Set("RequestScheme", httpContext.Request.Scheme);
    };
});

app.UseExceptionHandler();

app.UseMiddleware<ApiVersionHeaderMiddleware>();

var hasHttpsUrl =
    builder
        .Configuration["ASPNETCORE_URLS"]
        ?.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
        .Any(url => url.StartsWith("https://", StringComparison.OrdinalIgnoreCase)) == true;

if (hasHttpsUrl)
{
    app.UseHttpsRedirection();
}

var serveSpa = SpaHosting.HasIndexHtml(app.Environment.WebRootPath);
if (serveSpa)
{
    app.UseDefaultFiles();

    app.UseStaticFiles();
}

app.MapOpenApi("/api/openapi/{documentName}.json").AllowAnonymous();

app.MapScalarApiReference(
        "/api/scalar",
        options =>
        {
            options.WithOpenApiRoutePattern("/api/openapi/{documentName}.json");
            options.WithTitle("OpenDiagrammer");
        }
    )
    .AllowAnonymous();

app.UseAuthentication();
app.UseAuthorization();

app.MapGroup("/api").MapControllers();

if (serveSpa)
{
    app.MapFallbackToFile("index.html");
}

app.Run();

public partial class Program;
