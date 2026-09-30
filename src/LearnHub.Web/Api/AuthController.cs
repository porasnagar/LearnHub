using LearnHub.Web.Data;
using LearnHub.Web.Models;
using LearnHub.Web.Services;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LearnHub.Web.Api;

public class AuthController(LmsService lms, LmsDbContext db, IAntiforgery antiforgery) : ApiControllerBase
{
    /// <summary>The signed-in user, or 204 when signed out. Also issues the XSRF cookie Angular sends back.</summary>
    [HttpGet("me")]
    public async Task<ActionResult<UserDto?>> Me()
    {
        if (!IsSignedIn) return NoContent();
        var user = await db.Users.FindAsync(UserId);
        return user is null ? NoContent() : UserDto.From(user);
    }

    [HttpPost("login")]
    public async Task<ActionResult<UserDto>> Login(LoginRequest request)
    {
        var user = await lms.AuthenticateAsync(request.Email, request.Password);
        if (user is null) return Fail("Invalid email or password.");
        await SignInAsync(user, request.RememberMe);
        return UserDto.From(user);
    }

    [HttpPost("register")]
    public async Task<ActionResult<UserDto>> Register(RegisterRequest request)
    {
        var result = await lms.RegisterAsync(request.FullName, request.Email, request.Password, request.Role);
        if (!result.Succeeded) return Fail(result.Error);
        await SignInAsync(result.Value!, persistent: false);
        return UserDto.From(result.Value!);
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        HttpContext.User = new();
        XsrfCookie.Issue(HttpContext, antiforgery);
        return NoContent();
    }

    [Authorize, HttpGet("profile")]
    public async Task<ProfileDto> Profile()
    {
        var user = await db.Users.SingleAsync(u => u.Id == UserId);
        var courses = user.Role == UserRole.Student
            ? await db.Enrollments.CountAsync(e => e.StudentId == user.Id)
            : await db.Courses.CountAsync(c => c.InstructorId == user.Id);
        return new ProfileDto(UserDto.From(user), courses, await db.Submissions.CountAsync(s => s.StudentId == user.Id));
    }

    [Authorize, HttpPost("password")]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest request) =>
        FromResult(await lms.ChangePasswordAsync(UserId, request.CurrentPassword, request.NewPassword));

    private async Task SignInAsync(AppUser user, bool persistent)
    {
        var principal = CreatePrincipal(user, CookieAuthenticationDefaults.AuthenticationScheme);
        await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, principal,
            new AuthenticationProperties { IsPersistent = persistent });
        // Anti-forgery tokens are bound to the user, so issue a fresh one for the new identity.
        HttpContext.User = principal;
        XsrfCookie.Issue(HttpContext, antiforgery);
    }
}

/// <summary>
/// Angular's HttpClient reads the "XSRF-TOKEN" cookie and echoes it in the "X-XSRF-TOKEN" header
/// on POST/PUT/DELETE, which ASP.NET Core's anti-forgery filter validates.
/// </summary>
public static class XsrfCookie
{
    public const string CookieName = "XSRF-TOKEN";
    public const string HeaderName = "X-XSRF-TOKEN";

    public static void Issue(HttpContext context, IAntiforgery antiforgery)
    {
        try
        {
            var tokens = antiforgery.GetAndStoreTokens(context);
            if (!string.IsNullOrEmpty(tokens.RequestToken))
            {
                context.Response.Cookies.Append(CookieName, tokens.RequestToken,
                    new CookieOptions { HttpOnly = false, SameSite = SameSiteMode.Strict, Path = "/" });
            }
        }
        catch (Exception)
        {
            // If the incoming cookie was encrypted with an old/missing key from a previous deployment,
            // GetAndStoreTokens throws AntiforgeryValidationException / CryptographicException.
            // Strip the stale antiforgery cookie and generate a fresh token pair so GET requests never 500.
            try
            {
                var cookieHeader = context.Request.Headers.Cookie.ToString();
                if (!string.IsNullOrEmpty(cookieHeader))
                {
                    var cleaned = cookieHeader
                        .Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                        .Where(c => !c.StartsWith(".AspNetCore.Antiforgery", StringComparison.OrdinalIgnoreCase)
                                 && !c.StartsWith(CookieName, StringComparison.OrdinalIgnoreCase));
                    context.Request.Headers.Cookie = string.Join("; ", cleaned);
                }

                foreach (var key in context.Request.Cookies.Keys)
                {
                    if (key.StartsWith(".AspNetCore.Antiforgery", StringComparison.OrdinalIgnoreCase) || key == CookieName)
                    {
                        context.Response.Cookies.Delete(key);
                    }
                }

                var tokens = antiforgery.GetAndStoreTokens(context);
                if (!string.IsNullOrEmpty(tokens.RequestToken))
                {
                    context.Response.Cookies.Append(CookieName, tokens.RequestToken,
                        new CookieOptions { HttpOnly = false, SameSite = SameSiteMode.Strict, Path = "/" });
                }
            }
            catch
            {
                // Fallback: never let token issuing crash a request
            }
        }
    }
}
