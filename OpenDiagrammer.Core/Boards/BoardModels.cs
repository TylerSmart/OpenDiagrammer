using System.ComponentModel.DataAnnotations;

namespace OpenDiagrammer.Core.Boards;

public sealed record BoardMemberDto(
    Guid Id,
    Guid BoardId,
    Guid UserId,
    string Username,
    string Email,
    BoardRole Role,
    DateTimeOffset CreatedAt
);

public sealed record BoardSummaryDto(
    Guid Id,
    string Name,
    string? Description,
    Guid OwnerId,
    string OwnerUsername,
    BoardRole UserRole,
    BoardBackgroundType BackgroundType,
    string? BackgroundColor,
    double BackgroundOpacity,
    BoardMode Mode,
    int MemberCount,
    DateTimeOffset CreatedAt,
    DateTimeOffset ModifiedAt
);

public sealed record BoardDetailDto(
    Guid Id,
    string Name,
    string? Description,
    Guid OwnerId,
    string OwnerUsername,
    BoardRole UserRole,
    BoardBackgroundType BackgroundType,
    string? BackgroundColor,
    double BackgroundOpacity,
    BoardMode Mode,
    string? ThinkModeConfigJson,
    DateTimeOffset CreatedAt,
    DateTimeOffset ModifiedAt,
    IReadOnlyList<BoardMemberDto> Members
);

public sealed record CreateBoardRequest(
    [Required, MinLength(1), MaxLength(200)] string Name,
    [MaxLength(2000)] string? Description,
    BoardBackgroundType? BackgroundType,
    [MaxLength(50)] string? BackgroundColor,
    [Range(0.0, 1.0)] double? BackgroundOpacity
);

public sealed record UpdateBoardRequest(
    [Required, MinLength(1), MaxLength(200)] string Name,
    [MaxLength(2000)] string? Description,
    BoardBackgroundType BackgroundType,
    [MaxLength(50)] string? BackgroundColor,
    [Range(0.0, 1.0)] double BackgroundOpacity,
    BoardMode Mode,
    [MaxLength(4000)] string? ThinkModeConfigJson
);

public sealed record TransferOwnershipRequest([Required] Guid NewOwnerId);

public sealed record AddBoardMemberRequest(
    [Required, MinLength(1), MaxLength(256)] string EmailOrUsername,
    [Required] BoardRole Role
);

public sealed record UpdateBoardMemberRoleRequest([Required] BoardRole Role);
