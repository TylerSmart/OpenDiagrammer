using Microsoft.Extensions.DependencyInjection;
using OpenDiagrammer.Core.Authentication;

namespace OpenDiagrammer.Core;

public static class CoreServiceCollectionExtensions
{
    public static IServiceCollection AddCoreServices(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        services.AddSingleton<IPasswordHasher, PasswordHasher>();

        return services;
    }
}
