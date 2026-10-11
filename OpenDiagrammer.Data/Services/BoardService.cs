using Microsoft.EntityFrameworkCore;
using OpenDiagrammer.Core.Boards;
using OpenDiagrammer.Core.Services;
using OpenDiagrammer.Data.Entities;

namespace OpenDiagrammer.Data.Services;

public sealed class BoardService(OpenDiagrammerDbContext dbContext) : IBoardService
{
    public async Task<IReadOnlyList<BoardSummaryDto>> GetBoardsAsync(
        Guid userId,
        CancellationToken cancellationToken = default
    )
    {
        var boards = await dbContext
            .Boards.AsNoTracking()
            .Include(b => b.Owner)
            .Include(b => b.Members)
            .Where(b => b.OwnerId == userId || b.Members.Any(m => m.UserId == userId))
            .OrderByDescending(b => b.ModifiedAt)
            .ToListAsync(cancellationToken);

        return boards
            .Select(b =>
            {
                var userRole =
                    b.OwnerId == userId
                        ? BoardRole.Owner
                        : b.Members.First(m => m.UserId == userId).Role;

                return new BoardSummaryDto(
                    Id: b.Id,
                    Name: b.Name,
                    Description: b.Description,
                    OwnerId: b.OwnerId,
                    OwnerUsername: b.Owner.Username,
                    UserRole: userRole,
                    BackgroundType: b.BackgroundType,
                    BackgroundColor: b.BackgroundColor,
                    BackgroundOpacity: b.BackgroundOpacity,
                    Mode: b.Mode,
                    MemberCount: b.Members.Count,
                    CreatedAt: b.CreatedAt,
                    ModifiedAt: b.ModifiedAt
                );
            })
            .ToList();
    }

    public async Task<ServiceResult<BoardDetailDto>> GetBoardByIdAsync(
        Guid userId,
        Guid boardId,
        CancellationToken cancellationToken = default
    )
    {
        var board = await dbContext
            .Boards.AsNoTracking()
            .Include(b => b.Owner)
            .Include(b => b.Members)
                .ThenInclude(m => m.User)
            .FirstOrDefaultAsync(b => b.Id == boardId, cancellationToken);

        if (board is null)
        {
            return ServiceResult<BoardDetailDto>.NotFound();
        }

        var member = board.Members.FirstOrDefault(m => m.UserId == userId);
        if (board.OwnerId != userId && member is null)
        {
            return ServiceResult<BoardDetailDto>.Forbidden();
        }

        var userRole = board.OwnerId == userId ? BoardRole.Owner : member!.Role;

        var memberDtos = board
            .Members.Select(m => new BoardMemberDto(
                Id: m.Id,
                BoardId: m.BoardId,
                UserId: m.UserId,
                Username: m.User.Username,
                Email: m.User.Email,
                Role: m.Role,
                CreatedAt: m.CreatedAt
            ))
            .ToList();

        return ServiceResult<BoardDetailDto>.Success(
            new BoardDetailDto(
                Id: board.Id,
                Name: board.Name,
                Description: board.Description,
                OwnerId: board.OwnerId,
                OwnerUsername: board.Owner.Username,
                UserRole: userRole,
                BackgroundType: board.BackgroundType,
                BackgroundColor: board.BackgroundColor,
                BackgroundOpacity: board.BackgroundOpacity,
                Mode: board.Mode,
                ThinkModeConfigJson: board.ThinkModeConfigJson,
                CreatedAt: board.CreatedAt,
                ModifiedAt: board.ModifiedAt,
                Members: memberDtos
            )
        );
    }

    public async Task<ServiceResult<BoardDetailDto>> CreateBoardAsync(
        Guid userId,
        CreateBoardRequest request,
        CancellationToken cancellationToken = default
    )
    {
        var user = await dbContext.Users.FirstOrDefaultAsync(
            u => u.Id == userId,
            cancellationToken
        );
        if (user is null)
        {
            return ServiceResult<BoardDetailDto>.Unauthorized();
        }

        var board = new Board
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            OwnerId = userId,
            BackgroundType = request.BackgroundType ?? BoardBackgroundType.GridLines,
            BackgroundColor = request.BackgroundColor,
            BackgroundOpacity = request.BackgroundOpacity ?? 1.0,
            Mode = BoardMode.Normal,
        };

        var ownerMember = new BoardMember
        {
            Id = Guid.NewGuid(),
            BoardId = board.Id,
            UserId = userId,
            Role = BoardRole.Owner,
        };

        board.Members.Add(ownerMember);

        dbContext.Boards.Add(board);
        await dbContext.SaveChangesAsync(cancellationToken);

        var memberDto = new BoardMemberDto(
            Id: ownerMember.Id,
            BoardId: board.Id,
            UserId: user.Id,
            Username: user.Username,
            Email: user.Email,
            Role: BoardRole.Owner,
            CreatedAt: ownerMember.CreatedAt
        );

        var detail = new BoardDetailDto(
            Id: board.Id,
            Name: board.Name,
            Description: board.Description,
            OwnerId: board.OwnerId,
            OwnerUsername: user.Username,
            UserRole: BoardRole.Owner,
            BackgroundType: board.BackgroundType,
            BackgroundColor: board.BackgroundColor,
            BackgroundOpacity: board.BackgroundOpacity,
            Mode: board.Mode,
            ThinkModeConfigJson: board.ThinkModeConfigJson,
            CreatedAt: board.CreatedAt,
            ModifiedAt: board.ModifiedAt,
            Members: [memberDto]
        );

