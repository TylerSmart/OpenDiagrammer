using System.Collections.Concurrent;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using OpenDiagrammer.Core.Boards;
using OpenDiagrammer.Core.Exceptions;

namespace OpenDiagrammer.API.Hubs;

public interface IBoardClient
{
    Task UserJoined(UserPresenceDto user);
    Task UserLeft(Guid userId);
    Task ReceiveCrdtUpdate(byte[] update);
    Task ReceiveCursor(CanvasCursorDto cursor);
    Task ReceivePresenceUpdate(UserPresenceDto user);
}

[Authorize]
public sealed class BoardHub(IBoardService boardService, ICrdtMergeService crdtMergeService)
    : Hub<IBoardClient>
{
    // boardId -> (connectionId -> presence)
    private static readonly ConcurrentDictionary<
        Guid,
        ConcurrentDictionary<string, (Guid UserId, UserPresenceDto Presence)>
    > ActivePresences = new();

    // connectionId -> set of boardIds joined
    private static readonly ConcurrentDictionary<string, ConcurrentBag<Guid>> ConnectionBoards =
        new();

    private static readonly string[] PresenceColors =
    [
        "#E53935",
        "#8E24AA",
        "#3949AB",
        "#00897B",
        "#7CB342",
        "#FB8C00",
        "#6D4C41",
        "#039BE5",
        "#D81B60",
        "#5E35B1",
        "#00ACC1",
        "#43A047",
    ];

    private Guid CurrentUserId
    {
        get
        {
            var raw =
                Context.User?.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? Context.User?.FindFirstValue("sub");
            return Guid.TryParse(raw, out var id) ? id : Guid.Empty;
        }
    }

    private string CurrentUsername
    {
        get
        {
            return Context.User?.FindFirstValue(ClaimTypes.Name)
                ?? Context.User?.FindFirstValue("name")
                ?? Context.User?.FindFirstValue(ClaimTypes.Email)
                ?? "Anonymous";
        }
    }

    public async Task<BoardSyncInitDto> JoinBoard(Guid boardId)
    {
        var userId = CurrentUserId;
        var board = await boardService.GetBoardByIdAsync(
            userId,
            boardId,
            Context.ConnectionAborted
        );
        if (board is null)
        {
            throw new HubException("Board not found.");
        }

        var groupName = GetGroupName(boardId);
        await Groups.AddToGroupAsync(Context.ConnectionId, groupName);

        ConnectionBoards.AddOrUpdate(
            Context.ConnectionId,
            [boardId],
            (_, bag) =>
            {
                bag.Add(boardId);
                return bag;
            }
        );

        var color = GetDeterministicColor(userId);
        var presence = new UserPresenceDto(
            UserId: userId,
            Username: CurrentUsername,
            Color: color,
            Role: board.UserRole
        );

        var roomPresences = ActivePresences.GetOrAdd(boardId, _ => new());
        roomPresences[Context.ConnectionId] = (userId, presence);

        // Notify others in the board
        await Clients.OthersInGroup(groupName).UserJoined(presence);

        // Return initial state to caller
        var distinctPresences = roomPresences
            .Values.GroupBy(v => v.UserId)
            .Select(g => g.First().Presence)
            .ToList();

        return new BoardSyncInitDto(
            BoardId: boardId,
            UserRole: board.UserRole,
            CrdtState: board.CrdtState,
            Presences: distinctPresences
        );
    }

    public async Task LeaveBoard(Guid boardId)
    {
        var groupName = GetGroupName(boardId);
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);

        if (ActivePresences.TryGetValue(boardId, out var roomPresences))
        {
            if (roomPresences.TryRemove(Context.ConnectionId, out var removed))
            {
                // Only send UserLeft if user has no remaining connections in this room
                var stillPresent = roomPresences.Values.Any(v => v.UserId == removed.UserId);
                if (!stillPresent)
                {
                    await Clients.OthersInGroup(groupName).UserLeft(removed.UserId);
                }
            }
        }
    }

    public async Task SendCrdtUpdate(Guid boardId, byte[] update)
    {
        if (update is null || update.Length == 0)
        {
            return;
        }

        var userId = CurrentUserId;
        var groupName = GetGroupName(boardId);

        // Broadcast to other collaborators immediately for ultra-low latency
        await Clients.OthersInGroup(groupName).ReceiveCrdtUpdate(update);

        // Persist merged update in database
        try
        {
            var currentState = await boardService.GetCrdtStateAsync(
                userId,
                boardId,
                Context.ConnectionAborted
            );
            var mergedState = crdtMergeService.MergeUpdate(currentState, update);
            await boardService.UpdateCrdtStateAsync(
                userId,
                boardId,
                new UpdateCrdtStateRequest(mergedState),
                Context.ConnectionAborted
            );
        }
        catch (ForbiddenException)
        {
            throw new HubException("You do not have permission to edit this board.");
        }
    }

    public async Task SendCursor(Guid boardId, double x, double y)
    {
        var userId = CurrentUserId;
        var color = GetDeterministicColor(userId);
        var cursor = new CanvasCursorDto(
            UserId: userId,
            Username: CurrentUsername,
            Color: color,
            X: x,
            Y: y
        );

        var groupName = GetGroupName(boardId);
        await Clients.OthersInGroup(groupName).ReceiveCursor(cursor);
    }

    public async Task UpdatePresence(Guid boardId, bool isTyping, string? activeSelectionId = null)
    {
        var userId = CurrentUserId;
        var color = GetDeterministicColor(userId);

        if (
            ActivePresences.TryGetValue(boardId, out var roomPresences)
            && roomPresences.TryGetValue(Context.ConnectionId, out var entry)
        )
        {
            var updatedPresence = entry.Presence with
            {
                IsTyping = isTyping,
                ActiveSelectionId = activeSelectionId,
            };
            roomPresences[Context.ConnectionId] = (userId, updatedPresence);

            var groupName = GetGroupName(boardId);
            await Clients.OthersInGroup(groupName).ReceivePresenceUpdate(updatedPresence);
        }
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (ConnectionBoards.TryRemove(Context.ConnectionId, out var boards))
        {
            foreach (var boardId in boards.Distinct())
            {
                if (ActivePresences.TryGetValue(boardId, out var roomPresences))
                {
                    if (roomPresences.TryRemove(Context.ConnectionId, out var removed))
                    {
                        var stillPresent = roomPresences.Values.Any(v =>
                            v.UserId == removed.UserId
                        );
                        if (!stillPresent)
                        {
                            var groupName = GetGroupName(boardId);
                            await Clients.OthersInGroup(groupName).UserLeft(removed.UserId);
                        }
                    }
                }
            }
        }

        await base.OnDisconnectedAsync(exception);
    }

    private static string GetGroupName(Guid boardId) => $"board_{boardId}";

    private static string GetDeterministicColor(Guid userId)
    {
        var hash = Math.Abs(userId.GetHashCode());
        return PresenceColors[hash % PresenceColors.Length];
    }
}

public sealed record BoardSyncInitDto(
    Guid BoardId,
    BoardRole UserRole,
    byte[]? CrdtState,
    IReadOnlyList<UserPresenceDto> Presences
);
