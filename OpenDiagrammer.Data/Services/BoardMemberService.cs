using Microsoft.EntityFrameworkCore;
using OpenDiagrammer.Core.Boards;
using OpenDiagrammer.Core.Exceptions;
using OpenDiagrammer.Data.Entities;

namespace OpenDiagrammer.Data.Services;

public sealed class BoardMemberService(OpenDiagrammerDbContext dbContext) : IBoardMemberService
{
    public async Task<IReadOnlyList<BoardMemberDto>?> GetMembersAsync(
        Guid currentUserId,
        Guid boardId,
        CancellationToken cancellationToken = default
    )
    {
        var board = await dbContext
            .Boards.AsNoTracking()
            .Include(b => b.Members)
                .ThenInclude(m => m.User)
            .FirstOrDefaultAsync(b => b.Id == boardId, cancellationToken);

        if (board is null)
        {
            return null;
        }

        var isOwner = board.OwnerId == currentUserId;
        var isMember = board.Members.Any(m => m.UserId == currentUserId);

        if (!isOwner && !isMember)
        {
            throw new ForbiddenException(
                "You do not have permission to view members of this board."
            );
        }

        return board
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
    }

    public async Task<BoardMemberDto?> AddMemberAsync(
        Guid currentUserId,
        Guid boardId,
        AddBoardMemberRequest request,
        CancellationToken cancellationToken = default
    )
    {
        var board = await dbContext
            .Boards.Include(b => b.Members)
            .FirstOrDefaultAsync(b => b.Id == boardId, cancellationToken);

        if (board is null)
        {
            return null;
        }

        var actorMember = board.Members.FirstOrDefault(m => m.UserId == currentUserId);
        var actorRole = board.OwnerId == currentUserId ? BoardRole.Owner : actorMember?.Role;

        if (actorRole is null || !actorRole.Value.CanShareBoard())
        {
            throw new ForbiddenException(
                "You do not have permission to add members to this board."
            );
        }

        if (!actorRole.Value.CanAssignRole(request.Role))
        {
            throw new ForbiddenException("You do not have permission to assign this role.");
        }

        var targetSearch = request.EmailOrUsername.Trim();
        var normalized = targetSearch.ToUpperInvariant();

        var targetUser = await dbContext.Users.FirstOrDefaultAsync(
            u => u.NormalizedEmail == normalized || u.NormalizedUsername == normalized,
            cancellationToken
        );

        if (targetUser is null)
        {
            throw new NotFoundException($"No user found matching '{request.EmailOrUsername}'.");
        }

        if (board.Members.Any(m => m.UserId == targetUser.Id))
        {
            throw new ConflictException(
                "The specified user is already a member of this board.",
                "User already a member"
            );
        }

        var newMember = new BoardMember
        {
            Id = Guid.NewGuid(),
            BoardId = board.Id,
            UserId = targetUser.Id,
            Role = request.Role,
        };

        dbContext.BoardMembers.Add(newMember);
        await dbContext.SaveChangesAsync(cancellationToken);

        return new BoardMemberDto(
            Id: newMember.Id,
            BoardId: board.Id,
            UserId: targetUser.Id,
            Username: targetUser.Username,
            Email: targetUser.Email,
            Role: newMember.Role,
            CreatedAt: newMember.CreatedAt
        );
    }

    public async Task<BoardMemberDto?> UpdateMemberRoleAsync(
        Guid currentUserId,
        Guid boardId,
        Guid targetUserId,
        UpdateBoardMemberRoleRequest request,
        CancellationToken cancellationToken = default
    )
    {
        var board = await dbContext
            .Boards.Include(b => b.Members)
                .ThenInclude(m => m.User)
            .FirstOrDefaultAsync(b => b.Id == boardId, cancellationToken);

        if (board is null)
        {
            return null;
        }

        var actorMember = board.Members.FirstOrDefault(m => m.UserId == currentUserId);
        var actorRole = board.OwnerId == currentUserId ? BoardRole.Owner : actorMember?.Role;

        if (actorRole is null || !actorRole.Value.CanShareBoard())
        {
            throw new ForbiddenException(
                "You do not have permission to manage members of this board."
            );
        }

        var targetMember = board.Members.FirstOrDefault(m => m.UserId == targetUserId);
        if (targetMember is null)
        {
            throw new NotFoundException("The user is not a member of this board.");
        }

        if (targetMember.UserId == board.OwnerId)
        {
            throw new InvalidOperationException(
                "The board owner's role cannot be modified. Use the transfer ownership endpoint instead."
            );
        }

        if (!actorRole.Value.CanAssignRole(request.Role))
        {
            throw new ForbiddenException("You do not have permission to assign this role.");
        }

        // Admins cannot alter another Admin's role
        if (actorRole == BoardRole.Admin && targetMember.Role == BoardRole.Admin)
        {
            throw new ForbiddenException(
                "Administrators cannot modify another administrator's role."
            );
        }

        targetMember.Role = request.Role;
        await dbContext.SaveChangesAsync(cancellationToken);

        return new BoardMemberDto(
            Id: targetMember.Id,
            BoardId: board.Id,
            UserId: targetMember.UserId,
            Username: targetMember.User.Username,
            Email: targetMember.User.Email,
            Role: targetMember.Role,
            CreatedAt: targetMember.CreatedAt
        );
    }

    public async Task<bool> RemoveMemberAsync(
        Guid currentUserId,
        Guid boardId,
        Guid targetUserId,
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

        var targetMember = board.Members.FirstOrDefault(m => m.UserId == targetUserId);
        if (targetMember is null)
        {
            return false;
        }

        if (targetMember.UserId == board.OwnerId)
        {
            throw new InvalidOperationException(
                "The board owner cannot be removed. Transfer ownership or delete the board."
            );
        }

        // Self-removal (leaving board)
        if (targetUserId == currentUserId)
        {
            dbContext.BoardMembers.Remove(targetMember);
            await dbContext.SaveChangesAsync(cancellationToken);
            return true;
        }

        var actorMember = board.Members.FirstOrDefault(m => m.UserId == currentUserId);
        var actorRole = board.OwnerId == currentUserId ? BoardRole.Owner : actorMember?.Role;

        if (actorRole is null || !actorRole.Value.CanRemoveMember(targetMember.Role))
        {
            throw new ForbiddenException("You do not have permission to remove this member.");
        }

        dbContext.BoardMembers.Remove(targetMember);
        await dbContext.SaveChangesAsync(cancellationToken);

        return true;
    }
}
