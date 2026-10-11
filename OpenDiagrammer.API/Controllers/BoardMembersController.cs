using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenDiagrammer.API.Http;
using OpenDiagrammer.Core.Boards;

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
        var result = await memberService.GetMembersAsync(CurrentUserId, boardId, cancellationToken);
        return this.ToActionResult(result);
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
        var result = await memberService.AddMemberAsync(
            CurrentUserId,
            boardId,
            request,
            cancellationToken
        );
        if (!result.IsSuccess)
        {
            return this.ToActionResult(result);
        }

        return CreatedAtAction(nameof(GetMembers), new { boardId }, result.Value);
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
        var result = await memberService.UpdateMemberRoleAsync(
            CurrentUserId,
            boardId,
            userId,
            request,
            cancellationToken
        );
        return this.ToActionResult(result);
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
        var result = await memberService.RemoveMemberAsync(
            CurrentUserId,
            boardId,
            userId,
            cancellationToken
        );
        if (!result.IsSuccess)
        {
            return this.ToActionResult(result);
        }

        return NoContent();
    }
}
