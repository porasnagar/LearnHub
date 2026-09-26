using LearnHub.Web.Data;
using LearnHub.Web.Models;
using LearnHub.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LearnHub.Web.Api;

[Authorize]
public class AssignmentsController(LmsDbContext db, LmsService lms, FileStorageService files) : ApiControllerBase
{
    [HttpGet("{id:int}")]
    public async Task<ActionResult<AssignmentDetailDto>> Get(int id)
    {
        var a = await db.Assignments.Include(x => x.Course).SingleOrDefaultAsync(x => x.Id == id);
        if (a is null) return NotFound();

        var manage = CanManage(a.Course!);
        SubmissionDto? mine = null;
        var rows = new List<SubmissionRowDto>();

        if (manage)
        {
            var submissions = await db.Submissions.Include(s => s.Student)
                .Where(s => s.AssignmentId == id).ToDictionaryAsync(s => s.StudentId);
            foreach (var s in submissions.Values) s.Assignment = a;
            var enrolled = await db.Enrollments.Where(e => e.CourseId == a.CourseId).Select(e => e.Student!).ToListAsync();

            rows = enrolled.Select(st => new SubmissionRowDto(Queries.Person(st), submissions.GetValueOrDefault(st.Id)?.ToDto(), true))
                .Concat(submissions.Values.Where(s => enrolled.All(e => e.Id != s.StudentId))
                    .Select(s => new SubmissionRowDto(Queries.Person(s.Student!), s.ToDto(), false)))
                .OrderBy(r => r.Submission is null ? 1 : r.Submission.Score is null ? 0 : 2)
                .ThenBy(r => r.Student.FullName)
                .ToList();
        }
        else if (StudentId is int sid && await lms.IsEnrolledAsync(a.CourseId, sid))
        {
            var s = await db.Submissions.Include(x => x.Student).SingleOrDefaultAsync(x => x.AssignmentId == id && x.StudentId == sid);
            if (s is not null) { s.Assignment = a; mine = s.ToDto(); }
        }
        else
        {
            return Forbid();
        }

        return new AssignmentDetailDto(a.Id, a.CourseId, a.Title, a.Instructions, a.DueDate, a.MaxPoints,
            manage, mine, rows, files.AllowedExtensionsText, files.MaxFileSizeMB);
    }

    /// <summary>Student hands in (or replaces) their work: multipart form with optional text and file.</summary>
    [Authorize(Roles = nameof(UserRole.Student)), HttpPost("{id:int}/submit")]
    [RequestSizeLimit(64 * 1024 * 1024)]
    public async Task<IActionResult> Submit(int id, [FromForm] string? textAnswer, IFormFile? attachment)
    {
        string? storedName = null;
        if (attachment is { Length: > 0 })
        {
            var error = files.Validate(attachment);
            if (error is not null) return Fail(error);
            storedName = await files.SaveAsync(attachment);
        }

        var result = await lms.SubmitAsync(id, UserId, textAnswer, storedName,
            attachment is null ? null : Path.GetFileName(attachment.FileName));
        if (!result.Succeeded)
        {
            files.Delete(storedName);
            return Fail(result.Error);
        }
        files.Delete(result.Value); // previous attachment that was replaced
        return NoContent();
    }

    /// <param name="id">Submission id.</param>
    [HttpGet("download/{id:int}")]
    public async Task<IActionResult> Download(int id)
    {
        var s = await db.Submissions.Include(x => x.Assignment).ThenInclude(a => a!.Course).SingleOrDefaultAsync(x => x.Id == id);
        if (s?.StoredFileName is null) return NotFound();
        if (s.StudentId != UserId && !CanManage(s.Assignment!.Course!)) return Forbid();

        var stream = files.OpenRead(s.StoredFileName);
        return stream is null ? NotFound() : File(stream, "application/octet-stream", s.OriginalFileName ?? s.StoredFileName);
    }

