namespace OpenDiagrammer.Core.Boards;

public interface IBoardService
{
    Task<IReadOnlyList<BoardSummaryDto>> GetBoardsAsync(
        Guid userId,
        CancellationToken cancellationToken = default
    );

    Task<BoardDetailDto?> GetBoardByIdAsync(
        Guid userId,
        Guid boardId,
        CancellationToken cancellationToken = default
    );

    Task<BoardDetailDto> CreateBoardAsync(
        Guid userId,
        CreateBoardRequest request,
        CancellationToken cancellationToken = default
    );

    Task<BoardDetailDto?> UpdateBoardAsync(
        Guid userId,
        Guid boardId,
        UpdateBoardRequest request,
        CancellationToken cancellationToken = default
    );

    Task<bool> DeleteBoardAsync(
        Guid userId,
        Guid boardId,
        CancellationToken cancellationToken = default
    );

    Task<bool> TransferOwnershipAsync(
        Guid userId,
        Guid boardId,
        Guid newOwnerId,
        CancellationToken cancellationToken = default
    );
}
