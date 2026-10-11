namespace OpenDiagrammer.Core.Boards;

public interface IBoardMemberService
{
    Task<IReadOnlyList<BoardMemberDto>?> GetMembersAsync(
        Guid currentUserId,
        Guid boardId,
        CancellationToken cancellationToken = default
    );

    Task<BoardMemberDto?> AddMemberAsync(
        Guid currentUserId,
        Guid boardId,
        AddBoardMemberRequest request,
        CancellationToken cancellationToken = default
    );

    Task<BoardMemberDto?> UpdateMemberRoleAsync(
        Guid currentUserId,
        Guid boardId,
        Guid targetUserId,
        UpdateBoardMemberRoleRequest request,
        CancellationToken cancellationToken = default
    );

    Task<bool> RemoveMemberAsync(
        Guid currentUserId,
        Guid boardId,
        Guid targetUserId,
        CancellationToken cancellationToken = default
    );
}
