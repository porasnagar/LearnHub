using LearnHub.Web.Data;
using LearnHub.Web.Infrastructure;
using LearnHub.Web.Models;
using LearnHub.Web.ViewModels;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LearnHub.Web.Controllers;

/// <summary>A student's current grade in every enrolled course.</summary>
[Authorize(Roles = nameof(UserRole.Student))]
public class GradesController(LmsDbContext db) : Controller
{
    public async Task<IActionResult> Index()
    {
        var uid = User.GetUserId();
        var courses = await db.Courses
            .Where(c => c.Enrollments.Any(e => e.StudentId == uid))
            .OrderBy(c => c.Code)
            .Select(c => new { c.Id, c.Code, c.Title, Instructor = c.Instructor!.FullName, Assignments = c.Assignments.Count })
            .ToListAsync();
        var submissions = await db.Submissions.Include(s => s.Assignment)
            .Where(s => s.StudentId == uid).ToListAsync();

        var rows = courses.Select(c => new CourseGradeRow
        {
            CourseId = c.Id,
            Code = c.Code,
            Title = c.Title,
            InstructorName = c.Instructor,
            AssignmentCount = c.Assignments,
            Summary = GradeSummary.From(submissions.Where(s => s.Assignment!.CourseId == c.Id))
        }).ToList();
        return View(rows);
    }
}