        return ServiceResult<BoardDetailDto>.Success(detail);
    }

    public async Task<ServiceResult<BoardDetailDto>> UpdateBoardAsync(
        Guid userId,
        Guid boardId,
        UpdateBoardRequest request,
        CancellationToken cancellationToken = default
    )
    {
        var board = await dbContext
            .Boards.Include(b => b.Owner)
            .Include(b => b.Members)
                .ThenInclude(m => m.User)
            .FirstOrDefaultAsync(b => b.Id == boardId, cancellationToken);

        if (board is null)
        {
            return ServiceResult<BoardDetailDto>.NotFound();
        }

        var member = board.Members.FirstOrDefault(m => m.UserId == userId);
        if (board.OwnerId != userId && member is null)
        {
            return ServiceResult<BoardDetailDto>.Forbidden();
        }

        var userRole = board.OwnerId == userId ? BoardRole.Owner : member!.Role;

        // Content edits require at least Editor role
        if (!userRole.CanEditBoard())
        {
            return ServiceResult<BoardDetailDto>.Forbidden();
        }

        // Mode changes require at least Admin role per PRD
        if (board.Mode != request.Mode && !userRole.CanChangeBoardMode())
        {
            return ServiceResult<BoardDetailDto>.Forbidden();
        }

        board.Name = request.Name.Trim();
        board.Description = request.Description?.Trim();
        board.BackgroundType = request.BackgroundType;
        board.BackgroundColor = request.BackgroundColor;
        board.BackgroundOpacity = request.BackgroundOpacity;
        board.Mode = request.Mode;
        board.ThinkModeConfigJson = request.ThinkModeConfigJson;

        await dbContext.SaveChangesAsync(cancellationToken);

        var memberDtos = board
            .Members.Select(m => new BoardMemberDto(
                Id: m.Id,
                BoardId: m.BoardId,
                UserId: m.UserId,
                Username: m.User.Username,
                Email: m.User.Email,
                Role: m.Role,
                CreatedAt: m.CreatedAt
            ))
            .ToList();

        return ServiceResult<BoardDetailDto>.Success(
            new BoardDetailDto(
                Id: board.Id,
                Name: board.Name,
                Description: board.Description,
                OwnerId: board.OwnerId,
                OwnerUsername: board.Owner.Username,
                UserRole: userRole,
                BackgroundType: board.BackgroundType,
                BackgroundColor: board.BackgroundColor,
                BackgroundOpacity: board.BackgroundOpacity,
                Mode: board.Mode,
                ThinkModeConfigJson: board.ThinkModeConfigJson,
                CreatedAt: board.CreatedAt,
                ModifiedAt: board.ModifiedAt,
                Members: memberDtos
            )
        );
    }

    public async Task<ServiceResult> DeleteBoardAsync(
        Guid userId,
        Guid boardId,
        CancellationToken cancellationToken = default
    )
    {
        var board = await dbContext.Boards.FirstOrDefaultAsync(
            b => b.Id == boardId,
            cancellationToken
        );

        if (board is null)
        {
            return ServiceResult.NotFound();
        }

        if (board.OwnerId != userId)
        {
            return ServiceResult.Forbidden();
        }

        dbContext.Boards.Remove(board);
        await dbContext.SaveChangesAsync(cancellationToken);

        return ServiceResult.Success();
    }

    public async Task<ServiceResult> TransferOwnershipAsync(
        Guid userId,
        Guid boardId,
        Guid newOwnerId,
        CancellationToken cancellationToken = default
    )
    {
        var board = await dbContext
            .Boards.Include(b => b.Members)
            .FirstOrDefaultAsync(b => b.Id == boardId, cancellationToken);

        if (board is null)
        {
            return ServiceResult.NotFound();
        }

        if (board.OwnerId != userId)
        {
            return ServiceResult.Forbidden();
        }

        if (newOwnerId == userId)
        {
            return ServiceResult.BadRequest(
                "You are already the owner of this board.",
                "Invalid ownership transfer"
            );
        }

        var newOwnerUser = await dbContext.Users.FirstOrDefaultAsync(
            u => u.Id == newOwnerId,
            cancellationToken
        );
        if (newOwnerUser is null)
        {
            return ServiceResult.BadRequest(
                "The target user for ownership transfer does not exist.",
                "User not found"
            );
        }

        // Update board owner
        board.OwnerId = newOwnerId;

        // Ensure old owner is member with Admin role
        var oldOwnerMember = board.Members.FirstOrDefault(m => m.UserId == userId);
        if (oldOwnerMember != null)
        {
            oldOwnerMember.Role = BoardRole.Admin;
        }
        else
        {
            dbContext.BoardMembers.Add(
                new BoardMember
                {
                    Id = Guid.NewGuid(),
                    BoardId = board.Id,
                    UserId = userId,
                    Role = BoardRole.Admin,
                }
            );
        }

        // Ensure new owner is member with Owner role
        var newOwnerMember = board.Members.FirstOrDefault(m => m.UserId == newOwnerId);
        if (newOwnerMember != null)
        {
            newOwnerMember.Role = BoardRole.Owner;
        }
        else
        {
            dbContext.BoardMembers.Add(
                new BoardMember
                {
                    Id = Guid.NewGuid(),
                    BoardId = board.Id,
                    UserId = newOwnerId,
                    Role = BoardRole.Owner,
                }
            );
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return ServiceResult.Success();
    }
}
