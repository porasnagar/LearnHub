using LearnHub.Web.Data;
using LearnHub.Web.Infrastructure;
using LearnHub.Web.Models;
using LearnHub.Web.Services;
using LearnHub.Web.ViewModels;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LearnHub.Web.Controllers;

[Authorize]
public class AssignmentsController(LmsDbContext db, LmsService lms, FileStorageService files) : Controller
{
    public async Task<IActionResult> Details(int id)
    {
        var assignment = await db.Assignments.SingleOrDefaultAsync(a => a.Id == id);
        if (assignment is null) return NotFound();
        var ctx = await LoadCourseAsync(assignment.CourseId);
        assignment.Course = ctx!.Course;

        var uid = User.GetUserId();
        var vm = new AssignmentDetailsViewModel
        {
            Assignment = assignment,
            CanManage = ctx.CanManage,
            AllowedExtensions = files.AllowedExtensionsText,
            MaxFileSizeMB = files.MaxFileSizeMB
        };

        if (ctx.CanManage)
        {
            // Every enrolled student, with their submission if any, plus submissions from students who have since left.
            var submissions = await db.Submissions.Include(s => s.Student)
                .Where(s => s.AssignmentId == id).ToDictionaryAsync(s => s.StudentId);
            var enrolled = await db.Enrollments.Where(e => e.CourseId == assignment.CourseId)
                .Select(e => e.Student!).ToListAsync();

            vm.Rows = enrolled.Select(s => new SubmissionRow { Student = s, Submission = submissions.GetValueOrDefault(s.Id) })
                .Concat(submissions.Values.Where(s => enrolled.All(e => e.Id != s.StudentId))
                    .Select(s => new SubmissionRow { Student = s.Student!, Submission = s, StillEnrolled = false }))
                .OrderBy(r => r.Submission is null ? 1 : r.Submission.IsGraded ? 2 : 0)
                .ThenBy(r => r.Student.FullName)
                .ToList();
        }
        else if (ctx.IsEnrolled)
        {
            vm.MySubmission = await db.Submissions.SingleOrDefaultAsync(s => s.AssignmentId == id && s.StudentId == uid);
        }
        else
        {
            return Forbid();
        }
        return View(vm);
    }

    // ---------- Submitting (students) ----------

    [HttpPost, Authorize(Roles = nameof(UserRole.Student))]
    [RequestSizeLimit(64 * 1024 * 1024)]
    public async Task<IActionResult> Submit(SubmitViewModel model)
    {
        if (!ModelState.IsValid)
        {
            TempData["Error"] = string.Join(" ", ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage));
            return RedirectToAction(nameof(Details), new { id = model.AssignmentId });
        }

        string? storedName = null;
        if (model.Attachment is { Length: > 0 })
        {
            var error = files.Validate(model.Attachment);
            if (error is not null)
            {
                TempData["Error"] = error;
                return RedirectToAction(nameof(Details), new { id = model.AssignmentId });
            }
            storedName = await files.SaveAsync(model.Attachment);
        }

        var result = await lms.SubmitAsync(model.AssignmentId, User.GetUserId(), model.TextAnswer,
            storedName, model.Attachment is null ? null : Path.GetFileName(model.Attachment.FileName));

