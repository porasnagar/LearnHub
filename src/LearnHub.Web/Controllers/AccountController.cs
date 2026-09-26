using LearnHub.Web.Data;
using LearnHub.Web.Infrastructure;
using LearnHub.Web.Models;
using LearnHub.Web.Services;
using LearnHub.Web.ViewModels;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LearnHub.Web.Controllers;

public class AccountController(LmsService lms, LmsDbContext db) : Controller
{
    [HttpGet]
    public IActionResult Login(string? returnUrl = null)
    {
        if (User.Identity?.IsAuthenticated == true) return RedirectToAction("Index", "Dashboard");
        return View(new LoginViewModel { ReturnUrl = returnUrl });
    }

    [HttpPost]
    public async Task<IActionResult> Login(LoginViewModel model)
    {
        if (!ModelState.IsValid) return View(model);

        var user = await lms.AuthenticateAsync(model.Email, model.Password);
        if (user is null)
        {
            ModelState.AddModelError(string.Empty, "Invalid email or password.");
            return View(model);
        }

        await SignInAsync(user, model.RememberMe);
        if (!string.IsNullOrEmpty(model.ReturnUrl) && Url.IsLocalUrl(model.ReturnUrl))
            return LocalRedirect(model.ReturnUrl);
        return RedirectToAction("Index", "Dashboard");
    }

    [HttpGet]
    public IActionResult Register()
    {
        if (User.Identity?.IsAuthenticated == true) return RedirectToAction("Index", "Dashboard");
        return View(new RegisterViewModel());
    }

    [HttpPost]
    public async Task<IActionResult> Register(RegisterViewModel model)
    {
        if (!ModelState.IsValid) return View(model);

        var result = await lms.RegisterAsync(model.FullName, model.Email, model.Password, model.Role);
        if (!result.Succeeded)
        {
            ModelState.AddModelError(string.Empty, result.Error!);
            return View(model);
        }

        await SignInAsync(result.Value!, persistent: false);
        TempData["Success"] = $"Welcome to LearnHub, {result.Value!.FullName}!";
        return RedirectToAction("Index", "Dashboard");
    }

    [HttpPost, Authorize]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        TempData["Success"] = "You have been signed out.";
        return RedirectToAction("Index", "Home");
    }

    public IActionResult AccessDenied() => View();

    [HttpGet, Authorize]
    public async Task<IActionResult> Profile() => View(await BuildProfileAsync(new ChangePasswordViewModel()));

    [HttpPost, Authorize]
    public async Task<IActionResult> ChangePassword([Bind(Prefix = "Password")] ChangePasswordViewModel model)
    {
        if (ModelState.IsValid)
        {
            var result = await lms.ChangePasswordAsync(User.GetUserId(), model.CurrentPassword, model.NewPassword);
            if (result.Succeeded)
            {
                TempData["Success"] = "Your password has been changed.";
                return RedirectToAction(nameof(Profile));
            }
            ModelState.AddModelError(string.Empty, result.Error!);
        }
        return View(nameof(Profile), await BuildProfileAsync(model));
    }

    private async Task<ProfileViewModel> BuildProfileAsync(ChangePasswordViewModel password)
    {
        var uid = User.GetUserId();
        var user = await db.Users.SingleAsync(u => u.Id == uid);
        return new ProfileViewModel
        {
            User = user,
            Password = password,
            CourseCount = user.Role == UserRole.Student
                ? await db.Enrollments.CountAsync(e => e.StudentId == uid)
                : await db.Courses.CountAsync(c => c.InstructorId == uid),
            SubmissionCount = await db.Submissions.CountAsync(s => s.StudentId == uid)
        };
    }

    private Task SignInAsync(AppUser user, bool persistent) =>
        HttpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            ClaimsPrincipalExtensions.CreatePrincipal(user, CookieAuthenticationDefaults.AuthenticationScheme),
            new AuthenticationProperties { IsPersistent = persistent });
}
