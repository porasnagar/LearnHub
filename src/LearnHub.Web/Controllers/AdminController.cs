using LearnHub.Web.Data;
using LearnHub.Web.Infrastructure;
using LearnHub.Web.Models;
using LearnHub.Web.Services;
using LearnHub.Web.ViewModels;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LearnHub.Web.Controllers;

[Authorize(Roles = nameof(UserRole.Admin))]
public class AdminController(LmsDbContext db, LmsService lms, FileStorageService files) : Controller
{
    public IActionResult Index() => RedirectToAction(nameof(Users));

    public async Task<IActionResult> Users(string? q, UserRole? role)
    {
        var query = db.Users.AsQueryable();
        if (!string.IsNullOrWhiteSpace(q))
        {
            var pattern = $"%{q.Trim()}%";
            query = query.Where(u => EF.Functions.Like(u.FullName, pattern) || EF.Functions.Like(u.Email, pattern));
        }
        if (role.HasValue) query = query.Where(u => u.Role == role);

        return View(new AdminUsersViewModel
        {
            Query = q,
            Role = role,
            Counts = await db.Users.GroupBy(u => u.Role).ToDictionaryAsync(g => g.Key, g => g.Count()),
            Users = await query.OrderBy(u => u.Role).ThenBy(u => u.FullName)
                .Select(u => new UserRow
                {
                    User = u,
                    CoursesTaught = u.CoursesTaught.Count,
                    Enrollments = u.Enrollments.Count
                }).ToListAsync()
        });
    }

    public async Task<IActionResult> Courses() =>
        View(await db.Courses.OrderBy(c => c.Code).ToCards(null).ToListAsync());

    [HttpPost]
    public async Task<IActionResult> ChangeRole(int id, UserRole role)
    {
        var result = await lms.ChangeRoleAsync(id, role, User.GetUserId());
        TempData[result.Succeeded ? "Success" : "Error"] = result.Succeeded ? $"Role changed to {role}." : result.Error;
        return RedirectToAction(nameof(Users));
    }

    [HttpPost]
    public async Task<IActionResult> DeleteUser(int id)
    {
        var result = await lms.DeleteUserAsync(id, User.GetUserId());
        if (result.Succeeded) result.Value!.ForEach(files.Delete);
        TempData[result.Succeeded ? "Success" : "Error"] = result.Succeeded ? "User deleted." : result.Error;
        return RedirectToAction(nameof(Users));
    }
}
