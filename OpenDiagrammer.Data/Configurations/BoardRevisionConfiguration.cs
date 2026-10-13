using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenDiagrammer.Data.Entities;

namespace OpenDiagrammer.Data.Configurations;

public sealed class BoardRevisionConfiguration : IEntityTypeConfiguration<BoardRevision>
{
    public void Configure(EntityTypeBuilder<BoardRevision> builder)
    {
        builder.HasKey(r => r.Id);

        builder.Property(r => r.Title).IsRequired().HasMaxLength(200);

        builder.Property(r => r.Description).HasMaxLength(2000);

        builder
            .HasOne(r => r.Board)
            .WithMany(b => b.Revisions)
            .HasForeignKey(r => r.BoardId)
            .OnDelete(DeleteBehavior.Cascade);

        builder
            .HasOne(r => r.CreatedBy)
            .WithMany()
            .HasForeignKey(r => r.CreatedById)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(r => new { r.BoardId, r.CreatedAt });
    }
}
