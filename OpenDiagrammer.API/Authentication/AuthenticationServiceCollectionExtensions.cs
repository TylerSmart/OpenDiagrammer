using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using OpenDiagrammer.Core.Authentication;
using OpenDiagrammer.Core.Interfaces;

namespace OpenDiagrammer.API.Authentication;

public static class AuthenticationServiceCollectionExtensions
{
    public const string LocalJwtScheme = JwtBearerDefaults.AuthenticationScheme;

    public static IServiceCollection AddOpenDiagrammerAuthentication(
        this IServiceCollection services,
        IConfiguration configuration
    )
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        services.AddHttpContextAccessor();
        services.AddScoped<IUserContext, HttpContextUserContext>();

        var jwtOptions =
            configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>() ?? new JwtOptions();
        var secretKey = string.IsNullOrWhiteSpace(jwtOptions.Secret)
            ? "OpenDiagrammer_Development_Super_Secret_Jwt_Key_2026!#*$"
            : jwtOptions.Secret;

        services
            .AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = LocalJwtScheme;
                options.DefaultChallengeScheme = LocalJwtScheme;
            })
            .AddJwtBearer(
                LocalJwtScheme,
                options =>
                {
                    options.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidateIssuer = true,
                        ValidIssuer = jwtOptions.Issuer,
                        ValidateAudience = true,
                        ValidAudience = jwtOptions.Audience,
                        ValidateIssuerSigningKey = true,
                        IssuerSigningKey = new SymmetricSecurityKey(
                            Encoding.UTF8.GetBytes(secretKey)
                        ),
                        ValidateLifetime = true,
                        ClockSkew = TimeSpan.FromMinutes(1),
                    };
                }
            );

        services.AddAuthorization();

        return services;
    }
}
