using LearnHub.Web.Data;
using LearnHub.Web.Infrastructure;
using LearnHub.Web.Models;
using LearnHub.Web.ViewModels;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LearnHub.Web.Controllers;

[Authorize]
public class DashboardController(LmsDbContext db) : Controller
{
    public async Task<IActionResult> Index()
    {
        var uid = User.GetUserId();
        var role = User.GetRole();
        var vm = new DashboardViewModel { FullName = User.Identity!.Name!, Role = role };

        switch (role)
        {
            case UserRole.Student:
                await FillStudentAsync(vm, uid);
                break;
            case UserRole.Instructor:
                await FillInstructorAsync(vm, uid);
                break;
            default:
                await FillAdminAsync(vm);
                break;
        }
        return View(vm);
    }

    private async Task FillStudentAsync(DashboardViewModel vm, int uid)
    {
        var now = DateTime.Now;
        var today = DateTime.Today;
        var courseIds = await db.Enrollments.Where(e => e.StudentId == uid).Select(e => e.CourseId).ToListAsync();

        vm.Courses = await db.Courses.Where(c => courseIds.Contains(c.Id)).OrderBy(c => c.Code).ToCards(uid).ToListAsync();

        var assignments = await db.Assignments.Include(a => a.Course)
            .Where(a => courseIds.Contains(a.CourseId))
            .OrderBy(a => a.DueDate)
            .ToListAsync();
        var submissions = await db.Submissions
            .Include(s => s.Assignment).ThenInclude(a => a!.Course).ThenInclude(c => c!.Instructor)
            .Where(s => s.StudentId == uid)
            .ToListAsync();

        vm.SubmittedIds = submissions.Select(s => s.AssignmentId).ToHashSet();
        var open = assignments.Where(a => !vm.SubmittedIds.Contains(a.Id)).ToList();

        vm.Missing = open.Where(a => a.DueDate < now).ToList();
        vm.UpcomingCount = open.Count(a => a.DueDate >= now);
        vm.NextUp = open.FirstOrDefault(a => a.DueDate >= now);
        vm.GradedCount = submissions.Count(s => s.IsGraded);
        vm.AwaitingCount = submissions.Count(s => !s.IsGraded);
        vm.Overall = GradeSummary.From(submissions);
        vm.Week = assignments.Where(a => a.DueDate >= today && a.DueDate < today.AddDays(7)).ToList();
        vm.RecentGrades = submissions.Where(s => s.IsGraded).OrderByDescending(s => s.GradedAt).Take(4).ToList();
        vm.Activity = LastSevenDays(submissions.Select(s => s.SubmittedAt));
    }

    private async Task FillInstructorAsync(DashboardViewModel vm, int uid)
    {
        var today = DateTime.Today;
        vm.Courses = await db.Courses.Where(c => c.InstructorId == uid).OrderBy(c => c.Code).ToCards(null).ToListAsync();

        var pending = PendingGradingQuery().Where(s => s.Assignment!.Course!.InstructorId == uid);
        vm.PendingGrading = await pending.Take(6).ToListAsync();
        vm.PendingTotal = await pending.CountAsync();

        vm.Activity = LastSevenDays(await db.Submissions
            .Where(s => s.Assignment!.Course!.InstructorId == uid && s.SubmittedAt >= today.AddDays(-6))
            .Select(s => s.SubmittedAt).ToListAsync());

        vm.Week = await db.Assignments.Include(a => a.Course)
            .Where(a => a.Course!.InstructorId == uid && a.DueDate >= today && a.DueDate < today.AddDays(7))
            .OrderBy(a => a.DueDate).ToListAsync();

        vm.Completion = await CompletionAsync(db.Assignments.Where(a => a.Course!.InstructorId == uid), vm.Courses);

        vm.Figures =
        [
            new("Courses", vm.Courses.Count, "courses"),
            new("Students", vm.Courses.Sum(c => c.StudentCount), "people"),
            new("Assignments", vm.Courses.Sum(c => c.AssignmentCount), "assignment"),
            new("To grade", vm.PendingTotal, "inbox")
        ];
    }

    private async Task FillAdminAsync(DashboardViewModel vm)
    {
        var today = DateTime.Today;
        vm.Courses = await db.Courses.OrderBy(c => c.Code).ToCards(null).ToListAsync();

        var pending = PendingGradingQuery();
        vm.PendingGrading = await pending.Take(5).ToListAsync();
        vm.PendingTotal = await pending.CountAsync();
        vm.RecentUsers = await db.Users.OrderByDescending(u => u.CreatedAt).ThenByDescending(u => u.Id).Take(6).ToListAsync();

        vm.Activity = LastSevenDays(await db.Submissions
            .Where(s => s.SubmittedAt >= today.AddDays(-6)).Select(s => s.SubmittedAt).ToListAsync());
        vm.EnrollmentByCourse = vm.Courses.OrderByDescending(c => c.StudentCount)
            .Select(c => new CourseCount(c.Id, c.Code, c.Title, c.StudentCount)).ToList();

        vm.Figures =
        [
            new("Users", await db.Users.CountAsync(), "people"),
            new("Courses", vm.Courses.Count, "courses"),
            new("Enrollments", await db.Enrollments.CountAsync(), "check-circle"),
            new("Submissions", await db.Submissions.CountAsync(), "inbox")
        ];
    }

    /// <summary>Recent and upcoming assignments with how many enrolled students have submitted.</summary>
    private async Task<List<AssignmentProgress>> CompletionAsync(IQueryable<Assignment> scope, List<CourseCardViewModel> courses)
    {
        var today = DateTime.Today;
        var list = await scope.Include(a => a.Course)
            .Where(a => a.DueDate >= today.AddDays(-10) && a.DueDate <= today.AddDays(14))
            .OrderBy(a => a.DueDate).Take(5).ToListAsync();
        var ids = list.Select(a => a.Id).ToList();
        var counts = await db.Submissions.Where(s => ids.Contains(s.AssignmentId))
            .GroupBy(s => s.AssignmentId).Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count);
        var enrolled = courses.ToDictionary(c => c.Id, c => c.StudentCount);

        return list.Select(a => new AssignmentProgress(a, counts.GetValueOrDefault(a.Id), enrolled.GetValueOrDefault(a.CourseId))).ToList();
    }

    private static List<DayCount> LastSevenDays(IEnumerable<DateTime> times)
    {
        var dates = times.Select(t => t.Date).ToList();
        return Enumerable.Range(-6, 7)
            .Select(offset => DateTime.Today.AddDays(offset))
            .Select(day => new DayCount(day, dates.Count(d => d == day)))
            .ToList();
    }

    private IQueryable<Submission> PendingGradingQuery() =>
        db.Submissions
            .Include(s => s.Student)
            .Include(s => s.Assignment).ThenInclude(a => a!.Course)
            .Where(s => s.Score == null)
            .OrderBy(s => s.SubmittedAt);
}
