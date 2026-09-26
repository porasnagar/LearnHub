using System.Security.Claims;
using LearnHub.Web.Data;
using LearnHub.Web.Models;
using LearnHub.Web.Services;
using LearnHub.Web.ViewModels;
using Microsoft.EntityFrameworkCore;

namespace LearnHub.Web.Infrastructure;

public static class CourseContextLoader
{
    /// <summary>
    /// Loads a course plus the viewer's relationship to it, for the course shell
    /// (banner + course navigation) rendered by <c>_CourseLayout</c>.
    /// </summary>
    public static async Task<CourseContext?> LoadAsync(LmsDbContext db, ClaimsPrincipal user, int courseId, string tab)
    {
        var course = await db.Courses.Include(c => c.Instructor).SingleOrDefaultAsync(c => c.Id == courseId);
        if (course is null) return null;

        var signedIn = user.Identity?.IsAuthenticated == true;
        var uid = signedIn ? user.GetUserId() : 0;
        var role = signedIn ? user.GetRole() : (UserRole?)null;
        var isStudent = role == UserRole.Student;

        return new CourseContext
        {
            Course = course,
            ActiveTab = tab,
            IsSignedIn = signedIn,
            IsStudent = isStudent,
            CanManage = role is not null && LmsService.CanManage(course, uid, role.Value),
            IsEnrolled = isStudent && await db.Enrollments.AnyAsync(e => e.CourseId == courseId && e.StudentId == uid),
            StudentCount = await db.Enrollments.CountAsync(e => e.CourseId == courseId)
        };
    }
}
