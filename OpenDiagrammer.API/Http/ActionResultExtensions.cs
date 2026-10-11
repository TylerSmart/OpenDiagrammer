using Microsoft.AspNetCore.Mvc;
using OpenDiagrammer.Core.Services;

namespace OpenDiagrammer.API.Http;

public static class ActionResultExtensions
{
    public static IActionResult ToActionResult<T>(
        this ControllerBase controller,
        ServiceResult<T> result
    )
    {
        return result.Status switch
        {
            ServiceResultStatus.Success => controller.Ok(result.Value),
            ServiceResultStatus.NotFound => controller.NotFound(
                new ProblemDetails
                {
                    Status = StatusCodes.Status404NotFound,
                    Title = result.ErrorTitle ?? "Not Found",
                    Detail = result.ErrorDetail ?? "The requested resource could not be found.",
                }
            ),
            ServiceResultStatus.Forbidden => controller.Forbid(),
            ServiceResultStatus.Unauthorized => controller.Unauthorized(
                new ProblemDetails
                {
                    Status = StatusCodes.Status401Unauthorized,
                    Title = result.ErrorTitle ?? "Unauthorized",
                    Detail =
                        result.ErrorDetail ?? "Authentication is required to perform this action.",
                }
            ),
            ServiceResultStatus.Conflict => controller.Conflict(
                new ProblemDetails
                {
                    Status = StatusCodes.Status409Conflict,
                    Title = result.ErrorTitle ?? "Conflict",
                    Detail = result.ErrorDetail ?? "A conflict occurred with an existing resource.",
                }
            ),
            ServiceResultStatus.BadRequest => controller.BadRequest(
                new ProblemDetails
                {
                    Status = StatusCodes.Status400BadRequest,
                    Title = result.ErrorTitle ?? "Bad Request",
                    Detail = result.ErrorDetail ?? "The request was invalid.",
                }
            ),
            _ => controller.StatusCode(StatusCodes.Status500InternalServerError),
        };
    }

    public static IActionResult ToActionResult(this ControllerBase controller, ServiceResult result)
    {
        return result.Status switch
        {
            ServiceResultStatus.Success => controller.Ok(),
            ServiceResultStatus.NotFound => controller.NotFound(
                new ProblemDetails
                {
                    Status = StatusCodes.Status404NotFound,
                    Title = result.ErrorTitle ?? "Not Found",
                    Detail = result.ErrorDetail ?? "The requested resource could not be found.",
                }
            ),
            ServiceResultStatus.Forbidden => controller.Forbid(),
            ServiceResultStatus.Unauthorized => controller.Unauthorized(
                new ProblemDetails
                {
                    Status = StatusCodes.Status401Unauthorized,
                    Title = result.ErrorTitle ?? "Unauthorized",
                    Detail =
                        result.ErrorDetail ?? "Authentication is required to perform this action.",
                }
            ),
            ServiceResultStatus.Conflict => controller.Conflict(
                new ProblemDetails
                {
                    Status = StatusCodes.Status409Conflict,
                    Title = result.ErrorTitle ?? "Conflict",
                    Detail = result.ErrorDetail ?? "A conflict occurred with an existing resource.",
                }
            ),
            ServiceResultStatus.BadRequest => controller.BadRequest(
                new ProblemDetails
                {
                    Status = StatusCodes.Status400BadRequest,
                    Title = result.ErrorTitle ?? "Bad Request",
                    Detail = result.ErrorDetail ?? "The request was invalid.",
                }
            ),
            _ => controller.StatusCode(StatusCodes.Status500InternalServerError),
        };
    }
}
