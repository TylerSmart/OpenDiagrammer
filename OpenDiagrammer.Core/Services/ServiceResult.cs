namespace OpenDiagrammer.Core.Services;

public enum ServiceResultStatus
{
    Success,
    NotFound,
    Forbidden,
    Unauthorized,
    Conflict,
    BadRequest,
}

public sealed record ServiceResult<T>(
    ServiceResultStatus Status,
    T? Value = default,
    string? ErrorTitle = null,
    string? ErrorDetail = null
)
{
    public bool IsSuccess => Status == ServiceResultStatus.Success;

    public static ServiceResult<T> Success(T value) =>
        new(ServiceResultStatus.Success, Value: value);

    public static ServiceResult<T> NotFound(
        string detail = "Not found",
        string title = "Not Found"
    ) => new(ServiceResultStatus.NotFound, ErrorTitle: title, ErrorDetail: detail);

    public static ServiceResult<T> Forbidden(
        string detail = "Forbidden",
        string title = "Forbidden"
    ) => new(ServiceResultStatus.Forbidden, ErrorTitle: title, ErrorDetail: detail);

    public static ServiceResult<T> Unauthorized(
        string detail = "Unauthorized",
        string title = "Unauthorized"
    ) => new(ServiceResultStatus.Unauthorized, ErrorTitle: title, ErrorDetail: detail);

    public static ServiceResult<T> Conflict(string detail, string title = "Conflict") =>
        new(ServiceResultStatus.Conflict, ErrorTitle: title, ErrorDetail: detail);

    public static ServiceResult<T> BadRequest(string detail, string title = "Bad Request") =>
        new(ServiceResultStatus.BadRequest, ErrorTitle: title, ErrorDetail: detail);
}

public sealed record ServiceResult(
    ServiceResultStatus Status,
    string? ErrorTitle = null,
    string? ErrorDetail = null
)
{
    public bool IsSuccess => Status == ServiceResultStatus.Success;

    public static ServiceResult Success() => new(ServiceResultStatus.Success);

    public static ServiceResult NotFound(string detail = "Not found", string title = "Not Found") =>
        new(ServiceResultStatus.NotFound, ErrorTitle: title, ErrorDetail: detail);

    public static ServiceResult Forbidden(
        string detail = "Forbidden",
        string title = "Forbidden"
    ) => new(ServiceResultStatus.Forbidden, ErrorTitle: title, ErrorDetail: detail);

    public static ServiceResult Unauthorized(
        string detail = "Unauthorized",
        string title = "Unauthorized"
    ) => new(ServiceResultStatus.Unauthorized, ErrorTitle: title, ErrorDetail: detail);

    public static ServiceResult Conflict(string detail, string title = "Conflict") =>
        new(ServiceResultStatus.Conflict, ErrorTitle: title, ErrorDetail: detail);

    public static ServiceResult BadRequest(string detail, string title = "Bad Request") =>
        new(ServiceResultStatus.BadRequest, ErrorTitle: title, ErrorDetail: detail);
}
