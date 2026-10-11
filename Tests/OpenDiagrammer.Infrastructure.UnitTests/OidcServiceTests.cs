using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using OpenDiagrammer.Core.Authentication;
using OpenDiagrammer.Infrastructure.Authentication;

namespace OpenDiagrammer.Infrastructure.UnitTests;

[TestClass]
public sealed class OidcServiceTests
{
    [TestMethod]
    public void GetConfiguration_ReturnsConfiguredOptions()
    {
        var options = new OidcOptions
        {
            Enabled = true,
            ProviderName = "Google",
            Authority = "https://accounts.google.com",
            ClientId = "test-client-id",
            Scope = "openid email profile",
        };

        var service = new OidcService(
            Options.Create(options),
            new HttpClient(),
            NullLogger<OidcService>.Instance
        );

        var config = service.GetConfiguration();

        Assert.IsTrue(config.Enabled);
        Assert.AreEqual("Google", config.ProviderName);
        Assert.AreEqual("https://accounts.google.com", config.Authority);
        Assert.AreEqual("test-client-id", config.ClientId);
    }

    [TestMethod]
    public async Task ValidateIdTokenAsync_WhenDisabled_ReturnsNull()
    {
        var options = new OidcOptions { Enabled = false };
        var service = new OidcService(
            Options.Create(options),
            new HttpClient(),
            NullLogger<OidcService>.Instance
        );

        var result = await service.ValidateIdTokenAsync("any-token");

        Assert.IsNull(result);
    }

    [TestMethod]
    public async Task ValidateIdTokenAsync_WithReadableJwt_ExtractsClaims()
    {
        var options = new OidcOptions { Enabled = true, ProviderName = "Keycloak" };

        var service = new OidcService(
            Options.Create(options),
            new HttpClient(),
            NullLogger<OidcService>.Instance
        );

        var handler = new JwtSecurityTokenHandler();
        var jwt = handler.WriteToken(
            new JwtSecurityToken(
                claims:
                [
                    new Claim(JwtRegisteredClaimNames.Sub, "external-12345"),
                    new Claim(JwtRegisteredClaimNames.Email, "extuser@example.com"),
                    new Claim("name", "External User"),
                ]
            )
        );

        var principal = await service.ValidateIdTokenAsync(jwt);

        Assert.IsNotNull(principal);
        Assert.AreEqual("external-12345", principal.SubjectId);
        Assert.AreEqual("extuser@example.com", principal.Email);
        Assert.AreEqual("External User", principal.Name);
        Assert.AreEqual("Keycloak", principal.Provider);
    }
}
