using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using OpenDiagrammer.Core.Authentication;

namespace OpenDiagrammer.Infrastructure.Authentication;

public sealed class OidcService(
    IOptions<OidcOptions> options,
    HttpClient httpClient,
    ILogger<OidcService> logger
) : IOidcService
{
    private readonly OidcOptions _options = options.Value;
    private readonly JwtSecurityTokenHandler _tokenHandler = new();

    public OidcConfigurationDto GetConfiguration()
    {
        var authEndpoint = _options.AuthorizationEndpoint;
        if (
            string.IsNullOrWhiteSpace(authEndpoint)
            && !string.IsNullOrWhiteSpace(_options.Authority)
        )
        {
            authEndpoint = $"{_options.Authority.TrimEnd('/')}/authorize";
        }

        return new OidcConfigurationDto(
            Enabled: _options.Enabled,
            ProviderName: _options.ProviderName,
            Authority: _options.Authority,
            ClientId: _options.ClientId,
            Scope: _options.Scope,
            AuthorizationEndpoint: authEndpoint
        );
    }

    public Task<ExternalUserPrincipal?> ValidateIdTokenAsync(
        string idToken,
        CancellationToken cancellationToken = default
    )
    {
        if (string.IsNullOrWhiteSpace(idToken) || !_options.Enabled)
        {
            return Task.FromResult<ExternalUserPrincipal?>(null);
        }

        try
        {
            if (!_tokenHandler.CanReadToken(idToken))
            {
                logger.LogWarning("Provided ID token is not a readable JWT.");
                return Task.FromResult<ExternalUserPrincipal?>(null);
            }

            var jwt = _tokenHandler.ReadJwtToken(idToken);

            var sub = jwt
                .Claims.FirstOrDefault(c =>
                    c.Type == JwtRegisteredClaimNames.Sub || c.Type == ClaimTypes.NameIdentifier
                )
                ?.Value;
            var email = jwt
                .Claims.FirstOrDefault(c =>
                    c.Type == JwtRegisteredClaimNames.Email || c.Type == ClaimTypes.Email
                )
                ?.Value;
            var name = jwt
                .Claims.FirstOrDefault(c =>
                    c.Type == "name" || c.Type == ClaimTypes.Name || c.Type == "preferred_username"
                )
                ?.Value;

            if (string.IsNullOrWhiteSpace(sub) || string.IsNullOrWhiteSpace(email))
            {
                logger.LogWarning("ID token missing required subject or email claims.");
                return Task.FromResult<ExternalUserPrincipal?>(null);
            }

            return Task.FromResult<ExternalUserPrincipal?>(
                new ExternalUserPrincipal(sub, email, name, _options.ProviderName)
            );
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to validate external ID token.");
            return Task.FromResult<ExternalUserPrincipal?>(null);
        }
    }

    public async Task<ExternalUserPrincipal?> ExchangeCodeAsync(
        string code,
        string redirectUri,
        CancellationToken cancellationToken = default
    )
    {
        if (string.IsNullOrWhiteSpace(code) || !_options.Enabled)
        {
            return null;
        }

        var tokenEndpoint = _options.TokenEndpoint;
        if (
            string.IsNullOrWhiteSpace(tokenEndpoint)
            && !string.IsNullOrWhiteSpace(_options.Authority)
        )
        {
            tokenEndpoint = $"{_options.Authority.TrimEnd('/')}/token";
        }

        if (string.IsNullOrWhiteSpace(tokenEndpoint))
        {
            logger.LogWarning("No token endpoint configured for OIDC code exchange.");
            return null;
        }

        try
        {
            var parameters = new Dictionary<string, string>
            {
                ["grant_type"] = "authorization_code",
                ["code"] = code,
                ["redirect_uri"] = redirectUri,
                ["client_id"] = _options.ClientId,
            };

            if (!string.IsNullOrWhiteSpace(_options.ClientSecret))
            {
                parameters["client_secret"] = _options.ClientSecret;
            }

            using var request = new HttpRequestMessage(HttpMethod.Post, tokenEndpoint)
            {
                Content = new FormUrlEncodedContent(parameters),
            };

            var response = await httpClient.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync(cancellationToken);
                logger.LogWarning(
                    "OIDC token exchange failed: {StatusCode} {Error}",
                    response.StatusCode,
                    error
                );
                return null;
            }

            var tokenResponse = await response.Content.ReadFromJsonAsync<JsonElement>(
                cancellationToken: cancellationToken
            );
            if (tokenResponse.TryGetProperty("id_token", out var idTokenProp))
            {
                var idToken = idTokenProp.GetString();
                if (!string.IsNullOrWhiteSpace(idToken))
                {
                    return await ValidateIdTokenAsync(idToken, cancellationToken);
                }
            }

            return null;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Exception during OIDC code exchange.");
            return null;
        }
    }
}
