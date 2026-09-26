using System.Text;
using LearnHub.Web.Data;
using LearnHub.Web.Infrastructure;
using LearnHub.Web.Models;
using LearnHub.Web.Services;
using LearnHub.Web.ViewModels;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;

namespace LearnHub.Web.Controllers;

[Authorize]
public class CoursesController(LmsDbContext db, LmsService lms, FileStorageService files) : Controller
{
    private bool IsSignedIn => User.Identity?.IsAuthenticated == true;
    private int? CurrentStudentId => IsSignedIn && User.GetRole() == UserRole.Student ? User.GetUserId() : null;

    // ---------- Catalog & my courses ----------

    [AllowAnonymous]
    public async Task<IActionResult> Index(string? q, string? category)
    {
        var published = db.Courses.Where(c => c.IsPublished);
        var query = published;
        if (!string.IsNullOrWhiteSpace(q))
        {
            var pattern = $"%{q.Trim()}%";
            query = query.Where(c => EF.Functions.Like(c.Title, pattern)
                                     || EF.Functions.Like(c.Code, pattern)
                                     || EF.Functions.Like(c.Description, pattern));
        }
        if (!string.IsNullOrWhiteSpace(category))
            query = query.Where(c => c.Category == category);

        return View(new CourseCatalogViewModel
        {
            Query = q,
            Category = category,
            TotalPublished = await published.CountAsync(),
            Subjects = await published.GroupBy(c => c.Category).OrderBy(g => g.Key)
                .Select(g => new SubjectCount(g.Key, g.Count())).ToListAsync(),
            Courses = await query.OrderBy(c => c.Code).ToCards(CurrentStudentId).ToListAsync()
        });
    }

    /// <summary>Students: enrolled courses. Instructors: courses they teach. Admins: every course.</summary>
    public async Task<IActionResult> Mine()
    {
        var uid = User.GetUserId();
        var query = User.GetRole() switch
        {
            UserRole.Student => db.Courses.Where(c => c.Enrollments.Any(e => e.StudentId == uid)),
            UserRole.Instructor => db.Courses.Where(c => c.InstructorId == uid),
            _ => db.Courses
        };
        return View(await query.OrderBy(c => c.Code).ToCards(CurrentStudentId).ToListAsync());
    }

    // ---------- Course shell tabs ----------

    [AllowAnonymous]
    public async Task<IActionResult> Details(int id)
    {
        var ctx = await LoadAsync(id, "home");
        if (ctx is null || (!ctx.Course.IsPublished && !ctx.CanManage)) return NotFound();

        var vm = new CourseHomeViewModel();
        if (ctx.CanSeeContent)
        {
            var rows = await AssignmentRowsAsync(id);
            vm.AssignmentCount = rows.Count;
            vm.Upcoming = rows.Where(r => r.Assignment.DueDate >= DateTime.Now).Take(5).ToList();
            vm.ToGrade = rows.Sum(r => r.UngradedCount);
            vm.Submitted = rows.Count(r => r.MySubmission is not null);
            if (ctx.IsEnrolled) vm.Grade = GradeSummary.From(rows.Where(r => r.MySubmission is not null).Select(r => r.MySubmission!));
        }
        else
        {
            vm.AssignmentCount = await db.Assignments.CountAsync(a => a.CourseId == id);
        }
        return View(vm);
    }

    public async Task<IActionResult> Assignments(int id)
    {
        var ctx = await LoadAsync(id, "assignments");
        if (ctx is null) return NotFound();
        if (!ctx.CanSeeContent) return Locked(id);

        var rows = await AssignmentRowsAsync(id);
        var now = DateTime.Now;
        return View(new CourseAssignmentsViewModel
        {
            Upcoming = rows.Where(r => r.Assignment.DueDate >= now).ToList(),
            Past = rows.Where(r => r.Assignment.DueDate < now).OrderByDescending(r => r.Assignment.DueDate).ToList()
        });
    }

