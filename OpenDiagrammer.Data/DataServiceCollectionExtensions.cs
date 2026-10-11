using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using OpenDiagrammer.Core.Authentication;
using OpenDiagrammer.Core.Boards;
using OpenDiagrammer.Data.Auditing;
using OpenDiagrammer.Data.Services;

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
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IBoardService, BoardService>();
        services.AddScoped<IBoardMemberService, BoardMemberService>();

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
            configuration.GetConnectionString("OpenDiagrammer")
            ?? configuration.GetConnectionString("DefaultConnection")
            ?? configuration["ConnectionString:OpenDiagrammer"];

        if (
            string.IsNullOrWhiteSpace(openDiagrammerConnectionString)
            || string.Equals(
                openDiagrammerConnectionString,
                "REPLACE_ME",
                StringComparison.OrdinalIgnoreCase
            )
        )
        {
            openDiagrammerConnectionString =
                "Server=localhost,14333;Database=OpenDiagrammer;User Id=sa;Password=OpenDiagrammer_Local_Dev_1;TrustServerCertificate=True;Encrypt=True;Application Name=OpenDiagrammer;";
        }

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
