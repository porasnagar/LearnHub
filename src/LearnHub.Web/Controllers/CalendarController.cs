using LearnHub.Web.Data;
using LearnHub.Web.Infrastructure;
using LearnHub.Web.Models;
using LearnHub.Web.ViewModels;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LearnHub.Web.Controllers;

[Authorize]
public class CalendarController(LmsDbContext db) : Controller
{
    /// <summary>Month view of assignment due dates across the viewer's courses.</summary>
    public async Task<IActionResult> Index(int? year, int? month)
    {
        var today = DateTime.Today;
        var first = new DateTime(Math.Clamp(year ?? today.Year, 2000, 2100), Math.Clamp(month ?? today.Month, 1, 12), 1);
        var gridStart = first.AddDays(-(int)first.DayOfWeek); // weeks start on Sunday
        var weeks = (int)Math.Ceiling(((int)first.DayOfWeek + DateTime.DaysInMonth(first.Year, first.Month)) / 7.0);
        var gridEnd = gridStart.AddDays(weeks * 7);

        var uid = User.GetUserId();
        var role = User.GetRole();
        var courses = role switch
        {
            UserRole.Student => db.Courses.Where(c => c.Enrollments.Any(e => e.StudentId == uid)),
            UserRole.Instructor => db.Courses.Where(c => c.InstructorId == uid),
            _ => db.Courses
        };
        var courseList = await courses.OrderBy(c => c.Code)
            .Select(c => new CalendarCourse(c.Id, c.Code, c.Title)).ToListAsync();
        var ids = courseList.Select(c => c.Id).ToList();

        var items = await db.Assignments.Include(a => a.Course)
            .Where(a => ids.Contains(a.CourseId) && a.DueDate >= gridStart && a.DueDate < gridEnd)
            .OrderBy(a => a.DueDate)
            .ToListAsync();

        var submitted = role == UserRole.Student
            ? (await db.Submissions.Where(s => s.StudentId == uid).Select(s => s.AssignmentId).ToListAsync()).ToHashSet()
            : [];

        return View(new CalendarViewModel
        {
            Month = first,
            GridStart = gridStart,
            Weeks = weeks,
            Items = items,
            SubmittedIds = submitted,
            Courses = courseList,
            IsStudent = role == UserRole.Student
        });
    }
}