    public async Task<IActionResult> Grades(int id)
    {
        var ctx = await LoadAsync(id, "grades");
        if (ctx is null) return NotFound();
        if (!ctx.CanSeeContent) return Locked(id);

        if (ctx.CanManage) return View("Gradebook", await BuildGradebookAsync(id));

        var rows = await AssignmentRowsAsync(id);
        return View(new StudentGradesViewModel
        {
            Rows = rows,
            Summary = GradeSummary.From(rows.Where(r => r.MySubmission is not null).Select(r => r.MySubmission!))
        });
    }

    [Authorize(Roles = "Instructor,Admin")]
    public async Task<IActionResult> ExportGrades(int id)
    {
        var course = await db.Courses.FindAsync(id);
        if (course is null) return NotFound();
        if (!LmsService.CanManage(course, User.GetUserId(), User.GetRole())) return Forbid();

        var gradebook = await BuildGradebookAsync(id);
        static string Csv(string value) =>
            value.IndexOfAny([',', '"', '\n', '\r']) >= 0 ? "\"" + value.Replace("\"", "\"\"") + "\"" : value;

        var csv = new StringBuilder();
        csv.AppendLine(string.Join(",", new[] { "Student", "Email" }
            .Concat(gradebook.Assignments.Select(a => Csv($"{a.Title} ({a.MaxPoints})")))
            .Concat(["Points earned", "Points possible", "Percent", "Letter"])));
        foreach (var row in gradebook.Rows)
        {
            var cells = new List<string> { Csv(row.Student.FullName), Csv(row.Student.Email) };
            cells.AddRange(gradebook.Assignments.Select(a =>
                row.Submissions.GetValueOrDefault(a.Id)?.Score is double s ? Ui.Score(s) : ""));
            cells.Add(Ui.Score(row.Summary.Earned));
            cells.Add(row.Summary.Possible.ToString());
            cells.Add(row.Summary.Percent is double p ? p.ToString("0.0") : "");
            cells.Add(row.Summary.Letter ?? "");
            csv.AppendLine(string.Join(",", cells));
        }

        var bytes = Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(csv.ToString())).ToArray();
        return File(bytes, "text/csv", $"{course.Code}-gradebook-{DateTime.Now:yyyyMMdd}.csv");
    }

    [Authorize(Roles = "Instructor,Admin")]
    public async Task<IActionResult> Roster(int id)
    {
        var ctx = await LoadAsync(id, "people");
        if (ctx is null) return NotFound();
        if (!ctx.CanManage) return Forbid();

        return View(new RosterViewModel
        {
            AssignmentCount = await db.Assignments.CountAsync(a => a.CourseId == id),
            Students = await db.Enrollments.Where(e => e.CourseId == id)
                .OrderBy(e => e.Student!.FullName)
                .Select(e => new RosterRow
                {
                    StudentId = e.StudentId,
                    Name = e.Student!.FullName,
                    Email = e.Student.Email,
                    EnrolledAt = e.EnrolledAt,
                    Submitted = e.Student.Submissions.Count(s => s.Assignment!.CourseId == id),
                    Graded = e.Student.Submissions.Count(s => s.Assignment!.CourseId == id && s.Score != null)
                }).ToListAsync()
        });
    }

    // ---------- Enrollment ----------

    [HttpPost, Authorize(Roles = nameof(UserRole.Student))]
    public async Task<IActionResult> Enroll(int id)
    {
        var result = await lms.EnrollAsync(id, User.GetUserId());
        TempData[result.Succeeded ? "Success" : "Error"] = result.Succeeded ? "You're enrolled. Welcome to the course!" : result.Error;
        return RedirectToAction(nameof(Details), new { id });
    }

    [HttpPost, Authorize(Roles = nameof(UserRole.Student))]
    public async Task<IActionResult> Unenroll(int id)
    {
        var result = await lms.UnenrollAsync(id, User.GetUserId());
        TempData[result.Succeeded ? "Success" : "Error"] = result.Succeeded ? "You have left the course." : result.Error;
        return RedirectToAction(nameof(Details), new { id });
    }

    [HttpPost, Authorize(Roles = "Instructor,Admin")]
    public async Task<IActionResult> RemoveStudent(int id, int studentId)
    {
        var course = await db.Courses.FindAsync(id);
        if (course is null) return NotFound();
        if (!LmsService.CanManage(course, User.GetUserId(), User.GetRole())) return Forbid();

        var result = await lms.UnenrollAsync(id, studentId);
        TempData[result.Succeeded ? "Success" : "Error"] = result.Succeeded ? "Student removed from the course." : result.Error;
        return RedirectToAction(nameof(Roster), new { id });
    }

    // ---------- Create / settings / delete ----------

    [HttpGet, Authorize(Roles = "Instructor,Admin")]
    public async Task<IActionResult> Create() => View(await WithInstructorsAsync(new CourseFormViewModel()));

    [HttpPost, Authorize(Roles = "Instructor,Admin")]
    public async Task<IActionResult> Create(CourseFormViewModel model)
    {
        await ValidateCourseFormAsync(model);
        if (!ModelState.IsValid) return View(await WithInstructorsAsync(model));

        var course = new Course { InstructorId = User.GetUserId() };
        Apply(model, course);
        db.Courses.Add(course);
        await db.SaveChangesAsync();

        TempData["Success"] = $"{course.Code} has been created. Add its first assignment next.";
        return RedirectToAction(nameof(Details), new { id = course.Id });
    }

    [HttpGet, Authorize(Roles = "Instructor,Admin")]
    public async Task<IActionResult> Edit(int id)
    {
        var ctx = await LoadAsync(id, "settings");
        if (ctx is null) return NotFound();
        if (!ctx.CanManage) return Forbid();

        var course = ctx.Course;
        return View(await WithInstructorsAsync(new CourseFormViewModel
        {
            Id = course.Id, Code = course.Code, Title = course.Title, Description = course.Description,
            Category = course.Category, Credits = course.Credits, IsPublished = course.IsPublished,
            InstructorId = course.InstructorId
        }));
    }

    [HttpPost, Authorize(Roles = "Instructor,Admin")]
    public async Task<IActionResult> Edit(int id, CourseFormViewModel model)
    {
        var ctx = await LoadAsync(id, "settings");
        if (ctx is null) return NotFound();
        if (!ctx.CanManage) return Forbid();

        model.Id = id;
        await ValidateCourseFormAsync(model);
        if (!ModelState.IsValid) return View(await WithInstructorsAsync(model));

        Apply(model, ctx.Course);
        await db.SaveChangesAsync();
        TempData["Success"] = "Course settings saved.";
        return RedirectToAction(nameof(Details), new { id });
    }

    [HttpGet, Authorize(Roles = "Instructor,Admin")]
    public async Task<IActionResult> Delete(int id)
    {
        var ctx = await LoadAsync(id, "settings");
        if (ctx is null) return NotFound();
        if (!ctx.CanManage) return Forbid();

        ViewBag.AssignmentCount = await db.Assignments.CountAsync(a => a.CourseId == id);
        ViewBag.SubmissionCount = await db.Submissions.CountAsync(s => s.Assignment!.CourseId == id);
        return View();
    }

    [HttpPost, ActionName("Delete"), Authorize(Roles = "Instructor,Admin")]
    public async Task<IActionResult> DeleteConfirmed(int id)
    {
        var course = await db.Courses.FindAsync(id);
        if (course is null) return NotFound();
        if (!LmsService.CanManage(course, User.GetUserId(), User.GetRole())) return Forbid();

        var storedFiles = await db.Submissions
            .Where(s => s.Assignment!.CourseId == id && s.StoredFileName != null)
            .Select(s => s.StoredFileName!).ToListAsync();

        db.Courses.Remove(course); // enrollments, assignments and submissions cascade
        await db.SaveChangesAsync();
        storedFiles.ForEach(files.Delete);

        TempData["Success"] = $"{course.Code} has been deleted.";
        return RedirectToAction(nameof(Mine));
    }

    // ---------- Helpers ----------

    private async Task<CourseContext?> LoadAsync(int id, string tab)
    {
        var ctx = await CourseContextLoader.LoadAsync(db, User, id, tab);
        ViewData["CourseContext"] = ctx;
        return ctx;
    }

    private IActionResult Locked(int id)
    {
        TempData["Error"] = "Enroll in this course to see its assignments and grades.";
        return RedirectToAction(nameof(Details), new { id });
    }

    /// <summary>Assignments of a course ordered by due date, with counts and (for students) their own submission.</summary>
    private async Task<List<AssignmentRow>> AssignmentRowsAsync(int courseId)
    {
        var rows = await db.Assignments.Where(a => a.CourseId == courseId).OrderBy(a => a.DueDate)
            .Select(a => new AssignmentRow
            {
                Assignment = a,
                SubmissionCount = a.Submissions.Count,
                UngradedCount = a.Submissions.Count(s => s.Score == null)
            }).ToListAsync();

        if (CurrentStudentId is int studentId)
        {
            var mine = await db.Submissions
                .Where(s => s.StudentId == studentId && s.Assignment!.CourseId == courseId)
                .ToDictionaryAsync(s => s.AssignmentId);
            foreach (var row in rows)
            {
                row.MySubmission = mine.GetValueOrDefault(row.Assignment.Id);
                if (row.MySubmission is not null) row.MySubmission.Assignment = row.Assignment;
            }
        }
        return rows;
    }

    private async Task<GradebookViewModel> BuildGradebookAsync(int courseId)
    {
        var assignments = await db.Assignments.Where(a => a.CourseId == courseId).OrderBy(a => a.DueDate).ToListAsync();
        var students = await db.Enrollments.Where(e => e.CourseId == courseId)
            .Select(e => e.Student!).OrderBy(s => s.FullName).ToListAsync();
        // Loaded into the same context, so each submission's Assignment navigation is filled in.
        var submissions = await db.Submissions.Where(s => s.Assignment!.CourseId == courseId).ToListAsync();
        var byStudent = submissions.GroupBy(s => s.StudentId).ToDictionary(g => g.Key, g => g.ToDictionary(s => s.AssignmentId));

        return new GradebookViewModel
        {
            Assignments = assignments,
            Rows = students.Select(student =>
            {
                var subs = byStudent.GetValueOrDefault(student.Id) ?? [];
                return new GradebookRow { Student = student, Submissions = subs, Summary = GradeSummary.From(subs.Values) };
            }).ToList()
        };
    }

    private async Task ValidateCourseFormAsync(CourseFormViewModel model)
    {
        var code = model.Code.Trim().ToUpperInvariant();
        if (await db.Courses.AnyAsync(c => c.Code == code && c.Id != model.Id))
            ModelState.AddModelError(nameof(model.Code), "Another course already uses this code.");

        if (User.GetRole() == UserRole.Admin)
        {
            if (model.InstructorId is null
                || !await db.Users.AnyAsync(u => u.Id == model.InstructorId && u.Role == UserRole.Instructor))
                ModelState.AddModelError(nameof(model.InstructorId), "Choose an instructor.");
        }
    }

    private void Apply(CourseFormViewModel model, Course course)
    {
        course.Code = model.Code.Trim().ToUpperInvariant();
        course.Title = model.Title.Trim();
        course.Description = model.Description.Trim();
        course.Category = model.Category.Trim();
        course.Credits = model.Credits;
        course.IsPublished = model.IsPublished;
        // Only an admin can assign a course to a different instructor.
        if (User.GetRole() == UserRole.Admin && model.InstructorId.HasValue)
            course.InstructorId = model.InstructorId.Value;
    }

    private async Task<CourseFormViewModel> WithInstructorsAsync(CourseFormViewModel model)
    {
        if (User.GetRole() == UserRole.Admin)
        {
            model.Instructors = await db.Users.Where(u => u.Role == UserRole.Instructor).OrderBy(u => u.FullName)
                .Select(u => new SelectListItem(u.FullName + " (" + u.Email + ")", u.Id.ToString()))
                .ToListAsync();
        }
        ViewBag.Categories = await db.Courses.Select(c => c.Category).Distinct().OrderBy(c => c).ToListAsync();
        return model;
    }
}
