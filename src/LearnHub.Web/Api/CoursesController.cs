using System.Text;
using LearnHub.Web.Data;
using LearnHub.Web.Models;
using LearnHub.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LearnHub.Web.Api;

[Authorize]
public class CoursesController(LmsDbContext db, LmsService lms, FileStorageService files) : ApiControllerBase
{
    // ---------- Public catalog ----------

    [AllowAnonymous, HttpGet("catalog")]
    public async Task<CatalogDto> Catalog(string? q, string? category)
    {
        var published = db.Courses.Where(c => c.IsPublished);
        var query = published;
        if (!string.IsNullOrWhiteSpace(q))
        {
            var pattern = $"%{q.Trim()}%";
            query = query.Where(c => EF.Functions.Like(c.Title, pattern) || EF.Functions.Like(c.Code, pattern)
                                     || EF.Functions.Like(c.Description, pattern) || EF.Functions.Like(c.Category, pattern));
        }
        if (!string.IsNullOrWhiteSpace(category)) query = query.Where(c => c.Category == category);

        return new CatalogDto(
            await published.CountAsync(),
            await published.GroupBy(c => c.Category).OrderByDescending(g => g.Count()).ThenBy(g => g.Key)
                .Select(g => new SubjectCount(g.Key, g.Count())).ToListAsync(),
            await query.OrderBy(c => c.Code).ToCards(StudentId).ToListAsync());
    }

    [HttpGet("mine")]
    public async Task<List<CourseCardDto>> Mine()
    {
        var uid = UserId;
        var query = Role switch
        {
            UserRole.Student => db.Courses.Where(c => c.Enrollments.Any(e => e.StudentId == uid)),
            UserRole.Instructor => db.Courses.Where(c => c.InstructorId == uid),
            _ => db.Courses
        };
        return await query.OrderBy(c => c.Code).ToCards(StudentId).ToListAsync();
    }

    [HttpGet("categories")]
    public Task<List<string>> Categories() => db.Courses.Select(c => c.Category).Distinct().OrderBy(c => c).ToListAsync();

    // ---------- One course ----------

    [AllowAnonymous, HttpGet("{id:int}")]
    public async Task<ActionResult<CourseDetailDto>> Get(int id)
    {
        var course = await db.Courses.Include(c => c.Instructor).SingleOrDefaultAsync(c => c.Id == id);
        if (course is null || (!course.IsPublished && !CanManage(course))) return NotFound();
        return await DetailAsync(course);
    }

    [HttpGet("{id:int}/assignments")]
    public async Task<ActionResult<List<AssignmentRowDto>>> Assignments(int id)
    {
        var course = await db.Courses.FindAsync(id);
        if (course is null) return NotFound();
        if (!await CanSeeContentAsync(course)) return Forbid();

        var rows = await db.Assignments.Where(a => a.CourseId == id).OrderBy(a => a.DueDate)
            .Select(a => new
            {
                a.Id, a.CourseId, a.Title, a.DueDate, a.MaxPoints,
                Count = a.Submissions.Count,
                Ungraded = a.Submissions.Count(s => s.Score == null)
            }).ToListAsync();

        var mine = StudentId is int sid
            ? await db.Submissions.Where(s => s.StudentId == sid && s.Assignment!.CourseId == id)
                .ToDictionaryAsync(s => s.AssignmentId)
            : [];

        return rows.Select(r =>
        {
            var s = mine.GetValueOrDefault(r.Id);
            return new AssignmentRowDto(r.Id, r.CourseId, r.Title, r.DueDate, r.MaxPoints, r.Count, r.Ungraded,
                s is null ? null : new MySubmissionDto(s.Id, s.SubmittedAt, s.Score, s.SubmittedAt > r.DueDate, !string.IsNullOrEmpty(s.Feedback)));
        }).ToList();
    }

    [HttpGet("{id:int}/gradebook")]
    public async Task<ActionResult<GradebookDto>> Gradebook(int id)
    {
        var course = await db.Courses.FindAsync(id);
        if (course is null) return NotFound();
        if (!CanManage(course)) return Forbid();
        return await BuildGradebookAsync(id);
    }

