using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenDiagrammer.Core.Boards;
using OpenDiagrammer.Core.Exceptions;

namespace OpenDiagrammer.API.Controllers;

[ApiController]
[Route("boards/{boardId:guid}/members")]
[Authorize]
public sealed class BoardMembersController(IBoardMemberService memberService) : ControllerBase
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
        try
        {
            var members = await memberService.GetMembersAsync(
                CurrentUserId,
                boardId,
                cancellationToken
            );
            return members is not null ? Ok(members) : NotFound();
        }
        catch (ForbiddenException)
        {
            return Forbid();
        }
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
        try
        {
            var member = await memberService.AddMemberAsync(
                CurrentUserId,
                boardId,
                request,
                cancellationToken
            );
            return member is not null
                ? CreatedAtAction(nameof(GetMembers), new { boardId }, member)
                : NotFound();
        }
        catch (ForbiddenException)
        {
            return Forbid();
        }
        catch (NotFoundException ex)
        {
            return NotFound(
                new ProblemDetails
                {
                    Status = StatusCodes.Status404NotFound,
                    Title = "User not found",
                    Detail = ex.Message,
                }
            );
        }
        catch (ConflictException ex)
        {
            return Conflict(
                new ProblemDetails
                {
                    Status = StatusCodes.Status409Conflict,
                    Title = ex.Title,
                    Detail = ex.Message,
                }
            );
        }
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
        try
        {
            var member = await memberService.UpdateMemberRoleAsync(
                CurrentUserId,
                boardId,
                userId,
                request,
                cancellationToken
            );
            return member is not null ? Ok(member) : NotFound();
        }
        catch (ForbiddenException)
        {
            return Forbid();
        }
        catch (NotFoundException ex)
        {
            return NotFound(
                new ProblemDetails
                {
                    Status = StatusCodes.Status404NotFound,
                    Title = "Member not found",
                    Detail = ex.Message,
                }
            );
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(
                new ProblemDetails
                {
                    Status = StatusCodes.Status400BadRequest,
                    Title = "Cannot modify owner role",
                    Detail = ex.Message,
                }
            );
        }
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
        try
        {
            var removed = await memberService.RemoveMemberAsync(
                CurrentUserId,
                boardId,
                userId,
                cancellationToken
            );
            return removed ? NoContent() : NotFound();
        }
        catch (ForbiddenException)
        {
            return Forbid();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(
                new ProblemDetails
                {
                    Status = StatusCodes.Status400BadRequest,
                    Title = "Cannot remove owner",
                    Detail = ex.Message,
                }
            );
        }
    }
}
