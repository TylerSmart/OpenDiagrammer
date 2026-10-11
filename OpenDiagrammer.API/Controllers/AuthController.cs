using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenDiagrammer.API.Dtos;
using OpenDiagrammer.Core.Authentication;
using OpenDiagrammer.Data;
using OpenDiagrammer.Data.Entities;

namespace OpenDiagrammer.API.Controllers;

[ApiController]
[Route("auth")]
public sealed class AuthController(
    OpenDiagrammerDbContext dbContext,
    IPasswordHasher passwordHasher,
    IJwtTokenService jwtTokenService
) : ControllerBase
{
    [HttpPost("register")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Register(
        [FromBody] RegisterRequest request,
        CancellationToken cancellationToken
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
            return Conflict(
                new ProblemDetails
                {
                    Status = StatusCodes.Status409Conflict,
                    Title = "Email already registered",
                    Detail = "An account with this email address already exists.",
                }
            );
        }

        var usernameExists = await dbContext.Users.AnyAsync(
            u => u.NormalizedUsername == normalizedUsername,
            cancellationToken
        );
        if (usernameExists)
        {
            return Conflict(
                new ProblemDetails
                {
                    Status = StatusCodes.Status409Conflict,
                    Title = "Username taken",
                    Detail = "The specified username is already in use.",
                }
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

        return Ok(
            new AuthResponse(
                Token: token,
                Id: user.Id,
                Email: user.Email,
                Username: user.Username,
                ExpiresAt: DateTimeOffset.UtcNow.AddHours(24)
            )
        );
    }

    [HttpPost("login")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Login(
        [FromBody] LoginRequest request,
        CancellationToken cancellationToken
    )
    {
        var normalizedEmail = request.Email.Trim().ToUpperInvariant();

        var user = await dbContext.Users.FirstOrDefaultAsync(
            u => u.NormalizedEmail == normalizedEmail,
            cancellationToken
        );

        if (user is null || !passwordHasher.VerifyPassword(request.Password, user.PasswordHash))
        {
            return Unauthorized(
                new ProblemDetails
                {
                    Status = StatusCodes.Status401Unauthorized,
                    Title = "Invalid credentials",
                    Detail = "The provided email or password is incorrect.",
                }
            );
        }

        var userSummary = new UserSummary(user.Id, user.Email, user.Username);
        var token = jwtTokenService.GenerateToken(userSummary);

        return Ok(
            new AuthResponse(
                Token: token,
                Id: user.Id,
                Email: user.Email,
                Username: user.Username,
                ExpiresAt: DateTimeOffset.UtcNow.AddHours(24)
            )
        );
    }

    [HttpGet("me")]
    [Authorize]
    [ProducesResponseType(typeof(CurrentUserDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetCurrentUser(CancellationToken cancellationToken)
    {
        var userIdStr =
            User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;

        if (!Guid.TryParse(userIdStr, out var userId))
        {
            return Unauthorized();
        }

        var user = await dbContext
            .Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        if (user is null)
        {
            return NotFound(
                new ProblemDetails
                {
                    Status = StatusCodes.Status404NotFound,
                    Title = "User not found",
                    Detail = "The authenticated user could not be found.",
                }
            );
        }

        return Ok(new CurrentUserDto(user.Id, user.Email, user.Username));
    }
}
