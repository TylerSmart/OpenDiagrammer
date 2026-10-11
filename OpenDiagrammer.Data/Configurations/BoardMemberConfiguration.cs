using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenDiagrammer.Data.Entities;

namespace OpenDiagrammer.Data.Configurations;

public sealed class BoardMemberConfiguration : IEntityTypeConfiguration<BoardMember>
{
    public void Configure(EntityTypeBuilder<BoardMember> builder)
    {
        builder.ToTable("BoardMembers");

        builder.HasKey(m => m.Id);

        builder.HasIndex(m => new { m.BoardId, m.UserId }).IsUnique();

        builder.Property(m => m.Role).HasConversion<string>().HasMaxLength(50);

        builder.Property(m => m.CreatedBy).IsRequired().HasMaxLength(256);

        builder.Property(m => m.ModifiedBy).IsRequired().HasMaxLength(256);

        builder
            .HasOne(m => m.Board)
            .WithMany(b => b.Members)
            .HasForeignKey(m => m.BoardId)
            .OnDelete(DeleteBehavior.Cascade);

        builder
            .HasOne(m => m.User)
            .WithMany(u => u.BoardMemberships)
            .HasForeignKey(m => m.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
