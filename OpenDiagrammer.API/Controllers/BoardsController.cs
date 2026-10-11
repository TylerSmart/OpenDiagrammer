using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenDiagrammer.Core.Boards;
using OpenDiagrammer.Core.Exceptions;

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
        try
        {
            var board = await boardService.GetBoardByIdAsync(CurrentUserId, id, cancellationToken);
            return board is not null ? Ok(board) : NotFound();
        }
        catch (ForbiddenException)
        {
            return Forbid();
        }
    }

    [HttpPost]
    [ProducesResponseType(typeof(BoardDetailDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateBoard(
        [FromBody] CreateBoardRequest request,
        CancellationToken cancellationToken
    )
    {
        var board = await boardService.CreateBoardAsync(CurrentUserId, request, cancellationToken);
        return CreatedAtAction(nameof(GetBoardById), new { id = board.Id }, board);
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
        try
        {
            var board = await boardService.UpdateBoardAsync(
                CurrentUserId,
                id,
                request,
                cancellationToken
            );
            return board is not null ? Ok(board) : NotFound();
        }
        catch (ForbiddenException)
        {
            return Forbid();
        }
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> DeleteBoard(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var deleted = await boardService.DeleteBoardAsync(CurrentUserId, id, cancellationToken);
            return deleted ? NoContent() : NotFound();
        }
        catch (ForbiddenException)
        {
            return Forbid();
        }
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
        try
        {
            if (request.NewOwnerId == CurrentUserId)
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

            var success = await boardService.TransferOwnershipAsync(
                CurrentUserId,
                id,
                request.NewOwnerId,
                cancellationToken
            );
            return success
                ? Ok(new { message = "Ownership transferred successfully." })
                : NotFound();
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
                    Title = "User not found",
                    Detail = ex.Message,
                }
            );
        }
    }
}
