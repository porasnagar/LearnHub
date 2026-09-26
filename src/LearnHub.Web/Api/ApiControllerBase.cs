using System.Security.Claims;
using LearnHub.Web.Models;
using LearnHub.Web.Services;
using Microsoft.AspNetCore.Mvc;

namespace LearnHub.Web.Api;

[ApiController]
[Route("api/[controller]")]
public abstract class ApiControllerBase : ControllerBase
{
    protected bool IsSignedIn => User.Identity?.IsAuthenticated == true;
    protected int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    protected UserRole Role => Enum.Parse<UserRole>(User.FindFirstValue(ClaimTypes.Role)!);
    protected int? StudentId => IsSignedIn && Role == UserRole.Student ? UserId : null;

    protected bool CanManage(Course course) => IsSignedIn && LmsService.CanManage(course, UserId, Role);

    /// <summary>Business-rule failure → 400 with a message the client shows as a toast.</summary>
    protected ObjectResult Fail(string? message) => BadRequest(new ApiError(message ?? "The request could not be completed."));

    protected IActionResult FromResult(ServiceResult result) => result.Succeeded ? NoContent() : Fail(result.Error);

    protected static ClaimsPrincipal CreatePrincipal(AppUser user, string scheme) =>
        new(new ClaimsIdentity(
        [
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.FullName),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Role, user.Role.ToString())
        ], scheme));
}
