using Microsoft.EntityFrameworkCore;
using OpenDiagrammer.Data.Entities;

namespace OpenDiagrammer.Data;

public sealed class OpenDiagrammerDbContext(DbContextOptions<OpenDiagrammerDbContext> options)
    : DbContext(options)
{
    public DbSet<User> Users => Set<User>();

    public DbSet<Board> Boards => Set<Board>();

    public DbSet<BoardMember> BoardMembers => Set<BoardMember>();

    public DbSet<BoardRevision> BoardRevisions => Set<BoardRevision>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(OpenDiagrammerDbContext).Assembly);
    }
}
