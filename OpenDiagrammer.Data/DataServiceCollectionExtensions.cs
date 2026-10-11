using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using OpenDiagrammer.Data.Auditing;

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

        services.AddScoped<AuditSaveChangesInterceptor>();

        if (
            string.Equals(
                configuration["UseInMemoryDatabase"],
                "true",
                StringComparison.OrdinalIgnoreCase
            )
        )
        {
            var inMemoryDbName = configuration["InMemoryDatabaseName"] ?? "OpenDiagrammer_Testing";
            services.AddDbContext<OpenDiagrammerDbContext>(
                (provider, options) =>
                {
                    options.UseInMemoryDatabase(inMemoryDbName);
                    options.AddInterceptors(
                        provider.GetRequiredService<AuditSaveChangesInterceptor>()
                    );
                }
            );

            return services;
        }

        var openDiagrammerConnectionString =
            configuration["ConnectionString:OpenDiagrammer"]
            ?? throw new InvalidOperationException(
                "ConnectionString:OpenDiagrammer is not configured."
            );

        services.AddDbContext<OpenDiagrammerDbContext>(
            (provider, options) =>
            {
                options.UseSqlServer(
                    openDiagrammerConnectionString,
                    sql => sql.EnableRetryOnFailure()
                );
                options.AddInterceptors(provider.GetRequiredService<AuditSaveChangesInterceptor>());
            }
        );

        return services;
    }
}