    [HttpGet("{id:int}/gradebook.csv")]
    public async Task<IActionResult> ExportGradebook(int id)
    {
        var course = await db.Courses.FindAsync(id);
        if (course is null) return NotFound();
        if (!CanManage(course)) return Forbid();

        var book = await BuildGradebookAsync(id);
        static string Csv(string v) => v.IndexOfAny([',', '"', '\n', '\r']) >= 0 ? "\"" + v.Replace("\"", "\"\"") + "\"" : v;

        var csv = new StringBuilder();
        csv.AppendLine(string.Join(",", new[] { "Student", "Email" }
            .Concat(book.Assignments.Select(a => Csv($"{a.Title} ({a.MaxPoints})")))
            .Concat(["Points earned", "Points possible", "Percent"])));
        foreach (var row in book.Rows)
        {
            var cells = new List<string> { Csv(row.Student.FullName), Csv(row.Student.Email) };
            cells.AddRange(book.Assignments.Select(a => row.Cells.GetValueOrDefault(a.Id)?.Score?.ToString("0.##") ?? ""));
            cells.Add(row.Earned.ToString("0.##"));
            cells.Add(row.Possible.ToString());
            cells.Add(row.Possible == 0 ? "" : (row.Earned / row.Possible * 100).ToString("0.0"));
            csv.AppendLine(string.Join(",", cells));
        }
        var bytes = Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(csv.ToString())).ToArray();
        return File(bytes, "text/csv", $"{course.Code}-gradebook-{DateTime.Now:yyyyMMdd}.csv");
    }

    [HttpGet("{id:int}/roster")]
    public async Task<ActionResult<List<RosterRowDto>>> Roster(int id)
    {
        var course = await db.Courses.FindAsync(id);
        if (course is null) return NotFound();
        if (!CanManage(course)) return Forbid();

        return await db.Enrollments.Where(e => e.CourseId == id)
            .OrderBy(e => e.Student!.FullName)
            .Select(e => new RosterRowDto(
                new PersonDto(e.StudentId, e.Student!.FullName, e.Student.Email),
                e.EnrolledAt,
                e.Student.Submissions.Count(s => s.Assignment!.CourseId == id),
                e.Student.Submissions.Count(s => s.Assignment!.CourseId == id && s.Score != null)))
            .ToListAsync();
    }

    // ---------- Enrollment ----------

    [Authorize(Roles = nameof(UserRole.Student)), HttpPost("{id:int}/enroll")]
    public async Task<IActionResult> Enroll(int id) => FromResult(await lms.EnrollAsync(id, UserId));

    [Authorize(Roles = nameof(UserRole.Student)), HttpDelete("{id:int}/enroll")]
    public async Task<IActionResult> Unenroll(int id) => FromResult(await lms.UnenrollAsync(id, UserId));

    [Authorize(Roles = "Instructor,Admin"), HttpDelete("{id:int}/students/{studentId:int}")]
    public async Task<IActionResult> RemoveStudent(int id, int studentId)
    {
        var course = await db.Courses.FindAsync(id);
        if (course is null) return NotFound();
        if (!CanManage(course)) return Forbid();
        return FromResult(await lms.UnenrollAsync(id, studentId));
    }

    // ---------- Create / update / delete ----------

    [Authorize(Roles = "Instructor,Admin"), HttpPost]
    public async Task<ActionResult<CourseDetailDto>> Create(CourseFormDto form)
    {
        var error = await ValidateAsync(form, null);
        if (error is not null) return Fail(error);

        var course = new Course { InstructorId = UserId };
        Apply(form, course);
        db.Courses.Add(course);
        await db.SaveChangesAsync();
        await db.Entry(course).Reference(c => c.Instructor).LoadAsync();
        return await DetailAsync(course);
    }

    [Authorize(Roles = "Instructor,Admin"), HttpPut("{id:int}")]
    public async Task<ActionResult<CourseDetailDto>> Update(int id, CourseFormDto form)
    {
        var course = await db.Courses.FindAsync(id);
        if (course is null) return NotFound();
        if (!CanManage(course)) return Forbid();

        var error = await ValidateAsync(form, id);
        if (error is not null) return Fail(error);

        Apply(form, course);
        await db.SaveChangesAsync();
        await db.Entry(course).Reference(c => c.Instructor).LoadAsync();
        return await DetailAsync(course);
    }

    [Authorize(Roles = "Instructor,Admin"), HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var course = await db.Courses.FindAsync(id);
        if (course is null) return NotFound();
        if (!CanManage(course)) return Forbid();

        var storedFiles = await db.Submissions
            .Where(s => s.Assignment!.CourseId == id && s.StoredFileName != null)
            .Select(s => s.StoredFileName!).ToListAsync();
        db.Courses.Remove(course); // enrollments, assignments and submissions cascade
        await db.SaveChangesAsync();
        storedFiles.ForEach(files.Delete);
        return NoContent();
    }

    // ---------- Helpers ----------

    private async Task<bool> CanSeeContentAsync(Course course) =>
        CanManage(course) || (StudentId is int sid && await lms.IsEnrolledAsync(course.Id, sid));

    private async Task<CourseDetailDto> DetailAsync(Course course)
    {
        var isEnrolled = StudentId is int sid && await lms.IsEnrolledAsync(course.Id, sid);
        return new CourseDetailDto(
            course.Id, course.Code, course.Title, course.Description, course.Category, course.Credits, course.IsPublished, course.CreatedAt,
            Queries.Person(course.Instructor!),
            await db.Enrollments.CountAsync(e => e.CourseId == course.Id),
            await db.Assignments.CountAsync(a => a.CourseId == course.Id),
            StudentId.HasValue, isEnrolled, CanManage(course));
    }

    private async Task<GradebookDto> BuildGradebookAsync(int courseId)
    {
        var assignments = (await Assignments(courseId)).Value!;
        var students = await db.Enrollments.Where(e => e.CourseId == courseId)
            .Select(e => e.Student!).OrderBy(s => s.FullName).ToListAsync();
        var submissions = await db.Submissions.Include(s => s.Assignment)
            .Where(s => s.Assignment!.CourseId == courseId).ToListAsync();
        var byStudent = submissions.GroupBy(s => s.StudentId).ToDictionary(g => g.Key, g => g.ToList());

        var rows = students.Select(st =>
        {
            var subs = byStudent.GetValueOrDefault(st.Id) ?? [];
            var graded = subs.Where(s => s.Score.HasValue).ToList();
            return new GradebookRowDto(
                Queries.Person(st),
                subs.ToDictionary(s => s.AssignmentId, s => new GradebookCellDto(s.Id, s.Score, s.SubmittedAt > s.Assignment!.DueDate)),
                graded.Sum(s => s.Score!.Value),
                graded.Sum(s => s.Assignment!.MaxPoints));
        }).ToList();
        return new GradebookDto(assignments, rows);
    }

    private async Task<string?> ValidateAsync(CourseFormDto form, int? id)
    {
        var code = form.Code.Trim().ToUpperInvariant();
        if (await db.Courses.AnyAsync(c => c.Code == code && c.Id != id))
            return "Another course already uses this code.";
        if (Role == UserRole.Admin && (form.InstructorId is null
            || !await db.Users.AnyAsync(u => u.Id == form.InstructorId && u.Role == UserRole.Instructor)))
            return "Choose an instructor for this course.";
        return null;
    }

    private void Apply(CourseFormDto form, Course course)
    {
        course.Code = form.Code.Trim().ToUpperInvariant();
        course.Title = form.Title.Trim();
        course.Description = form.Description.Trim();
        course.Category = form.Category.Trim();
        course.Credits = form.Credits;
        course.IsPublished = form.IsPublished;
        // Only an admin can assign a course to a different instructor.
        if (Role == UserRole.Admin && form.InstructorId.HasValue) course.InstructorId = form.InstructorId.Value;
    }
}
