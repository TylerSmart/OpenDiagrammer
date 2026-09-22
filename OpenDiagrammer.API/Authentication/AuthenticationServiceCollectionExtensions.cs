using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using OpenDiagrammer.Core.Interfaces;

// TODO: Re-enable when Entra app registration and roles are configured.
// using Microsoft.AspNetCore.Authorization;

namespace OpenDiagrammer.API.Authentication;

public static class AuthenticationServiceCollectionExtensions
{
    public const string CombinedScheme = "OpenDiagrammerOrEntra";

    public static IServiceCollection AddOpenDiagrammerAuthentication(
        this IServiceCollection services,
        IConfiguration configuration
    )
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        services.AddHttpContextAccessor();

        services.AddScoped<IUserContext, HttpContextUserContext>();

        return services;
    }
}
