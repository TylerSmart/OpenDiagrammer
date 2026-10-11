using System.Net;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace OpenDiagrammer.API.IntegrationTests;

[TestClass]
public sealed class OpenApiIntegrationTests
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
    public async Task GetOpenApiDocument_ReturnsValidJson()
    {
        var response = await _client.GetAsync("/api/openapi/v1.json");

        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);

        var content = await response.Content.ReadAsStringAsync();
        Assert.IsFalse(string.IsNullOrWhiteSpace(content));
        StringAssert.Contains(content, "OpenDiagrammer");
        StringAssert.Contains(content, "/boards");
        StringAssert.Contains(content, "/auth");
        StringAssert.Contains(content, "securitySchemes");
        StringAssert.Contains(content, "Bearer");
    }
}
