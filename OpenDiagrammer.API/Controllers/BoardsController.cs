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
[Route("boards")]
[Authorize]
public sealed class BoardsController(OpenDiagrammerDbContext dbContext) : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.TryParse(
            User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value,
            out var id
        )
            ? id
            : throw new UnauthorizedAccessException();

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<BoardSummaryDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetBoards(CancellationToken cancellationToken)
    {
        var userId = CurrentUserId;

        var boards = await dbContext
            .Boards.AsNoTracking()
            .Include(b => b.Owner)
            .Include(b => b.Members)
            .Where(b => b.OwnerId == userId || b.Members.Any(m => m.UserId == userId))
            .OrderByDescending(b => b.ModifiedAt)
            .ToListAsync(cancellationToken);

        var result = boards
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

        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(BoardDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetBoardById(Guid id, CancellationToken cancellationToken)
    {
        var userId = CurrentUserId;

        var board = await dbContext
            .Boards.AsNoTracking()
            .Include(b => b.Owner)
            .Include(b => b.Members)
                .ThenInclude(m => m.User)
            .FirstOrDefaultAsync(b => b.Id == id, cancellationToken);

        if (board is null)
        {
            return NotFound();
        }

        var member = board.Members.FirstOrDefault(m => m.UserId == userId);
        if (board.OwnerId != userId && member is null)
        {
            return Forbid();
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

        return Ok(
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

    [HttpPost]
    [ProducesResponseType(typeof(BoardDetailDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateBoard(
        [FromBody] CreateBoardRequest request,
        CancellationToken cancellationToken
    )
    {
        var userId = CurrentUserId;

        var user = await dbContext.Users.FirstOrDefaultAsync(
            u => u.Id == userId,
            cancellationToken
        );
        if (user is null)
        {
            return Unauthorized();
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

        var response = new BoardDetailDto(
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

        return CreatedAtAction(nameof(GetBoardById), new { id = board.Id }, response);
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(BoardDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> UpdateBoard(
        Guid id,
        [FromBody] UpdateBoardRequest request,
        CancellationToken cancellationToken
    )
    {
        var userId = CurrentUserId;

        var board = await dbContext
            .Boards.Include(b => b.Owner)
            .Include(b => b.Members)
                .ThenInclude(m => m.User)
            .FirstOrDefaultAsync(b => b.Id == id, cancellationToken);

        if (board is null)
        {
            return NotFound();
        }

        var member = board.Members.FirstOrDefault(m => m.UserId == userId);
        if (board.OwnerId != userId && member is null)
        {
            return Forbid();
        }

        var userRole = board.OwnerId == userId ? BoardRole.Owner : member!.Role;

        // Content edits require at least Editor role
        if (!userRole.CanEditBoard())
        {
            return Forbid();
        }

        // Mode changes require at least Admin role per PRD
        if (board.Mode != request.Mode && !userRole.CanChangeBoardMode())
        {
            return Forbid();
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

        return Ok(
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

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> DeleteBoard(Guid id, CancellationToken cancellationToken)
    {
        var userId = CurrentUserId;

        var board = await dbContext.Boards.FirstOrDefaultAsync(b => b.Id == id, cancellationToken);

        if (board is null)
        {
            return NotFound();
        }

        if (board.OwnerId != userId)
        {
            return Forbid();
        }

        dbContext.Boards.Remove(board);
        await dbContext.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    [HttpPost("{id:guid}/transfer-ownership")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> TransferOwnership(
        Guid id,
        [FromBody] TransferOwnershipRequest request,
        CancellationToken cancellationToken
    )
    {
        var userId = CurrentUserId;

        var board = await dbContext
            .Boards.Include(b => b.Members)
            .FirstOrDefaultAsync(b => b.Id == id, cancellationToken);

        if (board is null)
        {
            return NotFound();
        }

        if (board.OwnerId != userId)
        {
            return Forbid();
        }

        if (request.NewOwnerId == userId)
        {
            return BadRequest(
                new ProblemDetails
                {
                    Status = StatusCodes.Status400BadRequest,
                    Title = "Invalid ownership transfer",
                    Detail = "You are already the owner of this board.",
                }
            );
        }

        var newOwnerUser = await dbContext.Users.FirstOrDefaultAsync(
            u => u.Id == request.NewOwnerId,
            cancellationToken
        );
        if (newOwnerUser is null)
        {
            return BadRequest(
                new ProblemDetails
                {
                    Status = StatusCodes.Status400BadRequest,
                    Title = "User not found",
                    Detail = "The target user for ownership transfer does not exist.",
                }
            );
        }

        // Update board owner
        board.OwnerId = request.NewOwnerId;

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
        var newOwnerMember = board.Members.FirstOrDefault(m => m.UserId == request.NewOwnerId);
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
                    UserId = request.NewOwnerId,
                    Role = BoardRole.Owner,
                }
            );
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new { message = "Ownership transferred successfully." });
    }
}
