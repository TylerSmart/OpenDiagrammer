using OpenDiagrammer.Core.Interfaces;

namespace OpenDiagrammer.API.Authentication;

public sealed class HttpContextUserContext(IHttpContextAccessor httpContextAccessor) : IUserContext
{
    public string UserId
    {
        get { throw new NotImplementedException(); }
    }
}
