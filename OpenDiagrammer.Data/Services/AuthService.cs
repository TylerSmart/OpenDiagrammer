using Microsoft.EntityFrameworkCore;
using OpenDiagrammer.Core.Authentication;
using OpenDiagrammer.Core.Services;
using OpenDiagrammer.Data.Entities;

namespace OpenDiagrammer.Data.Services;

public sealed class AuthService(
    OpenDiagrammerDbContext dbContext,
    IPasswordHasher passwordHasher,
    IJwtTokenService jwtTokenService,
    IOidcService oidcService
) : IAuthService
{
    public IReadOnlyList<AuthProviderDto> GetAuthProviders()
    {
        var providers = new List<AuthProviderDto>
        {
            new(Id: "local", Name: "Local Account", IsExternal: false),
        };

        var oidcConfig = oidcService.GetConfiguration();
        if (oidcConfig.Enabled)
        {
            providers.Add(
                new(
                    Id: "oidc",
                    Name: oidcConfig.ProviderName,
                    IsExternal: true,
                    OidcConfig: oidcConfig
                )
            );
        }

        return providers;
    }

    public async Task<ServiceResult<AuthResponse>> RegisterAsync(
        RegisterRequest request,
        CancellationToken cancellationToken = default
    )
    {
        var normalizedEmail = request.Email.Trim().ToUpperInvariant();
        var normalizedUsername = request.Username.Trim().ToUpperInvariant();

        var emailExists = await dbContext.Users.AnyAsync(
            u => u.NormalizedEmail == normalizedEmail,
            cancellationToken
        );
        if (emailExists)
        {
            return ServiceResult<AuthResponse>.Conflict(
                "An account with this email address already exists.",
                "Email already registered"
            );
        }

        var usernameExists = await dbContext.Users.AnyAsync(
            u => u.NormalizedUsername == normalizedUsername,
            cancellationToken
        );
        if (usernameExists)
        {
            return ServiceResult<AuthResponse>.Conflict(
                "The specified username is already in use.",
                "Username taken"
            );
        }

        var passwordHash = passwordHasher.HashPassword(request.Password);
        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = request.Email.Trim(),
            NormalizedEmail = normalizedEmail,
            Username = request.Username.Trim(),
            NormalizedUsername = normalizedUsername,
            PasswordHash = passwordHash,
            CreatedAt = DateTimeOffset.UtcNow,
            CreatedBy = "System",
            ModifiedAt = DateTimeOffset.UtcNow,
            ModifiedBy = "System",
        };

        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync(cancellationToken);

        var userSummary = new UserSummary(user.Id, user.Email, user.Username);
        var token = jwtTokenService.GenerateToken(userSummary);

        return ServiceResult<AuthResponse>.Success(
            new AuthResponse(
                Token: token,
                Id: user.Id,
                Email: user.Email,
                Username: user.Username,
                ExpiresAt: DateTimeOffset.UtcNow.AddHours(24)
            )
        );
    }

    public async Task<ServiceResult<AuthResponse>> LoginAsync(
        LoginRequest request,
        CancellationToken cancellationToken = default
    )
    {
        var normalizedEmail = request.Email.Trim().ToUpperInvariant();

        var user = await dbContext.Users.FirstOrDefaultAsync(
            u => u.NormalizedEmail == normalizedEmail,
            cancellationToken
        );

        if (
            user is null
            || string.IsNullOrEmpty(user.PasswordHash)
            || !passwordHasher.VerifyPassword(request.Password, user.PasswordHash)
        )
        {
            return ServiceResult<AuthResponse>.Unauthorized(
                "The provided email or password is incorrect.",
                "Invalid credentials"
            );
        }

        var userSummary = new UserSummary(user.Id, user.Email, user.Username);
        var token = jwtTokenService.GenerateToken(userSummary);

        return ServiceResult<AuthResponse>.Success(
            new AuthResponse(
                Token: token,
                Id: user.Id,
                Email: user.Email,
                Username: user.Username,
                ExpiresAt: DateTimeOffset.UtcNow.AddHours(24)
            )
        );
    }

    public async Task<ServiceResult<CurrentUserDto>> GetCurrentUserAsync(
        Guid userId,
        CancellationToken cancellationToken = default
    )
    {
        var user = await dbContext
            .Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        if (user is null)
        {
            return ServiceResult<CurrentUserDto>.NotFound(
                "The authenticated user could not be found.",
                "User not found"
            );
        }

        return ServiceResult<CurrentUserDto>.Success(
            new CurrentUserDto(user.Id, user.Email, user.Username)
        );
    }

    public async Task<ServiceResult<AuthResponse>> ExternalCallbackAsync(
        ExternalAuthRequest request,
        CancellationToken cancellationToken = default
    )
    {
        ExternalUserPrincipal? principal = null;

        if (!string.IsNullOrWhiteSpace(request.IdToken))
        {
            principal = await oidcService.ValidateIdTokenAsync(request.IdToken, cancellationToken);
        }
        else if (!string.IsNullOrWhiteSpace(request.Code))
        {
            principal = await oidcService.ExchangeCodeAsync(
                request.Code,
                request.RedirectUri ?? string.Empty,
                cancellationToken
            );
        }

        if (principal is null)
        {
            return ServiceResult<AuthResponse>.Unauthorized(
                "Could not validate credentials with the external provider.",
                "External authentication failed"
            );
        }

        var normalizedEmail = principal.Email.Trim().ToUpperInvariant();

        // 1. Find by external subject
        var user = await dbContext.Users.FirstOrDefaultAsync(
            u =>
                u.ExternalProvider == principal.Provider
                && u.ExternalSubjectId == principal.SubjectId,
            cancellationToken
        );

        // 2. If not found by external subject, find by email to link account
        if (user is null)
        {
            user = await dbContext.Users.FirstOrDefaultAsync(
                u => u.NormalizedEmail == normalizedEmail,
                cancellationToken
            );

            if (user is not null)
            {
                user.ExternalProvider = principal.Provider;
                user.ExternalSubjectId = principal.SubjectId;
                await dbContext.SaveChangesAsync(cancellationToken);
            }
        }

        // 3. If still not found, create new user
        if (user is null)
        {
            var baseUsername = !string.IsNullOrWhiteSpace(principal.Name)
                ? principal.Name.Trim()
                : principal.Email.Split('@')[0];

            var username = baseUsername;
            var suffix = 1;
            while (
                await dbContext.Users.AnyAsync(
                    u => u.NormalizedUsername == username.ToUpperInvariant(),
                    cancellationToken
                )
            )
            {
                username = $"{baseUsername}{suffix++}";
            }

            user = new User
            {
                Id = Guid.NewGuid(),
                Email = principal.Email.Trim(),
                NormalizedEmail = normalizedEmail,
                Username = username,
                NormalizedUsername = username.ToUpperInvariant(),
                ExternalProvider = principal.Provider,
                ExternalSubjectId = principal.SubjectId,
                PasswordHash = string.Empty,
                CreatedAt = DateTimeOffset.UtcNow,
                CreatedBy = principal.Provider,
                ModifiedAt = DateTimeOffset.UtcNow,
                ModifiedBy = principal.Provider,
            };

            dbContext.Users.Add(user);
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        var userSummary = new UserSummary(user.Id, user.Email, user.Username);
        var token = jwtTokenService.GenerateToken(userSummary);

        return ServiceResult<AuthResponse>.Success(
            new AuthResponse(
                Token: token,
                Id: user.Id,
                Email: user.Email,
                Username: user.Username,
                ExpiresAt: DateTimeOffset.UtcNow.AddHours(24)
            )
        );
    }
}
