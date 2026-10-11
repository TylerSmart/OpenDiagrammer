using OpenDiagrammer.Core.Boards;

namespace OpenDiagrammer.Data.Entities;

public sealed class BoardMember : IAuditable
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid BoardId { get; set; }

    public Board Board { get; set; } = null!;

    public Guid UserId { get; set; }

    public User User { get; set; } = null!;

    public BoardRole Role { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public string CreatedBy { get; set; } = "System";

    public DateTimeOffset ModifiedAt { get; set; }

    public string ModifiedBy { get; set; } = "System";
}
