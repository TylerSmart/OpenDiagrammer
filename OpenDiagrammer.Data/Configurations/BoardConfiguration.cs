using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenDiagrammer.Data.Entities;

namespace OpenDiagrammer.Data.Configurations;

public sealed class BoardConfiguration : IEntityTypeConfiguration<Board>
{
    public void Configure(EntityTypeBuilder<Board> builder)
    {
        builder.ToTable("Boards");

        builder.HasKey(b => b.Id);

        builder.Property(b => b.Name).IsRequired().HasMaxLength(200);

        builder.Property(b => b.Description).HasMaxLength(2000);

        builder.Property(b => b.BackgroundColor).HasMaxLength(50);

        builder.Property(b => b.BackgroundType).HasConversion<string>().HasMaxLength(50);

        builder.Property(b => b.Mode).HasConversion<string>().HasMaxLength(50);

        builder.Property(b => b.ThinkModeConfigJson).HasMaxLength(4000);

        builder.Property(b => b.CanvasDataJson);

        builder.Property(b => b.CrdtState);

        builder.Property(b => b.CreatedBy).IsRequired().HasMaxLength(256);

        builder.Property(b => b.ModifiedBy).IsRequired().HasMaxLength(256);

        builder
            .HasOne(b => b.Owner)
            .WithMany(u => u.OwnedBoards)
            .HasForeignKey(b => b.OwnerId)
            .OnDelete(DeleteBehavior.Restrict);

        builder
            .HasMany(b => b.Members)
            .WithOne(m => m.Board)
            .HasForeignKey(m => m.BoardId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
