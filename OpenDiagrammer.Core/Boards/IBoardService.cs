using OpenDiagrammer.Core.Services;

namespace OpenDiagrammer.Core.Boards;

public interface IBoardService
{
    Task<IReadOnlyList<BoardSummaryDto>> GetBoardsAsync(
        Guid userId,
        CancellationToken cancellationToken = default
    );

    Task<ServiceResult<BoardDetailDto>> GetBoardByIdAsync(
        Guid userId,
        Guid boardId,
        CancellationToken cancellationToken = default
    );

    Task<ServiceResult<BoardDetailDto>> CreateBoardAsync(
        Guid userId,
        CreateBoardRequest request,
        CancellationToken cancellationToken = default
    );

    Task<ServiceResult<BoardDetailDto>> UpdateBoardAsync(
        Guid userId,
        Guid boardId,
        UpdateBoardRequest request,
        CancellationToken cancellationToken = default
    );

    Task<ServiceResult> DeleteBoardAsync(
        Guid userId,
        Guid boardId,
        CancellationToken cancellationToken = default
    );

    Task<ServiceResult> TransferOwnershipAsync(
        Guid userId,
        Guid boardId,
        Guid newOwnerId,
        CancellationToken cancellationToken = default
    );
}
