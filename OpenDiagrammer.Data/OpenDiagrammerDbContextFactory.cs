using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace OpenDiagrammer.Data;

public sealed class OpenDiagrammerDbContextFactory : IDesignTimeDbContextFactory<OpenDiagrammerDbContext>
{
    public OpenDiagrammerDbContext CreateDbContext(string[] args)
    {
        var startupPath = ResolveStartupPath();
        var configuration = new ConfigurationBuilder()
            .SetBasePath(startupPath)
            .AddJsonFile("appsettings.json", optional: false)
            .AddJsonFile("appsettings.Local.json", optional: true)
            .AddEnvironmentVariables()
            .Build();

        var connectionString =
            configuration["ConnectionString:OpenDiagrammer"]
            ?? throw new InvalidOperationException(
                "ConnectionString:OpenDiagrammer is not configured for EF Core design-time."
            );

        var options = new DbContextOptionsBuilder<OpenDiagrammerDbContext>()
            .UseSqlServer(connectionString)
            .Options;

        return new OpenDiagrammerDbContext(options);
    }

    private static string ResolveStartupPath()
    {
        var current = Directory.GetCurrentDirectory();
        if (File.Exists(Path.Combine(current, "appsettings.json")))
            return current;

        var apiPath = Path.GetFullPath(Path.Combine(current, "..", "OpenDiagrammer.API"));
        if (File.Exists(Path.Combine(apiPath, "appsettings.json")))
            return apiPath;

        throw new InvalidOperationException(
            "Could not find OpenDiagrammer.API appsettings.json. Run EF Core commands with --startup-project OpenDiagrammer.API."
        );
    }
}
