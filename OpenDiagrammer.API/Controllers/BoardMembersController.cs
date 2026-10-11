using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenDiagrammer.API.Dtos;
using OpenDiagrammer.Core.Boards;
using OpenDiagrammer.Data;
using OpenDiagrammer.Data.Entities;

namespace OpenDiagrammer.API.Controllers;

[ApiController]
[Route("boards/{boardId:guid}/members")]
[Authorize]
public sealed class BoardMembersController(OpenDiagrammerDbContext dbContext) : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.TryParse(
            User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value,
            out var id
        )
            ? id
            : throw new UnauthorizedAccessException();

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<BoardMemberDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetMembers(Guid boardId, CancellationToken cancellationToken)
    {
        var userId = CurrentUserId;

        var board = await dbContext
            .Boards.AsNoTracking()
            .Include(b => b.Members)
                .ThenInclude(m => m.User)
            .FirstOrDefaultAsync(b => b.Id == boardId, cancellationToken);

        if (board is null)
        {
            return NotFound();
        }

        var isOwner = board.OwnerId == userId;
        var isMember = board.Members.Any(m => m.UserId == userId);

        if (!isOwner && !isMember)
        {
            return Forbid();
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

        return Ok(result);
    }

    [HttpPost]
    [ProducesResponseType(typeof(BoardMemberDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> AddMember(
        Guid boardId,
        [FromBody] AddBoardMemberRequest request,
        CancellationToken cancellationToken
    )
    {
        var currentUserId = CurrentUserId;

        var board = await dbContext
            .Boards.Include(b => b.Members)
            .FirstOrDefaultAsync(b => b.Id == boardId, cancellationToken);

        if (board is null)
        {
            return NotFound();
        }

        var actorMember = board.Members.FirstOrDefault(m => m.UserId == currentUserId);
        var actorRole = board.OwnerId == currentUserId ? BoardRole.Owner : actorMember?.Role;

        if (actorRole is null || !actorRole.Value.CanShareBoard())
        {
            return Forbid();
        }

        if (!actorRole.Value.CanAssignRole(request.Role))
        {
            return Forbid();
        }

        var targetSearch = request.EmailOrUsername.Trim();
        var normalized = targetSearch.ToUpperInvariant();

        var targetUser = await dbContext.Users.FirstOrDefaultAsync(
            u => u.NormalizedEmail == normalized || u.NormalizedUsername == normalized,
            cancellationToken
        );

        if (targetUser is null)
        {
            return NotFound(
                new ProblemDetails
                {
                    Status = StatusCodes.Status404NotFound,
                    Title = "User not found",
                    Detail = $"No user found matching '{request.EmailOrUsername}'.",
                }
            );
        }

        if (board.Members.Any(m => m.UserId == targetUser.Id))
        {
            return Conflict(
                new ProblemDetails
                {
                    Status = StatusCodes.Status409Conflict,
                    Title = "User already a member",
                    Detail = "The specified user is already a member of this board.",
                }
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

        return CreatedAtAction(nameof(GetMembers), new { boardId = board.Id }, dto);
    }

    [HttpPut("{userId:guid}")]
    [ProducesResponseType(typeof(BoardMemberDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UpdateMemberRole(
        Guid boardId,
        Guid userId,
        [FromBody] UpdateBoardMemberRoleRequest request,
        CancellationToken cancellationToken
    )
    {
        var currentUserId = CurrentUserId;

        var board = await dbContext
            .Boards.Include(b => b.Members)
                .ThenInclude(m => m.User)
            .FirstOrDefaultAsync(b => b.Id == boardId, cancellationToken);

        if (board is null)
        {
            return NotFound();
        }

        var actorMember = board.Members.FirstOrDefault(m => m.UserId == currentUserId);
        var actorRole = board.OwnerId == currentUserId ? BoardRole.Owner : actorMember?.Role;

        if (actorRole is null || !actorRole.Value.CanShareBoard())
        {
            return Forbid();
        }

        var targetMember = board.Members.FirstOrDefault(m => m.UserId == userId);
        if (targetMember is null)
        {
            return NotFound(
                new ProblemDetails
                {
                    Status = StatusCodes.Status404NotFound,
                    Title = "Member not found",
                    Detail = "The user is not a member of this board.",
                }
            );
        }

        if (targetMember.UserId == board.OwnerId)
        {
            return BadRequest(
                new ProblemDetails
                {
                    Status = StatusCodes.Status400BadRequest,
                    Title = "Cannot modify owner role",
                    Detail =
                        "The board owner's role cannot be modified. Use the transfer ownership endpoint instead.",
                }
            );
        }

        if (!actorRole.Value.CanAssignRole(request.Role))
        {
            return Forbid();
        }

        // Admins cannot alter another Admin's role
        if (actorRole == BoardRole.Admin && targetMember.Role == BoardRole.Admin)
        {
            return Forbid();
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

        return Ok(dto);
    }

    [HttpDelete("{userId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> RemoveMember(
        Guid boardId,
        Guid userId,
        CancellationToken cancellationToken
    )
    {
        var currentUserId = CurrentUserId;

        var board = await dbContext
            .Boards.Include(b => b.Members)
            .FirstOrDefaultAsync(b => b.Id == boardId, cancellationToken);

        if (board is null)
        {
            return NotFound();
        }

        var targetMember = board.Members.FirstOrDefault(m => m.UserId == userId);
        if (targetMember is null)
        {
            return NotFound();
        }

        if (targetMember.UserId == board.OwnerId)
        {
            return BadRequest(
                new ProblemDetails
                {
                    Status = StatusCodes.Status400BadRequest,
                    Title = "Cannot remove owner",
                    Detail =
                        "The board owner cannot be removed. Transfer ownership or delete the board.",
                }
            );
        }

        // Self-removal (leaving board)
        if (userId == currentUserId)
        {
            dbContext.BoardMembers.Remove(targetMember);
            await dbContext.SaveChangesAsync(cancellationToken);
            return NoContent();
        }

        var actorMember = board.Members.FirstOrDefault(m => m.UserId == currentUserId);
        var actorRole = board.OwnerId == currentUserId ? BoardRole.Owner : actorMember?.Role;

        if (actorRole is null || !actorRole.Value.CanRemoveMember(targetMember.Role))
        {
            return Forbid();
        }

        dbContext.BoardMembers.Remove(targetMember);
        await dbContext.SaveChangesAsync(cancellationToken);

        return NoContent();
    }
}
