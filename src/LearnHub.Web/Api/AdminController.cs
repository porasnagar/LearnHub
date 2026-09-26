using LearnHub.Web.Data;
using LearnHub.Web.Models;
using LearnHub.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LearnHub.Web.Api;

[Authorize(Roles = nameof(UserRole.Admin))]
public class AdminController(LmsDbContext db, LmsService lms, FileStorageService files) : ApiControllerBase
{
    [HttpGet("users")]
    public async Task<AdminUsersDto> Users(string? q, UserRole? role)
    {
        var query = db.Users.AsQueryable();
        if (!string.IsNullOrWhiteSpace(q))
        {
            var pattern = $"%{q.Trim()}%";
            query = query.Where(u => EF.Functions.Like(u.FullName, pattern) || EF.Functions.Like(u.Email, pattern));
        }
        if (role.HasValue) query = query.Where(u => u.Role == role);

        var counts = await db.Users.GroupBy(u => u.Role).Select(g => new { g.Key, Count = g.Count() }).ToListAsync();
        var rows = await query.OrderBy(u => u.Role).ThenBy(u => u.FullName)
            .Select(u => new { User = u, Taught = u.CoursesTaught.Count, Enrolled = u.Enrollments.Count })
            .ToListAsync();

        return new AdminUsersDto(
            counts.ToDictionary(c => c.Key.ToString(), c => c.Count),
            rows.Select(r => new UserRowDto(UserDto.From(r.User), r.Taught, r.Enrolled)).ToList());
    }

    /// <summary>Instructor picker for the course form (admins assign courses).</summary>
    [HttpGet("instructors")]
    public Task<List<PersonDto>> Instructors() =>
        db.Users.Where(u => u.Role == UserRole.Instructor).OrderBy(u => u.FullName)
            .Select(u => new PersonDto(u.Id, u.FullName, u.Email)).ToListAsync();

    [HttpPost("users/{id:int}/role")]
    public async Task<IActionResult> ChangeRole(int id, ChangeRoleRequest request) =>
        FromResult(await lms.ChangeRoleAsync(id, request.Role, UserId));

    [HttpDelete("users/{id:int}")]
    public async Task<IActionResult> DeleteUser(int id)
    {
        var result = await lms.DeleteUserAsync(id, UserId);
        if (!result.Succeeded) return Fail(result.Error);
        result.Value!.ForEach(files.Delete);
        return NoContent();
    }
}
