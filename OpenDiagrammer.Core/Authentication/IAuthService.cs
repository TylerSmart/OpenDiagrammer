using OpenDiagrammer.Core.Services;

namespace OpenDiagrammer.Core.Authentication;

public interface IAuthService
{
    IReadOnlyList<AuthProviderDto> GetAuthProviders();

    Task<ServiceResult<AuthResponse>> RegisterAsync(
        RegisterRequest request,
        CancellationToken cancellationToken = default
    );

    Task<ServiceResult<AuthResponse>> LoginAsync(
        LoginRequest request,
        CancellationToken cancellationToken = default
    );

    Task<ServiceResult<CurrentUserDto>> GetCurrentUserAsync(
        Guid userId,
        CancellationToken cancellationToken = default
    );

    Task<ServiceResult<AuthResponse>> ExternalCallbackAsync(
        ExternalAuthRequest request,
        CancellationToken cancellationToken = default
    );
}