        if (!result.Succeeded)
        {
            files.Delete(storedName);
            TempData["Error"] = result.Error;
        }
        else
        {
            files.Delete(result.Value); // previous attachment that was replaced
            TempData["Success"] = "Submission received. Your instructor will be able to review it now.";
        }
        return RedirectToAction(nameof(Details), new { id = model.AssignmentId });
    }

    /// <param name="id">Submission id.</param>
    public async Task<IActionResult> Download(int id)
    {
        var submission = await db.Submissions
            .Include(s => s.Assignment).ThenInclude(a => a!.Course)
            .SingleOrDefaultAsync(s => s.Id == id);
        if (submission?.StoredFileName is null) return NotFound();

        var uid = User.GetUserId();
        if (submission.StudentId != uid && !LmsService.CanManage(submission.Assignment!.Course!, uid, User.GetRole()))
            return Forbid();

        var stream = files.OpenRead(submission.StoredFileName);
        if (stream is null) return NotFound();
        return File(stream, "application/octet-stream", submission.OriginalFileName ?? submission.StoredFileName);
    }

    // ---------- Managing (instructors / admins) ----------

    [HttpGet, Authorize(Roles = "Instructor,Admin")]
    public async Task<IActionResult> Create(int courseId)
    {
        var ctx = await LoadCourseAsync(courseId);
        if (ctx is null) return NotFound();
        if (!ctx.CanManage) return Forbid();

        return View(new AssignmentFormViewModel { CourseId = courseId });
    }

    [HttpPost, Authorize(Roles = "Instructor,Admin")]
    public async Task<IActionResult> Create(AssignmentFormViewModel model)
    {
        var ctx = await LoadCourseAsync(model.CourseId);
        if (ctx is null) return NotFound();
        if (!ctx.CanManage) return Forbid();
        if (!ModelState.IsValid) return View(model);

        var assignment = new Assignment
        {
            CourseId = model.CourseId,
            Title = model.Title.Trim(),
            Instructions = model.Instructions.Trim(),
            DueDate = model.DueDate,
            MaxPoints = model.MaxPoints
        };
        db.Assignments.Add(assignment);
        await db.SaveChangesAsync();

        TempData["Success"] = "Assignment published. Enrolled students can see it now.";
        return RedirectToAction(nameof(Details), new { id = assignment.Id });
    }

    [HttpGet, Authorize(Roles = "Instructor,Admin")]
    public async Task<IActionResult> Edit(int id)
    {
        var assignment = await db.Assignments.FindAsync(id);
        if (assignment is null) return NotFound();
        var ctx = await LoadCourseAsync(assignment.CourseId);
        if (!ctx!.CanManage) return Forbid();

        return View(new AssignmentFormViewModel
        {
            Id = assignment.Id,
            CourseId = assignment.CourseId,
            Title = assignment.Title,
            Instructions = assignment.Instructions,
            DueDate = assignment.DueDate,
            MaxPoints = assignment.MaxPoints
        });
    }

    [HttpPost, Authorize(Roles = "Instructor,Admin")]
    public async Task<IActionResult> Edit(int id, AssignmentFormViewModel model)
    {
        var assignment = await db.Assignments.FindAsync(id);
        if (assignment is null) return NotFound();
        var ctx = await LoadCourseAsync(assignment.CourseId);
        if (!ctx!.CanManage) return Forbid();

        var highestScore = await db.Submissions.Where(s => s.AssignmentId == id && s.Score != null)
            .MaxAsync(s => s.Score);
        if (highestScore > model.MaxPoints)
            ModelState.AddModelError(nameof(model.MaxPoints), $"A submission is already graded {highestScore} points; points possible cannot be lower.");

        if (!ModelState.IsValid)
        {
            model.Id = id;
            model.CourseId = assignment.CourseId;
            return View(model);
        }

        assignment.Title = model.Title.Trim();
        assignment.Instructions = model.Instructions.Trim();
        assignment.DueDate = model.DueDate;
        assignment.MaxPoints = model.MaxPoints;
        await db.SaveChangesAsync();

        TempData["Success"] = "Assignment updated.";
        return RedirectToAction(nameof(Details), new { id });
    }

    [HttpGet, Authorize(Roles = "Instructor,Admin")]
    public async Task<IActionResult> Delete(int id)
    {
        var assignment = await db.Assignments.FindAsync(id);
        if (assignment is null) return NotFound();
        var ctx = await LoadCourseAsync(assignment.CourseId);
        if (!ctx!.CanManage) return Forbid();

        ViewBag.SubmissionCount = await db.Submissions.CountAsync(s => s.AssignmentId == id);
        return View(assignment);
    }

    [HttpPost, ActionName("Delete"), Authorize(Roles = "Instructor,Admin")]
    public async Task<IActionResult> DeleteConfirmed(int id)
    {
        var assignment = await db.Assignments.Include(a => a.Course).SingleOrDefaultAsync(a => a.Id == id);
        if (assignment is null) return NotFound();
        if (!LmsService.CanManage(assignment.Course!, User.GetUserId(), User.GetRole())) return Forbid();

        var storedFiles = await db.Submissions.Where(s => s.AssignmentId == id && s.StoredFileName != null)
            .Select(s => s.StoredFileName!).ToListAsync();
        db.Assignments.Remove(assignment);
        await db.SaveChangesAsync();
        storedFiles.ForEach(files.Delete);

        TempData["Success"] = "Assignment deleted.";
        return RedirectToAction("Assignments", "Courses", new { id = assignment.CourseId });
    }

    private async Task<CourseContext?> LoadCourseAsync(int courseId)
    {
        var ctx = await CourseContextLoader.LoadAsync(db, User, courseId, "assignments");
        ViewData["CourseContext"] = ctx;
        return ctx;
    }
}
