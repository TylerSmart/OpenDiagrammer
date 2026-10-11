using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenDiagrammer.API.Http;
using OpenDiagrammer.Core.Boards;

namespace OpenDiagrammer.API.Controllers;

[ApiController]
[Route("boards")]
[Authorize]
public sealed class BoardsController(IBoardService boardService) : ControllerBase
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
        var boards = await boardService.GetBoardsAsync(CurrentUserId, cancellationToken);
        return Ok(boards);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(BoardDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetBoardById(Guid id, CancellationToken cancellationToken)
    {
        var result = await boardService.GetBoardByIdAsync(CurrentUserId, id, cancellationToken);
        return this.ToActionResult(result);
    }

    [HttpPost]
    [ProducesResponseType(typeof(BoardDetailDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateBoard(
        [FromBody] CreateBoardRequest request,
        CancellationToken cancellationToken
    )
    {
        var result = await boardService.CreateBoardAsync(CurrentUserId, request, cancellationToken);
        if (!result.IsSuccess)
        {
            return this.ToActionResult(result);
        }

        return CreatedAtAction(nameof(GetBoardById), new { id = result.Value!.Id }, result.Value);
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
        var result = await boardService.UpdateBoardAsync(
            CurrentUserId,
            id,
            request,
            cancellationToken
        );
        return this.ToActionResult(result);
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> DeleteBoard(Guid id, CancellationToken cancellationToken)
    {
        var result = await boardService.DeleteBoardAsync(CurrentUserId, id, cancellationToken);
        if (!result.IsSuccess)
        {
            return this.ToActionResult(result);
        }

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
        var result = await boardService.TransferOwnershipAsync(
            CurrentUserId,
            id,
            request.NewOwnerId,
            cancellationToken
        );
        if (!result.IsSuccess)
        {
            return this.ToActionResult(result);
        }

        return Ok(new { message = "Ownership transferred successfully." });
    }
}
