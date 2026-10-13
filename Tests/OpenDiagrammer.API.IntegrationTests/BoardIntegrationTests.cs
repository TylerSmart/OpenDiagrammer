using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using OpenDiagrammer.API.Dtos;
using OpenDiagrammer.Core.Authentication;
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
        Assert.HasCount(1, board.Members);
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
        Assert.HasCount(1, boards);
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
        Assert.HasCount(3, members); // Owner, Admin, Editor

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
        Assert.HasCount(2, finalMembers);
    }

    [TestMethod]
    public async Task CreateBoard_WithEmptyName_ReturnsBadRequest()
    {
        var user = await RegisterUserAsync("bad_board_user", "bad_board@example.com");
        SetAuthToken(user.Token);

        var request = new CreateBoardRequest(
            Name: "",
            Description: null,
            BackgroundType: null,
            BackgroundColor: null,
            BackgroundOpacity: null
        );

        var response = await _client.PostAsJsonAsync("/api/boards", request);
        Assert.AreEqual(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [TestMethod]
    public async Task GetBoardById_WhenBoardDoesNotExist_ReturnsNotFound()
    {
        var user = await RegisterUserAsync("notfound_user", "notfound@example.com");
        SetAuthToken(user.Token);

        var response = await _client.GetAsync($"/api/boards/{Guid.NewGuid()}");
        Assert.AreEqual(HttpStatusCode.NotFound, response.StatusCode);
    }

    [TestMethod]
    public async Task UpdateBoard_WhenBoardDoesNotExist_ReturnsNotFound()
    {
        var user = await RegisterUserAsync("update_notfound_user", "up_nf@example.com");
        SetAuthToken(user.Token);

        var response = await _client.PutAsJsonAsync(
            $"/api/boards/{Guid.NewGuid()}",
            new UpdateBoardRequest(
                "Name",
                null,
                BoardBackgroundType.GridLines,
                null,
                1.0,
                BoardMode.Normal,
                null
            )
        );
        Assert.AreEqual(HttpStatusCode.NotFound, response.StatusCode);
    }

    [TestMethod]
    public async Task TransferOwnership_ToSelf_ReturnsBadRequest()
    {
        var user = await RegisterUserAsync("self_transfer", "self_tr@example.com");
        SetAuthToken(user.Token);

        var createRes = await _client.PostAsJsonAsync(
            "/api/boards",
            new CreateBoardRequest("Self Transfer Board", null, null, null, null)
        );
        var board = await createRes.Content.ReadFromJsonAsync<BoardDetailDto>();
        Assert.IsNotNull(board);

        var response = await _client.PostAsJsonAsync(
            $"/api/boards/{board.Id}/transfer-ownership",
            new TransferOwnershipRequest(user.Id)
        );
        Assert.AreEqual(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [TestMethod]
    public async Task TransferOwnership_ToNonExistentUser_ReturnsBadRequest()
    {
        var user = await RegisterUserAsync("nonexist_transfer", "nonexist_tr@example.com");
        SetAuthToken(user.Token);

        var createRes = await _client.PostAsJsonAsync(
            "/api/boards",
            new CreateBoardRequest("NonExistent Transfer Board", null, null, null, null)
        );
        var board = await createRes.Content.ReadFromJsonAsync<BoardDetailDto>();
        Assert.IsNotNull(board);

        var response = await _client.PostAsJsonAsync(
            $"/api/boards/{board.Id}/transfer-ownership",
            new TransferOwnershipRequest(Guid.NewGuid())
        );
        Assert.AreEqual(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [TestMethod]
    public async Task TransferOwnership_WhenNotOwner_ReturnsForbidden()
    {
        var owner = await RegisterUserAsync("tr_owner", "tr_owner@example.com");
        var admin = await RegisterUserAsync("tr_admin", "tr_admin@example.com");
        var third = await RegisterUserAsync("tr_third", "tr_third@example.com");

        SetAuthToken(owner.Token);
        var createRes = await _client.PostAsJsonAsync(
            "/api/boards",
            new CreateBoardRequest("Tr Board", null, null, null, null)
        );
        var board = await createRes.Content.ReadFromJsonAsync<BoardDetailDto>();
        Assert.IsNotNull(board);

        await _client.PostAsJsonAsync(
            $"/api/boards/{board.Id}/members",
            new AddBoardMemberRequest(admin.Email, BoardRole.Admin)
        );

        // Admin tries to transfer ownership -> Forbidden
        SetAuthToken(admin.Token);
        var response = await _client.PostAsJsonAsync(
            $"/api/boards/{board.Id}/transfer-ownership",
            new TransferOwnershipRequest(third.Id)
        );
        Assert.AreEqual(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [TestMethod]
    public async Task BoardMembers_AddMember_ByUsername_Succeeds()
    {
        var owner = await RegisterUserAsync("bm_by_un_owner", "bm_un_o@example.com");
        var target = await RegisterUserAsync("target_username", "target_un@example.com");

        SetAuthToken(owner.Token);
        var createRes = await _client.PostAsJsonAsync(
            "/api/boards",
            new CreateBoardRequest("Username Add Board", null, null, null, null)
        );
        var board = await createRes.Content.ReadFromJsonAsync<BoardDetailDto>();
        Assert.IsNotNull(board);

        var addRes = await _client.PostAsJsonAsync(
            $"/api/boards/{board.Id}/members",
            new AddBoardMemberRequest("target_username", BoardRole.Editor)
        );
        Assert.AreEqual(HttpStatusCode.Created, addRes.StatusCode);
    }

    [TestMethod]
    public async Task BoardMembers_AddMember_WhenUserNotFound_ReturnsNotFound()
    {
        var owner = await RegisterUserAsync("bm_nf_owner", "bm_nf_o@example.com");
        SetAuthToken(owner.Token);

        var createRes = await _client.PostAsJsonAsync(
            "/api/boards",
            new CreateBoardRequest("NF Board", null, null, null, null)
        );
        var board = await createRes.Content.ReadFromJsonAsync<BoardDetailDto>();
        Assert.IsNotNull(board);

        var addRes = await _client.PostAsJsonAsync(
            $"/api/boards/{board.Id}/members",
            new AddBoardMemberRequest("does_not_exist_user", BoardRole.Editor)
        );
        Assert.AreEqual(HttpStatusCode.NotFound, addRes.StatusCode);
    }

    [TestMethod]
    public async Task BoardMembers_AddMember_WhenAlreadyMember_ReturnsConflict()
    {
        var owner = await RegisterUserAsync("bm_dup_owner", "bm_dup_o@example.com");
        var target = await RegisterUserAsync("dup_target", "dup_target@example.com");

        SetAuthToken(owner.Token);
        var createRes = await _client.PostAsJsonAsync(
            "/api/boards",
            new CreateBoardRequest("Dup Board", null, null, null, null)
        );
        var board = await createRes.Content.ReadFromJsonAsync<BoardDetailDto>();
        Assert.IsNotNull(board);

        var addRes1 = await _client.PostAsJsonAsync(
            $"/api/boards/{board.Id}/members",
            new AddBoardMemberRequest(target.Email, BoardRole.Editor)
        );
        Assert.AreEqual(HttpStatusCode.Created, addRes1.StatusCode);

        var addRes2 = await _client.PostAsJsonAsync(
            $"/api/boards/{board.Id}/members",
            new AddBoardMemberRequest(target.Email, BoardRole.Editor)
        );
        Assert.AreEqual(HttpStatusCode.Conflict, addRes2.StatusCode);
    }

    [TestMethod]
    public async Task BoardMembers_UpdateRole_CannotModifyOwner_ReturnsBadRequest()
    {
        var owner = await RegisterUserAsync("mod_owner_o", "mod_o@example.com");
        SetAuthToken(owner.Token);

        var createRes = await _client.PostAsJsonAsync(
            "/api/boards",
            new CreateBoardRequest("Mod Owner Board", null, null, null, null)
        );
        var board = await createRes.Content.ReadFromJsonAsync<BoardDetailDto>();
        Assert.IsNotNull(board);

        var res = await _client.PutAsJsonAsync(
            $"/api/boards/{board.Id}/members/{owner.Id}",
            new UpdateBoardMemberRoleRequest(BoardRole.Admin)
        );
        Assert.AreEqual(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [TestMethod]
    public async Task BoardMembers_RemoveMember_CannotRemoveOwner_ReturnsBadRequest()
    {
        var owner = await RegisterUserAsync("rm_owner_o", "rm_o@example.com");
        SetAuthToken(owner.Token);

        var createRes = await _client.PostAsJsonAsync(
            "/api/boards",
            new CreateBoardRequest("RM Owner Board", null, null, null, null)
        );
        var board = await createRes.Content.ReadFromJsonAsync<BoardDetailDto>();
        Assert.IsNotNull(board);

        var res = await _client.DeleteAsync($"/api/boards/{board.Id}/members/{owner.Id}");
        Assert.AreEqual(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [TestMethod]
    public async Task BoardMembers_RemoveMember_AdminCannotRemoveAdmin_ReturnsForbidden()
    {
        var owner = await RegisterUserAsync("rm_ad_owner", "rm_ad_o@example.com");
        var admin1 = await RegisterUserAsync("rm_ad_1", "rm_ad_1@example.com");
        var admin2 = await RegisterUserAsync("rm_ad_2", "rm_ad_2@example.com");

        SetAuthToken(owner.Token);
        var createRes = await _client.PostAsJsonAsync(
            "/api/boards",
            new CreateBoardRequest("Admin Remove Board", null, null, null, null)
        );
        var board = await createRes.Content.ReadFromJsonAsync<BoardDetailDto>();
        Assert.IsNotNull(board);

        await _client.PostAsJsonAsync(
            $"/api/boards/{board.Id}/members",
            new AddBoardMemberRequest(admin1.Email, BoardRole.Admin)
        );
        await _client.PostAsJsonAsync(
            $"/api/boards/{board.Id}/members",
            new AddBoardMemberRequest(admin2.Email, BoardRole.Admin)
        );

        // Admin 1 attempts to remove Admin 2 -> Forbidden
        SetAuthToken(admin1.Token);
        var res = await _client.DeleteAsync($"/api/boards/{board.Id}/members/{admin2.Id}");
        Assert.AreEqual(HttpStatusCode.Forbidden, res.StatusCode);
    }

    [TestMethod]
    public async Task UpdateCanvasData_WhenOwnerOrEditor_PersistsCanvasDataAndReturnsOk()
    {
        var owner = await RegisterUserAsync("canvas_owner", "canvas_owner@example.com");
        var editor = await RegisterUserAsync("canvas_editor", "canvas_editor@example.com");

        SetAuthToken(owner.Token);
        var createRes = await _client.PostAsJsonAsync(
            "/api/boards",
            new CreateBoardRequest("Canvas Persistence Test Board", null, null, null, null)
        );
        var board = await createRes.Content.ReadFromJsonAsync<BoardDetailDto>();
        Assert.IsNotNull(board);
        Assert.IsNull(board.CanvasDataJson);

        await _client.PostAsJsonAsync(
            $"/api/boards/{board.Id}/members",
            new AddBoardMemberRequest(editor.Email, BoardRole.Editor)
        );

        // Editor updates canvas data
        SetAuthToken(editor.Token);
        const string testCanvasJson =
            "{\"shapes\":[{\"id\":\"s1\",\"type\":\"rectangle\",\"x\":50,\"y\":60}],\"connections\":[]}";
        var updateRes = await _client.PutAsJsonAsync(
            $"/api/boards/{board.Id}/canvas",
            new UpdateCanvasDataRequest(testCanvasJson)
        );
        Assert.AreEqual(HttpStatusCode.OK, updateRes.StatusCode);
        var updated = await updateRes.Content.ReadFromJsonAsync<BoardDetailDto>();
        Assert.IsNotNull(updated);
        Assert.AreEqual(testCanvasJson, updated.CanvasDataJson);

        // Fetch board again to confirm persistence in DB
        var getRes = await _client.GetAsync($"/api/boards/{board.Id}");
        Assert.AreEqual(HttpStatusCode.OK, getRes.StatusCode);
        var fetched = await getRes.Content.ReadFromJsonAsync<BoardDetailDto>();
        Assert.IsNotNull(fetched);
        Assert.AreEqual(testCanvasJson, fetched.CanvasDataJson);
    }

    [TestMethod]
    public async Task UpdateCanvasData_WhenViewer_ReturnsForbidden()
    {
        var owner = await RegisterUserAsync("canvas_v_owner", "canvas_v_owner@example.com");
        var viewer = await RegisterUserAsync("canvas_viewer", "canvas_viewer@example.com");

        SetAuthToken(owner.Token);
        var createRes = await _client.PostAsJsonAsync(
            "/api/boards",
            new CreateBoardRequest("Viewer Canvas Board", null, null, null, null)
        );
        var board = await createRes.Content.ReadFromJsonAsync<BoardDetailDto>();
        Assert.IsNotNull(board);

        await _client.PostAsJsonAsync(
            $"/api/boards/{board.Id}/members",
            new AddBoardMemberRequest(viewer.Email, BoardRole.Viewer)
        );

        // Viewer attempts to update canvas data -> Forbidden
        SetAuthToken(viewer.Token);
        var updateRes = await _client.PutAsJsonAsync(
            $"/api/boards/{board.Id}/canvas",
            new UpdateCanvasDataRequest("{\"shapes\":[]}")
        );
        Assert.AreEqual(HttpStatusCode.Forbidden, updateRes.StatusCode);
    }

    [TestMethod]
    public async Task UpdateCanvasData_NonExistentBoard_ReturnsNotFound()
    {
        var user = await RegisterUserAsync("canvas_404_user", "canvas_404@example.com");
        SetAuthToken(user.Token);

        var updateRes = await _client.PutAsJsonAsync(
            $"/api/boards/{Guid.NewGuid()}/canvas",
            new UpdateCanvasDataRequest("{\"shapes\":[]}")
        );
        Assert.AreEqual(HttpStatusCode.NotFound, updateRes.StatusCode);
    }
}
