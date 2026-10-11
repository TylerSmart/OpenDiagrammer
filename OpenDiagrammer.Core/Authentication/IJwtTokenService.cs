using System.Security.Claims;

namespace OpenDiagrammer.Core.Authentication;

public interface IJwtTokenService
{
    string GenerateToken(UserSummary user);

    ClaimsPrincipal? ValidateToken(string token);
}
