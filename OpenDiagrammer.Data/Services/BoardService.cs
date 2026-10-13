using Microsoft.EntityFrameworkCore;
using OpenDiagrammer.Core.Boards;
using OpenDiagrammer.Core.Exceptions;
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

    public async Task<BoardDetailDto?> GetBoardByIdAsync(
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
            return null;
        }

        var member = board.Members.FirstOrDefault(m => m.UserId == userId);
        if (board.OwnerId != userId && member is null)
        {
            throw new ForbiddenException("You do not have permission to view this board.");
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

        return new BoardDetailDto(
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
            CanvasDataJson: board.CanvasDataJson,
            CreatedAt: board.CreatedAt,
            ModifiedAt: board.ModifiedAt,
            Members: memberDtos,
            CrdtState: board.CrdtState
        );
    }

    public async Task<BoardDetailDto> CreateBoardAsync(
        Guid userId,
        CreateBoardRequest request,
        CancellationToken cancellationToken = default
    )
    {
        var user = await dbContext.Users.FirstAsync(u => u.Id == userId, cancellationToken);

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

        return new BoardDetailDto(
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
            CanvasDataJson: board.CanvasDataJson,
            CreatedAt: board.CreatedAt,
            ModifiedAt: board.ModifiedAt,
            Members: [memberDto],
            CrdtState: board.CrdtState
        );
    }

    public async Task<BoardDetailDto?> UpdateBoardAsync(
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
            return null;
        }

        var member = board.Members.FirstOrDefault(m => m.UserId == userId);
        if (board.OwnerId != userId && member is null)
        {
            throw new ForbiddenException("You are not a member of this board.");
        }

        var userRole = board.OwnerId == userId ? BoardRole.Owner : member!.Role;

        // Content edits require at least Editor role
        if (!userRole.CanEditBoard())
        {
            throw new ForbiddenException("You do not have permission to edit this board.");
        }

        // Mode changes require at least Admin role per PRD
        if (board.Mode != request.Mode && !userRole.CanChangeBoardMode())
        {
            throw new ForbiddenException(
                "Only board owners and administrators can change the board mode."
            );
        }

        board.Name = request.Name.Trim();
        board.Description = request.Description?.Trim();
        board.BackgroundType = request.BackgroundType;
        board.BackgroundColor = request.BackgroundColor;
        board.BackgroundOpacity = request.BackgroundOpacity;
        board.Mode = request.Mode;
        board.ThinkModeConfigJson = request.ThinkModeConfigJson;
        if (request.CanvasDataJson is not null)
        {
            board.CanvasDataJson = request.CanvasDataJson;
        }

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

        return new BoardDetailDto(
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
            CanvasDataJson: board.CanvasDataJson,
            CreatedAt: board.CreatedAt,
            ModifiedAt: board.ModifiedAt,
            Members: memberDtos,
            CrdtState: board.CrdtState
        );
    }

    public async Task<BoardDetailDto?> UpdateCanvasDataAsync(
        Guid userId,
        Guid boardId,
        UpdateCanvasDataRequest request,
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
            return null;
        }

        var member = board.Members.FirstOrDefault(m => m.UserId == userId);
        if (board.OwnerId != userId && member is null)
        {
            throw new ForbiddenException("You are not a member of this board.");
        }

        var userRole = board.OwnerId == userId ? BoardRole.Owner : member!.Role;

        if (!userRole.CanEditBoard())
        {
            throw new ForbiddenException("You do not have permission to edit this board.");
        }

        board.CanvasDataJson = request.CanvasDataJson;

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

        return new BoardDetailDto(
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
            CanvasDataJson: board.CanvasDataJson,
            CreatedAt: board.CreatedAt,
            ModifiedAt: board.ModifiedAt,
            Members: memberDtos,
            CrdtState: board.CrdtState
        );
    }

    public async Task<BoardDetailDto?> UpdateCrdtStateAsync(
        Guid userId,
        Guid boardId,
        UpdateCrdtStateRequest request,
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
            return null;
        }

        var member = board.Members.FirstOrDefault(m => m.UserId == userId);
        if (board.OwnerId != userId && member is null)
        {
            throw new ForbiddenException("You are not a member of this board.");
        }

        var userRole = board.OwnerId == userId ? BoardRole.Owner : member!.Role;

        if (!userRole.CanEditBoard())
        {
            throw new ForbiddenException("You do not have permission to edit this board.");
        }

        board.CrdtState = request.CrdtState;

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

        return new BoardDetailDto(
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
            CanvasDataJson: board.CanvasDataJson,
            CreatedAt: board.CreatedAt,
            ModifiedAt: board.ModifiedAt,
            Members: memberDtos,
            CrdtState: board.CrdtState
        );
    }

    public async Task<byte[]?> GetCrdtStateAsync(
        Guid userId,
        Guid boardId,
        CancellationToken cancellationToken = default
    )
    {
        var board = await dbContext
            .Boards.AsNoTracking()
            .Include(b => b.Members)
            .FirstOrDefaultAsync(b => b.Id == boardId, cancellationToken);

        if (board is null)
        {
            return null;
        }

        var member = board.Members.FirstOrDefault(m => m.UserId == userId);
        if (board.OwnerId != userId && member is null)
        {
            throw new ForbiddenException("You do not have permission to view this board.");
        }

        return board.CrdtState;
    }

    public async Task<bool> DeleteBoardAsync(
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
            return false;
        }

        if (board.OwnerId != userId)
        {
            throw new ForbiddenException("Only the board owner can delete this board.");
        }

        dbContext.Boards.Remove(board);
        await dbContext.SaveChangesAsync(cancellationToken);

        return true;
    }

    public async Task<bool> TransferOwnershipAsync(
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
            return false;
        }

        if (board.OwnerId != userId)
        {
            throw new ForbiddenException("Only the board owner can transfer ownership.");
        }

        if (newOwnerId == userId)
        {
            throw new ArgumentException("You are already the owner of this board.");
        }

        var newOwnerUser = await dbContext.Users.FirstOrDefaultAsync(
            u => u.Id == newOwnerId,
            cancellationToken
        );
        if (newOwnerUser is null)
        {
            throw new InvalidOperationException(
                "The target user for ownership transfer does not exist."
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

        return true;
    }

    public async Task<IReadOnlyList<BoardRevisionSummaryDto>> GetBoardRevisionsAsync(
        Guid userId,
        Guid boardId,
        CancellationToken cancellationToken = default
    )
    {
        var board = await dbContext
            .Boards.AsNoTracking()
            .Include(b => b.Members)
            .FirstOrDefaultAsync(b => b.Id == boardId, cancellationToken);

        if (board is null)
        {
            throw new KeyNotFoundException($"Board with ID {boardId} was not found.");
        }

        var member = board.Members.FirstOrDefault(m => m.UserId == userId);
        if (board.OwnerId != userId && member is null)
        {
            throw new ForbiddenException(
                "You do not have permission to view revisions for this board."
            );
        }

        var revisions = await dbContext
            .BoardRevisions.AsNoTracking()
            .Include(r => r.CreatedBy)
            .Where(r => r.BoardId == boardId)
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new BoardRevisionSummaryDto(
                r.Id,
                r.BoardId,
                r.Title,
                r.Description,
                r.CreatedById,
                r.CreatedBy.Username,
                r.CreatedAt
            ))
            .ToListAsync(cancellationToken);

        return revisions;
    }

    public async Task<BoardRevisionDto?> GetBoardRevisionByIdAsync(
        Guid userId,
        Guid boardId,
        Guid revisionId,
        CancellationToken cancellationToken = default
    )
    {
        var board = await dbContext
            .Boards.AsNoTracking()
            .Include(b => b.Members)
            .FirstOrDefaultAsync(b => b.Id == boardId, cancellationToken);

        if (board is null)
        {
            return null;
        }

        var member = board.Members.FirstOrDefault(m => m.UserId == userId);
        if (board.OwnerId != userId && member is null)
        {
            throw new ForbiddenException("You do not have permission to view this revision.");
        }

        var revision = await dbContext
            .BoardRevisions.AsNoTracking()
            .Include(r => r.CreatedBy)
            .FirstOrDefaultAsync(
                r => r.Id == revisionId && r.BoardId == boardId,
                cancellationToken
            );

        if (revision is null)
        {
            return null;
        }

        return new BoardRevisionDto(
            revision.Id,
            revision.BoardId,
            revision.Title,
            revision.Description,
            revision.CreatedById,
            revision.CreatedBy.Username,
            revision.CanvasDataJson,
            revision.CrdtState,
            revision.CreatedAt
        );
    }

    public async Task<BoardRevisionDto> CreateBoardRevisionAsync(
        Guid userId,
        Guid boardId,
        CreateBoardRevisionRequest request,
        CancellationToken cancellationToken = default
    )
    {
        var board = await dbContext
            .Boards.Include(b => b.Members)
            .FirstOrDefaultAsync(b => b.Id == boardId, cancellationToken);

        if (board is null)
        {
            throw new KeyNotFoundException($"Board with ID {boardId} was not found.");
        }

        var member = board.Members.FirstOrDefault(m => m.UserId == userId);
        if (board.OwnerId != userId && member is null)
        {
            throw new ForbiddenException(
                "You do not have permission to create revisions on this board."
            );
        }

        var userRole = board.OwnerId == userId ? BoardRole.Owner : member!.Role;
        if (!userRole.CanCreateRevision())
        {
            throw new ForbiddenException("Your role does not permit creating revisions.");
        }

        var user = await dbContext.Users.FindAsync([userId], cancellationToken);

        var revision = new BoardRevision
        {
            Id = Guid.NewGuid(),
            BoardId = board.Id,
            CreatedById = userId,
            Title = request.Title.Trim(),
            Description = request.Description?.Trim(),
            CanvasDataJson = board.CanvasDataJson,
            CrdtState = board.CrdtState,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        dbContext.BoardRevisions.Add(revision);
        await dbContext.SaveChangesAsync(cancellationToken);

        return new BoardRevisionDto(
            revision.Id,
            revision.BoardId,
            revision.Title,
            revision.Description,
            revision.CreatedById,
            user?.Username ?? "Unknown",
            revision.CanvasDataJson,
            revision.CrdtState,
            revision.CreatedAt
        );
    }

    public async Task<BoardDetailDto?> RestoreBoardRevisionAsync(
        Guid userId,
        Guid boardId,
        Guid revisionId,
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
            return null;
        }

        var member = board.Members.FirstOrDefault(m => m.UserId == userId);
        if (board.OwnerId != userId && member is null)
        {
            throw new ForbiddenException(
                "You do not have permission to restore revisions on this board."
            );
        }

        var userRole = board.OwnerId == userId ? BoardRole.Owner : member!.Role;
        if (!userRole.CanManageRevisions())
        {
            throw new ForbiddenException(
                "Only board owners and administrators can restore revisions."
            );
        }

        var revision = await dbContext
            .BoardRevisions.AsNoTracking()
            .FirstOrDefaultAsync(
                r => r.Id == revisionId && r.BoardId == boardId,
                cancellationToken
            );

        if (revision is null)
        {
            throw new KeyNotFoundException($"Revision with ID {revisionId} was not found.");
        }

        var user = await dbContext.Users.FindAsync([userId], cancellationToken);
        var operatorUsername = user?.Username ?? "System";

        // Save current board state as a pre-restore backup revision first
        var backupRevision = new BoardRevision
        {
            Id = Guid.NewGuid(),
            BoardId = board.Id,
            CreatedById = userId,
            Title = $"Pre-restore Snapshot (Before '{revision.Title}')",
            Description = $"Automatic backup created before restoring revision '{revision.Title}'",
            CanvasDataJson = board.CanvasDataJson,
            CrdtState = board.CrdtState,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        dbContext.BoardRevisions.Add(backupRevision);

        // Apply revision state to board
        board.CanvasDataJson = revision.CanvasDataJson;
        board.CrdtState = revision.CrdtState;
        board.ModifiedAt = DateTimeOffset.UtcNow;
        board.ModifiedBy = operatorUsername;

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

        return new BoardDetailDto(
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
            CanvasDataJson: board.CanvasDataJson,
            CreatedAt: board.CreatedAt,
            ModifiedAt: board.ModifiedAt,
            Members: memberDtos,
            CrdtState: board.CrdtState
        );
    }
}
