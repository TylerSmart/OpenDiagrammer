using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using OpenDiagrammer.API.Dtos;

namespace OpenDiagrammer.API.IntegrationTests;

[TestClass]
public sealed class AuthIntegrationTests
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

    [TestMethod]
    public async Task Register_WithValidData_ReturnsOkAndToken()
    {
        var request = new RegisterRequest("alice@example.com", "alice", "Password123!");

        var response = await _client.PostAsJsonAsync("/api/auth/register", request);

        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);

        var authResponse = await response.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.IsNotNull(authResponse);
        Assert.IsFalse(string.IsNullOrWhiteSpace(authResponse.Token));
        Assert.AreEqual(request.Email, authResponse.Email);
        Assert.AreEqual(request.Username, authResponse.Username);
    }

    [TestMethod]
    public async Task Register_WithDuplicateEmail_ReturnsConflict()
    {
        var request1 = new RegisterRequest("dup@example.com", "user1", "Password123!");
        var request2 = new RegisterRequest("dup@example.com", "user2", "Password123!");

        var first = await _client.PostAsJsonAsync("/api/auth/register", request1);
        Assert.AreEqual(HttpStatusCode.OK, first.StatusCode);

        var second = await _client.PostAsJsonAsync("/api/auth/register", request2);
        Assert.AreEqual(HttpStatusCode.Conflict, second.StatusCode);
    }

    [TestMethod]
    public async Task Login_WithValidCredentials_ReturnsOkAndToken()
    {
        var register = new RegisterRequest("login@example.com", "loginuser", "Password123!");
        await _client.PostAsJsonAsync("/api/auth/register", register);

        var login = new LoginRequest("login@example.com", "Password123!");
        var response = await _client.PostAsJsonAsync("/api/auth/login", login);

        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);

        var authResponse = await response.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.IsNotNull(authResponse);
        Assert.IsFalse(string.IsNullOrWhiteSpace(authResponse.Token));
    }

    [TestMethod]
    public async Task Login_WithInvalidPassword_ReturnsUnauthorized()
    {
        var register = new RegisterRequest("badpass@example.com", "badpassuser", "Password123!");
        await _client.PostAsJsonAsync("/api/auth/register", register);

        var login = new LoginRequest("badpass@example.com", "WrongPassword!");
        var response = await _client.PostAsJsonAsync("/api/auth/login", login);

        Assert.AreEqual(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [TestMethod]
    public async Task GetCurrentUser_WhenAuthenticated_ReturnsUserInfo()
    {
        var register = new RegisterRequest("me@example.com", "meuser", "Password123!");
        var regResponse = await _client.PostAsJsonAsync("/api/auth/register", register);
        var auth = await regResponse.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.IsNotNull(auth);

        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            auth.Token
        );

        var meResponse = await _client.GetAsync("/api/auth/me");
        Assert.AreEqual(HttpStatusCode.OK, meResponse.StatusCode);

        var user = await meResponse.Content.ReadFromJsonAsync<CurrentUserDto>();
        Assert.IsNotNull(user);
        Assert.AreEqual("me@example.com", user.Email);
        Assert.AreEqual("meuser", user.Username);
    }

    [TestMethod]
    public async Task GetCurrentUser_WhenUnauthenticated_ReturnsUnauthorized()
    {
        var response = await _client.GetAsync("/api/auth/me");
        Assert.AreEqual(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
