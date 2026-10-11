using Microsoft.EntityFrameworkCore;
using OpenDiagrammer.Core.Boards;
using OpenDiagrammer.Core.Services;
using OpenDiagrammer.Data.Entities;

namespace OpenDiagrammer.Data.Services;

public sealed class BoardMemberService(OpenDiagrammerDbContext dbContext) : IBoardMemberService
{
    public async Task<ServiceResult<IReadOnlyList<BoardMemberDto>>> GetMembersAsync(
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
            return ServiceResult<IReadOnlyList<BoardMemberDto>>.NotFound();
        }

        var isOwner = board.OwnerId == currentUserId;
        var isMember = board.Members.Any(m => m.UserId == currentUserId);

        if (!isOwner && !isMember)
        {
            return ServiceResult<IReadOnlyList<BoardMemberDto>>.Forbidden();
        }

        var result = board
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

        return ServiceResult<IReadOnlyList<BoardMemberDto>>.Success(result);
    }

    public async Task<ServiceResult<BoardMemberDto>> AddMemberAsync(
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
            return ServiceResult<BoardMemberDto>.NotFound();
        }

        var actorMember = board.Members.FirstOrDefault(m => m.UserId == currentUserId);
        var actorRole = board.OwnerId == currentUserId ? BoardRole.Owner : actorMember?.Role;

        if (actorRole is null || !actorRole.Value.CanShareBoard())
        {
            return ServiceResult<BoardMemberDto>.Forbidden();
        }

        if (!actorRole.Value.CanAssignRole(request.Role))
        {
            return ServiceResult<BoardMemberDto>.Forbidden();
        }

        var targetSearch = request.EmailOrUsername.Trim();
        var normalized = targetSearch.ToUpperInvariant();

        var targetUser = await dbContext.Users.FirstOrDefaultAsync(
            u => u.NormalizedEmail == normalized || u.NormalizedUsername == normalized,
            cancellationToken
        );

        if (targetUser is null)
        {
            return ServiceResult<BoardMemberDto>.NotFound(
                $"No user found matching '{request.EmailOrUsername}'.",
                "User not found"
            );
        }

        if (board.Members.Any(m => m.UserId == targetUser.Id))
        {
            return ServiceResult<BoardMemberDto>.Conflict(
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

        var dto = new BoardMemberDto(
            Id: newMember.Id,
            BoardId: board.Id,
            UserId: targetUser.Id,
            Username: targetUser.Username,
            Email: targetUser.Email,
            Role: newMember.Role,
            CreatedAt: newMember.CreatedAt
        );

        return ServiceResult<BoardMemberDto>.Success(dto);
    }

    public async Task<ServiceResult<BoardMemberDto>> UpdateMemberRoleAsync(
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
            return ServiceResult<BoardMemberDto>.NotFound();
        }

        var actorMember = board.Members.FirstOrDefault(m => m.UserId == currentUserId);
        var actorRole = board.OwnerId == currentUserId ? BoardRole.Owner : actorMember?.Role;

        if (actorRole is null || !actorRole.Value.CanShareBoard())
        {
            return ServiceResult<BoardMemberDto>.Forbidden();
        }

        var targetMember = board.Members.FirstOrDefault(m => m.UserId == targetUserId);
        if (targetMember is null)
        {
            return ServiceResult<BoardMemberDto>.NotFound(
                "The user is not a member of this board.",
                "Member not found"
            );
        }

        if (targetMember.UserId == board.OwnerId)
        {
            return ServiceResult<BoardMemberDto>.BadRequest(
                "The board owner's role cannot be modified. Use the transfer ownership endpoint instead.",
                "Cannot modify owner role"
            );
        }

        if (!actorRole.Value.CanAssignRole(request.Role))
        {
            return ServiceResult<BoardMemberDto>.Forbidden();
        }

        // Admins cannot alter another Admin's role
        if (actorRole == BoardRole.Admin && targetMember.Role == BoardRole.Admin)
        {
            return ServiceResult<BoardMemberDto>.Forbidden();
        }

        targetMember.Role = request.Role;
        await dbContext.SaveChangesAsync(cancellationToken);

        var dto = new BoardMemberDto(
            Id: targetMember.Id,
            BoardId: board.Id,
            UserId: targetMember.UserId,
            Username: targetMember.User.Username,
            Email: targetMember.User.Email,
            Role: targetMember.Role,
            CreatedAt: targetMember.CreatedAt
        );

        return ServiceResult<BoardMemberDto>.Success(dto);
    }

    public async Task<ServiceResult> RemoveMemberAsync(
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
            return ServiceResult.NotFound();
        }

        var targetMember = board.Members.FirstOrDefault(m => m.UserId == targetUserId);
        if (targetMember is null)
        {
            return ServiceResult.NotFound();
        }

        if (targetMember.UserId == board.OwnerId)
        {
            return ServiceResult.BadRequest(
                "The board owner cannot be removed. Transfer ownership or delete the board.",
                "Cannot remove owner"
            );
        }

        // Self-removal (leaving board)
        if (targetUserId == currentUserId)
        {
            dbContext.BoardMembers.Remove(targetMember);
            await dbContext.SaveChangesAsync(cancellationToken);
            return ServiceResult.Success();
        }

        var actorMember = board.Members.FirstOrDefault(m => m.UserId == currentUserId);
        var actorRole = board.OwnerId == currentUserId ? BoardRole.Owner : actorMember?.Role;

        if (actorRole is null || !actorRole.Value.CanRemoveMember(targetMember.Role))
        {
            return ServiceResult.Forbidden();
        }

        dbContext.BoardMembers.Remove(targetMember);
        await dbContext.SaveChangesAsync(cancellationToken);

        return ServiceResult.Success();
    }
}
