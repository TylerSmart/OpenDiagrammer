using OpenDiagrammer.Data.Auditing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace OpenDiagrammer.Data;

public static class DataServiceCollectionExtensions
{
    public static IServiceCollection AddDataServices(
        this IServiceCollection services,
        IConfiguration configuration
    )
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        var openDiagrammerConnectionString =
            configuration["ConnectionString:OpenDiagrammer"]
            ?? throw new InvalidOperationException("ConnectionString:OpenDiagrammer is not configured.");

        services.AddScoped<AuditSaveChangesInterceptor>();
        services.AddDbContext<OpenDiagrammerDbContext>(
            (provider, options) =>
            {
                options.UseSqlServer(openDiagrammerConnectionString, sql => sql.EnableRetryOnFailure());
                options.AddInterceptors(provider.GetRequiredService<AuditSaveChangesInterceptor>());
            }
        );

        return services;
    }
}
