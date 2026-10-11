using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace OpenDiagrammer.API.IntegrationTests;

public class OpenDiagrammerWebApplicationFactory : WebApplicationFactory<Program>
{
    private readonly string _databaseName = "TestDb_" + Guid.NewGuid();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("UseInMemoryDatabase", "true");
        builder.UseSetting("InMemoryDatabaseName", _databaseName);
        builder.UseSetting(
            "Authentication:Jwt:Secret",
            "Test_Secret_Key_For_OpenDiagrammer_Integration_Tests_12345!"
        );
        builder.UseSetting("Authentication:Jwt:Issuer", "OpenDiagrammer");
        builder.UseSetting("Authentication:Jwt:Audience", "OpenDiagrammer");
        builder.UseSetting("Authentication:Oidc:Enabled", "true");
        builder.UseSetting("Authentication:Oidc:ProviderName", "TestOIDC");
    }
}
