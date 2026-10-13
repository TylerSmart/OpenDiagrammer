using OpenDiagrammer.Core.Boards;

namespace OpenDiagrammer.Data.Entities;

public sealed class BoardRevision
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid BoardId { get; set; }

    public Board Board { get; set; } = null!;

    public Guid CreatedById { get; set; }

    public User CreatedBy { get; set; } = null!;

    public string Title { get; set; } = string.Empty;

    public string? Description { get; set; }

    public string? CanvasDataJson { get; set; }

    public byte[]? CrdtState { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
