using Microsoft.EntityFrameworkCore;

namespace OpenDiagrammer.Data;

public sealed class OpenDiagrammerDbContext(DbContextOptions<OpenDiagrammerDbContext> options)
    : DbContext(options)
{
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(OpenDiagrammerDbContext).Assembly);
    }
}