    [Authorize(Roles = "Instructor,Admin"), HttpPost]
    public async Task<ActionResult<int>> Create(AssignmentFormDto form)
    {
        var course = await db.Courses.FindAsync(form.CourseId);
        if (course is null) return NotFound();
        if (!CanManage(course)) return Forbid();

        var a = new Assignment
        {
            CourseId = course.Id, Title = form.Title.Trim(), Instructions = form.Instructions.Trim(),
            DueDate = form.DueDate, MaxPoints = form.MaxPoints
        };
        db.Assignments.Add(a);
        await db.SaveChangesAsync();
        return a.Id;
    }

    [Authorize(Roles = "Instructor,Admin"), HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, AssignmentFormDto form)
    {
        var a = await db.Assignments.Include(x => x.Course).SingleOrDefaultAsync(x => x.Id == id);
        if (a is null) return NotFound();
        if (!CanManage(a.Course!)) return Forbid();

        var highest = await db.Submissions.Where(s => s.AssignmentId == id && s.Score != null).MaxAsync(s => s.Score);
        if (highest > form.MaxPoints)
            return Fail($"A submission is already graded {highest} points; points possible cannot be lower.");

        a.Title = form.Title.Trim();
        a.Instructions = form.Instructions.Trim();
        a.DueDate = form.DueDate;
        a.MaxPoints = form.MaxPoints;
        await db.SaveChangesAsync();
        return NoContent();
    }

    [Authorize(Roles = "Instructor,Admin"), HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var a = await db.Assignments.Include(x => x.Course).SingleOrDefaultAsync(x => x.Id == id);
        if (a is null) return NotFound();
        if (!CanManage(a.Course!)) return Forbid();

        var storedFiles = await db.Submissions.Where(s => s.AssignmentId == id && s.StoredFileName != null)
            .Select(s => s.StoredFileName!).ToListAsync();
        db.Assignments.Remove(a);
        await db.SaveChangesAsync();
        storedFiles.ForEach(files.Delete);
        return NoContent();
    }
}

/// <summary>Grading screen: one submission at a time with a queue for previous / next.</summary>
[Authorize(Roles = "Instructor,Admin")]
public class SubmissionsController(LmsDbContext db, LmsService lms) : ApiControllerBase
{
    [HttpGet("{id:int}")]
    public async Task<ActionResult<GradingDto>> Get(int id)
    {
        var s = await db.Submissions.Include(x => x.Student).Include(x => x.Assignment).ThenInclude(a => a!.Course)
            .SingleOrDefaultAsync(x => x.Id == id);
        if (s is null) return NotFound();
        if (!CanManage(s.Assignment!.Course!)) return Forbid();

        var a = s.Assignment;
        return new GradingDto(s.ToDto(), a.Id, a.Title, a.MaxPoints, a.DueDate, a.CourseId, a.Course!.Code, await QueueAsync(a.Id));
    }

    [HttpPost("{id:int}/grade")]
    public async Task<ActionResult<GradeResult>> Grade(int id, GradeRequest request)
    {
        var result = await lms.GradeAsync(id, UserId, Role, request.Score, request.Feedback);
        if (!result.Succeeded) return Fail(result.Error);

        var assignmentId = await db.Submissions.Where(s => s.Id == id).Select(s => s.AssignmentId).SingleAsync();
        var queue = await QueueAsync(assignmentId);
        // Next ungraded submission after this one, wrapping around to the start.
        var next = queue.SkipWhile(q => q.SubmissionId != id).Skip(1)
            .Concat(queue.TakeWhile(q => q.SubmissionId != id))
            .FirstOrDefault(q => !q.IsGraded);
        return new GradeResult(next?.SubmissionId, assignmentId);
    }

    private Task<List<GradeQueueItem>> QueueAsync(int assignmentId) =>
        db.Submissions.Where(s => s.AssignmentId == assignmentId)
            .OrderBy(s => s.Student!.FullName)
            .Select(s => new GradeQueueItem(s.Id, s.Student!.FullName, s.Score != null))
            .ToListAsync();
}
