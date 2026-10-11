using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using OpenDiagrammer.API.Dtos;
using OpenDiagrammer.Core.Boards;

namespace OpenDiagrammer.API.IntegrationTests;

[TestClass]
public sealed class BoardIntegrationTests
{
    private OpenDiagrammerWebApplicationFactory _factory = null!;
    private HttpClient _client = null!;

    [TestInitialize]
    public void Setup()
    {
        _factory = new OpenDiagrammerWebApplicationFactory();
        _client = _factory.CreateClient();
    }

    [TestCleanup]
    public void Cleanup()
    {
        _client.Dispose();
        _factory.Dispose();
    }

    private async Task<AuthResponse> RegisterUserAsync(string username, string email)
    {
        var response = await _client.PostAsJsonAsync(
            "/api/auth/register",
            new RegisterRequest(email, username, "Password123!")
        );
        response.EnsureSuccessStatusCode();
        var auth = await response.Content.ReadFromJsonAsync<AuthResponse>();
        return auth!;
    }

    private void SetAuthToken(string token)
    {
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            token
        );
    }

    [TestMethod]
    public async Task CreateBoard_WithValidRequest_ReturnsCreated()
    {
        var user = await RegisterUserAsync("boardcreator", "creator@example.com");
        SetAuthToken(user.Token);

        var request = new CreateBoardRequest(
            Name: "Architecture Diagram",
            Description: "System architecture",
            BackgroundType: BoardBackgroundType.GridLines,
            BackgroundColor: "#ffffff",
            BackgroundOpacity: 0.8
        );

        var response = await _client.PostAsJsonAsync("/api/boards", request);

        Assert.AreEqual(HttpStatusCode.Created, response.StatusCode);

        var board = await response.Content.ReadFromJsonAsync<BoardDetailDto>();
        Assert.IsNotNull(board);
        Assert.AreEqual("Architecture Diagram", board.Name);
        Assert.AreEqual(user.Id, board.OwnerId);
        Assert.AreEqual(BoardRole.Owner, board.UserRole);
        Assert.AreEqual(1, board.Members.Count);
    }

    [TestMethod]
    public async Task GetBoards_ReturnsOnlyBoardsAccessibleToUser()
    {
        var user1 = await RegisterUserAsync("user1", "user1@example.com");
        var user2 = await RegisterUserAsync("user2", "user2@example.com");

        SetAuthToken(user1.Token);
        await _client.PostAsJsonAsync(
            "/api/boards",
            new CreateBoardRequest("Board 1", null, null, null, null)
        );

        SetAuthToken(user2.Token);
        await _client.PostAsJsonAsync(
            "/api/boards",
            new CreateBoardRequest("Board 2", null, null, null, null)
        );

        var response = await _client.GetAsync("/api/boards");
        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);

        var boards = await response.Content.ReadFromJsonAsync<List<BoardSummaryDto>>();
        Assert.IsNotNull(boards);
        Assert.AreEqual(1, boards.Count);
        Assert.AreEqual("Board 2", boards[0].Name);
    }

    [TestMethod]
    public async Task GetBoardById_WhenNotMember_ReturnsForbidden()
    {
        var user1 = await RegisterUserAsync("owner1", "owner1@example.com");
        var user2 = await RegisterUserAsync("outsider", "outsider@example.com");

        SetAuthToken(user1.Token);
        var createResponse = await _client.PostAsJsonAsync(
            "/api/boards",
            new CreateBoardRequest("Private Board", null, null, null, null)
        );
        var board = await createResponse.Content.ReadFromJsonAsync<BoardDetailDto>();
        Assert.IsNotNull(board);

        SetAuthToken(user2.Token);
        var getResponse = await _client.GetAsync($"/api/boards/{board.Id}");
        Assert.AreEqual(HttpStatusCode.Forbidden, getResponse.StatusCode);
    }

    [TestMethod]
    public async Task UpdateBoard_AndModePermissions_EnforceRoleRequirements()
    {
        var owner = await RegisterUserAsync("owner_mode", "owner_mode@example.com");
        var editor = await RegisterUserAsync("editor_mode", "editor_mode@example.com");

        SetAuthToken(owner.Token);
        var createRes = await _client.PostAsJsonAsync(
            "/api/boards",
            new CreateBoardRequest("Test Board", null, null, null, null)
        );
        var board = await createRes.Content.ReadFromJsonAsync<BoardDetailDto>();
        Assert.IsNotNull(board);

        // Add editor
        await _client.PostAsJsonAsync(
            $"/api/boards/{board.Id}/members",
            new AddBoardMemberRequest(editor.Email, BoardRole.Editor)
        );

        // Editor tries to change mode to ThinkMode -> Forbidden
        SetAuthToken(editor.Token);
        var editorUpdateRes = await _client.PutAsJsonAsync(
            $"/api/boards/{board.Id}",
            new UpdateBoardRequest(
                Name: "Updated Name",
                Description: "Updated Desc",
                BackgroundType: BoardBackgroundType.GridDots,
                BackgroundColor: "#000",
                BackgroundOpacity: 0.5,
                Mode: BoardMode.ThinkMode,
                ThinkModeConfigJson: null
            )
        );
        Assert.AreEqual(HttpStatusCode.Forbidden, editorUpdateRes.StatusCode);

        // Editor updates content without mode change -> OK
        var editorContentUpdate = await _client.PutAsJsonAsync(
            $"/api/boards/{board.Id}",
            new UpdateBoardRequest(
                Name: "Updated by Editor",
                Description: "Updated Desc",
                BackgroundType: BoardBackgroundType.GridDots,
                BackgroundColor: "#000",
                BackgroundOpacity: 0.5,
                Mode: BoardMode.Normal,
                ThinkModeConfigJson: null
            )
        );
        Assert.AreEqual(HttpStatusCode.OK, editorContentUpdate.StatusCode);

        // Owner changes mode to ThinkMode -> OK
        SetAuthToken(owner.Token);
        var ownerUpdateRes = await _client.PutAsJsonAsync(
            $"/api/boards/{board.Id}",
            new UpdateBoardRequest(
                Name: "Updated by Editor",
                Description: "Updated Desc",
                BackgroundType: BoardBackgroundType.GridDots,
                BackgroundColor: "#000",
                BackgroundOpacity: 0.5,
                Mode: BoardMode.ThinkMode,
                ThinkModeConfigJson: "{ \"timer\": 300 }"
            )
        );
        Assert.AreEqual(HttpStatusCode.OK, ownerUpdateRes.StatusCode);
    }

    [TestMethod]
    public async Task DeleteBoard_OwnerOnlyAllowed()
    {
        var owner = await RegisterUserAsync("owner_del", "owner_del@example.com");
        var member = await RegisterUserAsync("member_del", "member_del@example.com");

        SetAuthToken(owner.Token);
        var createRes = await _client.PostAsJsonAsync(
            "/api/boards",
            new CreateBoardRequest("Delete Me", null, null, null, null)
        );
        var board = await createRes.Content.ReadFromJsonAsync<BoardDetailDto>();
        Assert.IsNotNull(board);

        await _client.PostAsJsonAsync(
            $"/api/boards/{board.Id}/members",
            new AddBoardMemberRequest(member.Email, BoardRole.Admin)
        );

        // Member cannot delete even as Admin
        SetAuthToken(member.Token);
        var deleteFailRes = await _client.DeleteAsync($"/api/boards/{board.Id}");
        Assert.AreEqual(HttpStatusCode.Forbidden, deleteFailRes.StatusCode);

        // Owner deletes -> NoContent
        SetAuthToken(owner.Token);
        var deleteSuccessRes = await _client.DeleteAsync($"/api/boards/{board.Id}");
        Assert.AreEqual(HttpStatusCode.NoContent, deleteSuccessRes.StatusCode);

        var verifyRes = await _client.GetAsync($"/api/boards/{board.Id}");
        Assert.AreEqual(HttpStatusCode.NotFound, verifyRes.StatusCode);
    }

    [TestMethod]
    public async Task TransferOwnership_UpdatesOwnerAndMemberRoles()
    {
        var owner = await RegisterUserAsync("old_owner", "old_owner@example.com");
        var newOwner = await RegisterUserAsync("new_owner", "new_owner@example.com");

        SetAuthToken(owner.Token);
        var createRes = await _client.PostAsJsonAsync(
            "/api/boards",
            new CreateBoardRequest("Transfer Board", null, null, null, null)
        );
        var board = await createRes.Content.ReadFromJsonAsync<BoardDetailDto>();
        Assert.IsNotNull(board);

        var transferRes = await _client.PostAsJsonAsync(
            $"/api/boards/{board.Id}/transfer-ownership",
            new TransferOwnershipRequest(newOwner.Id)
        );
        Assert.AreEqual(HttpStatusCode.OK, transferRes.StatusCode);

        // Verify new owner is Owner, old owner is Admin
        SetAuthToken(newOwner.Token);
        var getRes = await _client.GetAsync($"/api/boards/{board.Id}");
        var updatedBoard = await getRes.Content.ReadFromJsonAsync<BoardDetailDto>();
        Assert.IsNotNull(updatedBoard);
        Assert.AreEqual(newOwner.Id, updatedBoard.OwnerId);
        Assert.AreEqual(BoardRole.Owner, updatedBoard.UserRole);

        SetAuthToken(owner.Token);
        var oldOwnerGetRes = await _client.GetAsync($"/api/boards/{board.Id}");
        var oldOwnerBoard = await oldOwnerGetRes.Content.ReadFromJsonAsync<BoardDetailDto>();
        Assert.IsNotNull(oldOwnerBoard);
        Assert.AreEqual(BoardRole.Admin, oldOwnerBoard.UserRole);
    }

    [TestMethod]
    public async Task BoardMembers_CrudFlow_AndAdminCannotAssignAdmin()
    {
        var owner = await RegisterUserAsync("bm_owner", "bm_owner@example.com");
        var admin = await RegisterUserAsync("bm_admin", "bm_admin@example.com");
        var editor = await RegisterUserAsync("bm_editor", "bm_editor@example.com");
        var thirdUser = await RegisterUserAsync("bm_third", "bm_third@example.com");

        SetAuthToken(owner.Token);
        var createRes = await _client.PostAsJsonAsync(
            "/api/boards",
            new CreateBoardRequest("Member Test Board", null, null, null, null)
        );
        var board = await createRes.Content.ReadFromJsonAsync<BoardDetailDto>();
        Assert.IsNotNull(board);

        // Owner adds admin
        var addAdminRes = await _client.PostAsJsonAsync(
            $"/api/boards/{board.Id}/members",
            new AddBoardMemberRequest(admin.Email, BoardRole.Admin)
        );
        Assert.AreEqual(HttpStatusCode.Created, addAdminRes.StatusCode);

        // Admin tries to add thirdUser as Admin -> Forbidden
        SetAuthToken(admin.Token);
        var adminAddAdminRes = await _client.PostAsJsonAsync(
            $"/api/boards/{board.Id}/members",
            new AddBoardMemberRequest(thirdUser.Email, BoardRole.Admin)
        );
        Assert.AreEqual(HttpStatusCode.Forbidden, adminAddAdminRes.StatusCode);

        // Admin adds editor -> Created
        var adminAddEditorRes = await _client.PostAsJsonAsync(
            $"/api/boards/{board.Id}/members",
            new AddBoardMemberRequest(editor.Email, BoardRole.Editor)
        );
        Assert.AreEqual(HttpStatusCode.Created, adminAddEditorRes.StatusCode);

        // Get members list
        var membersListRes = await _client.GetAsync($"/api/boards/{board.Id}/members");
        var members = await membersListRes.Content.ReadFromJsonAsync<List<BoardMemberDto>>();
        Assert.IsNotNull(members);
        Assert.AreEqual(3, members.Count); // Owner, Admin, Editor

        // Admin updates editor to Viewer -> OK
        var updateRoleRes = await _client.PutAsJsonAsync(
            $"/api/boards/{board.Id}/members/{editor.Id}",
            new UpdateBoardMemberRoleRequest(BoardRole.Viewer)
        );
        Assert.AreEqual(HttpStatusCode.OK, updateRoleRes.StatusCode);

        // Editor leaves board -> NoContent
        SetAuthToken(editor.Token);
        var leaveRes = await _client.DeleteAsync($"/api/boards/{board.Id}/members/{editor.Id}");
        Assert.AreEqual(HttpStatusCode.NoContent, leaveRes.StatusCode);

        // Verify members list is now 2
        SetAuthToken(owner.Token);
        var finalMembersRes = await _client.GetAsync($"/api/boards/{board.Id}/members");
        var finalMembers = await finalMembersRes.Content.ReadFromJsonAsync<List<BoardMemberDto>>();
        Assert.IsNotNull(finalMembers);
        Assert.AreEqual(2, finalMembers.Count);
    }
}
