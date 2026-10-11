using OpenDiagrammer.Core.Services;

namespace OpenDiagrammer.Core.Boards;

public interface IBoardMemberService
{
    Task<ServiceResult<IReadOnlyList<BoardMemberDto>>> GetMembersAsync(
        Guid currentUserId,
        Guid boardId,
        CancellationToken cancellationToken = default
    );

    Task<ServiceResult<BoardMemberDto>> AddMemberAsync(
        Guid currentUserId,
        Guid boardId,
        AddBoardMemberRequest request,
        CancellationToken cancellationToken = default
    );

    Task<ServiceResult<BoardMemberDto>> UpdateMemberRoleAsync(
        Guid currentUserId,
        Guid boardId,
        Guid targetUserId,
        UpdateBoardMemberRoleRequest request,
        CancellationToken cancellationToken = default
    );

    Task<ServiceResult> RemoveMemberAsync(
        Guid currentUserId,
        Guid boardId,
        Guid targetUserId,
        CancellationToken cancellationToken = default
    );
}
