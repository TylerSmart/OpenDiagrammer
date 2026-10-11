using OpenDiagrammer.Core.Boards;

namespace OpenDiagrammer.Data.Entities;

public sealed class Board : IAuditable
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public Guid OwnerId { get; set; }

    public User Owner { get; set; } = null!;

    public BoardBackgroundType BackgroundType { get; set; } = BoardBackgroundType.GridLines;

    public string? BackgroundColor { get; set; }

    public double BackgroundOpacity { get; set; } = 1.0;

    public BoardMode Mode { get; set; } = BoardMode.Normal;

    public string? ThinkModeConfigJson { get; set; }

    public ICollection<BoardMember> Members { get; set; } = new List<BoardMember>();

    public DateTimeOffset CreatedAt { get; set; }

    public string CreatedBy { get; set; } = "System";

    public DateTimeOffset ModifiedAt { get; set; }

    public string ModifiedBy { get; set; } = "System";
}
