using System.Globalization;
using System.Text;
using LearnHub.Web.Data;
using LearnHub.Web.Models;
using LearnHub.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LearnHub.Web.Api;

/// <summary>Course announcements: instructors post, enrolled students read.</summary>
[Authorize]
public class AnnouncementsController(LmsDbContext db, LmsService lms) : ApiControllerBase
{
    [HttpGet("~/api/courses/{courseId:int}/announcements")]
    public async Task<ActionResult<List<AnnouncementDto>>> ForCourse(int courseId)
    {
        var course = await db.Courses.FindAsync(courseId);
        if (course is null) return NotFound();
        if (!CanManage(course) && !(StudentId is int sid && await db.Enrollments.AnyAsync(e => e.CourseId == courseId && e.StudentId == sid)))
            return Forbid();

        return await Map(db.Announcements.Where(a => a.CourseId == courseId)
            .OrderByDescending(a => a.IsPinned).ThenByDescending(a => a.CreatedAt));
    }

    /// <summary>Latest posts across the viewer's courses (dashboard).</summary>
    [HttpGet("feed")]
    public async Task<List<AnnouncementDto>> Feed(int take = 5)
    {
        var uid = UserId;
        var scope = Role switch
        {
            UserRole.Student => db.Announcements.Where(a => a.Course!.Enrollments.Any(e => e.StudentId == uid)),
            UserRole.Instructor => db.Announcements.Where(a => a.Course!.InstructorId == uid),
            _ => db.Announcements
        };
        return await Map(scope.OrderByDescending(a => a.CreatedAt).Take(Math.Clamp(take, 1, 20)));
    }

    [HttpPost("~/api/courses/{courseId:int}/announcements")]
    public async Task<ActionResult<AnnouncementDto>> Post(int courseId, AnnouncementRequest request)
    {
        var result = await lms.PostAnnouncementAsync(courseId, UserId, Role, request.Title, request.Body, request.IsPinned);
        if (!result.Succeeded) return Fail(result.Error);
        return (await Map(db.Announcements.Where(a => a.Id == result.Value!.Id))).Single();
    }

    [HttpPut("{id:int}/pin")]
    public async Task<IActionResult> Pin(int id, PinRequest request) =>
        FromResult(await lms.SetAnnouncementPinnedAsync(id, UserId, Role, request.IsPinned));

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id) => FromResult(await lms.DeleteAnnouncementAsync(id, UserId, Role));

    private async Task<List<AnnouncementDto>> Map(IQueryable<Announcement> query)
    {
        var list = await query.Include(a => a.Course).Include(a => a.Author).ToListAsync();
        return list.Select(a => new AnnouncementDto(a.Id, a.CourseId, a.Course!.Code, a.Course.Title, a.Title, a.Body,
            a.IsPinned, a.CreatedAt, Queries.Person(a.Author!), CanManage(a.Course))).ToList();
    }
}

/// <summary>
/// The bell: things that changed or need attention, derived from existing data (no extra table).
/// The client remembers when the user last opened the panel to count unread items.
/// </summary>
[Authorize]
public class NotificationsController(LmsDbContext db) : ApiControllerBase
{
    [HttpGet]
    public async Task<List<NotificationDto>> Get()
    {
        // Unspecified kind, like the stored dates, so every timestamp serializes the same way.
        var now = DateTime.SpecifyKind(DateTime.Now, DateTimeKind.Unspecified);
        var uid = UserId;
        var items = new List<NotificationDto>();

        if (Role == UserRole.Student)
        {
            var courseIds = await db.Enrollments.Where(e => e.StudentId == uid).Select(e => e.CourseId).ToListAsync();
            var submittedIds = (await db.Submissions.Where(s => s.StudentId == uid).Select(s => s.AssignmentId).ToListAsync()).ToHashSet();

            var graded = await db.Submissions.Include(s => s.Assignment).ThenInclude(a => a!.Course)
                .Where(s => s.StudentId == uid && s.Score != null && s.GradedAt >= now.AddDays(-14)).ToListAsync();
            items.AddRange(graded.Select(s => new NotificationDto($"g{s.Id}", "grade", $"{s.Assignment!.Title} was graded",
                $"{Score(s.Score!.Value)} / {s.Assignment.MaxPoints} · {s.Assignment.Course!.Code}", s.GradedAt!.Value,
                $"/courses/{s.Assignment.CourseId}/assignments/{s.AssignmentId}", s.Assignment.CourseId)));

            var assignments = await db.Assignments.Include(a => a.Course)
                .Where(a => courseIds.Contains(a.CourseId) && a.DueDate >= now.AddDays(-7) && a.DueDate <= now.AddHours(48)).ToListAsync();
            foreach (var a in assignments.Where(a => !submittedIds.Contains(a.Id)))
            {
                var overdue = a.DueDate < now;
                items.Add(new NotificationDto(overdue ? $"m{a.Id}" : $"d{a.Id}", overdue ? "missing" : "due",
                    overdue ? $"{a.Title} is missing" : $"{a.Title} is due {Relative(a.DueDate, now)}",
                    $"{a.Course!.Code} · {a.MaxPoints} pts", overdue ? a.DueDate : now,
                    $"/courses/{a.CourseId}/assignments/{a.Id}", a.CourseId));
            }

            var posts = await db.Announcements.Include(x => x.Course)
                .Where(x => courseIds.Contains(x.CourseId) && x.CreatedAt >= now.AddDays(-14)).ToListAsync();
            items.AddRange(posts.Select(p => new NotificationDto($"a{p.Id}", "announcement", p.Title, $"Announcement · {p.Course!.Code}",
                p.CreatedAt, $"/courses/{p.CourseId}", p.CourseId)));
        }
        else
        {
            var scope = Role == UserRole.Instructor ? db.Courses.Where(c => c.InstructorId == uid) : db.Courses;
            var ids = await scope.Select(c => c.Id).ToListAsync();

            var subs = await db.Submissions.Include(s => s.Student).Include(s => s.Assignment).ThenInclude(a => a!.Course)
                .Where(s => ids.Contains(s.Assignment!.CourseId) && s.Score == null && s.SubmittedAt >= now.AddDays(-7))
                .OrderByDescending(s => s.SubmittedAt).Take(15).ToListAsync();
            items.AddRange(subs.Select(s => new NotificationDto($"s{s.Id}", "submission", $"{s.Student!.FullName} handed in {s.Assignment!.Title}",
                $"{s.Assignment.Course!.Code} · waiting for a grade", s.SubmittedAt, $"/grade/{s.Id}", s.Assignment.CourseId)));

            var due = await db.Assignments.Include(a => a.Course)
                .Where(a => ids.Contains(a.CourseId) && a.DueDate >= now && a.DueDate <= now.AddHours(48)).ToListAsync();
            items.AddRange(due.Select(a => new NotificationDto($"d{a.Id}", "due", $"{a.Title} closes {Relative(a.DueDate, now)}",
                $"{a.Course!.Code} · {a.MaxPoints} pts", now, $"/courses/{a.CourseId}/assignments/{a.Id}", a.CourseId)));
        }

        return items.OrderByDescending(i => i.At).Take(25).ToList();
    }

    private static readonly CultureInfo Inv = CultureInfo.InvariantCulture;

    private static string Score(double s) => s.ToString(s % 1 == 0 ? "0" : "0.#", Inv);

    private static string Relative(DateTime due, DateTime now)
    {
        var h = (due - now).TotalHours;
        if (h < 1) return "within the hour";
        var time = due.ToString("h:mm tt", Inv);
        if (due.Date == now.Date) return $"today at {time}";
        if (due.Date == now.Date.AddDays(1)) return $"tomorrow at {time}";
        return $"{due.ToString("ddd", Inv)} at {time}";
    }
}

/// <summary>Command-palette search across courses, assignments and (for admins) people.</summary>
[Authorize]
public class SearchController(LmsDbContext db) : ApiControllerBase
{
    private static readonly CultureInfo Inv = CultureInfo.InvariantCulture;

    [HttpGet]
    public async Task<SearchResultDto> Get(string? q)
    {
        var term = q?.Trim() ?? "";
        if (term.Length == 0) return new SearchResultDto([], [], []);
        var pattern = $"%{term}%";
        var uid = UserId;

        IQueryable<Course> mine = Role switch
        {
            UserRole.Student => db.Courses.Where(c => c.Enrollments.Any(e => e.StudentId == uid)),
            UserRole.Instructor => db.Courses.Where(c => c.InstructorId == uid),
            _ => db.Courses
        };
        // Courses: anything published, plus the viewer's own drafts.
        var courseScope = db.Courses.Where(c => c.IsPublished || mine.Any(m => m.Id == c.Id));
        var courses = await courseScope
            .Where(c => EF.Functions.Like(c.Title, pattern) || EF.Functions.Like(c.Code, pattern) || EF.Functions.Like(c.Category, pattern))
            .OrderBy(c => c.Code).Take(6)
            .Select(c => new SearchItem(c.Id, c.Title, c.Code + " · " + c.Category, "/courses/" + c.Id, c.Id))
            .ToListAsync();

        var assignments = (await db.Assignments.Include(a => a.Course)
            .Where(a => mine.Any(m => m.Id == a.CourseId) && (EF.Functions.Like(a.Title, pattern) || EF.Functions.Like(a.Course!.Code, pattern)))
            .OrderBy(a => a.DueDate).Take(8).ToListAsync())
            .Select(a => new SearchItem(a.Id, a.Title, $"{a.Course!.Code} · due {a.DueDate.ToString("MMM d", Inv)}", $"/courses/{a.CourseId}/assignments/{a.Id}", a.CourseId))
            .ToList();

        var people = Role == UserRole.Admin
            ? await db.Users.Where(u => EF.Functions.Like(u.FullName, pattern) || EF.Functions.Like(u.Email, pattern))
                .OrderBy(u => u.FullName).Take(5)
                .Select(u => new SearchItem(u.Id, u.FullName, u.Role.ToString() + " · " + u.Email, "/admin", null)).ToListAsync()
            : [];

        return new SearchResultDto(courses, assignments, people);
    }
}

/// <summary>Due dates as an iCalendar file, for Google Calendar / Apple Calendar / Outlook.</summary>
[Authorize]
[Route("api/calendar")]
public class CalendarExportController(LmsDbContext db) : ApiControllerBase
{
    [HttpGet("export.ics")]
    public async Task<IActionResult> Export()
    {
        var uid = UserId;
        var courses = Role switch
        {
            UserRole.Student => db.Courses.Where(c => c.Enrollments.Any(e => e.StudentId == uid)),
            UserRole.Instructor => db.Courses.Where(c => c.InstructorId == uid),
            _ => db.Courses
        };
        var items = await db.Assignments.Include(a => a.Course)
            .Where(a => courses.Any(c => c.Id == a.CourseId)).OrderBy(a => a.DueDate).ToListAsync();
        var submitted = Role == UserRole.Student
            ? (await db.Submissions.Where(s => s.StudentId == uid).Select(s => s.AssignmentId).ToListAsync()).ToHashSet()
            : [];

        var origin = $"{Request.Scheme}://{Request.Host}";
        var sb = new StringBuilder();
        void Line(string s) => sb.Append(Fold(s)).Append("\r\n");
        Line("BEGIN:VCALENDAR");
        Line("VERSION:2.0");
        Line("PRODID:-//LearnHub//Due dates//EN");
        Line("CALSCALE:GREGORIAN");
        Line("METHOD:PUBLISH");
        Line("X-WR-CALNAME:LearnHub due dates");
        var stamp = DateTime.UtcNow.ToString("yyyyMMdd'T'HHmmss'Z'", CultureInfo.InvariantCulture);
        foreach (var a in items)
        {
            // Floating local time: the deadline shows at the same clock time the course set.
            Line("BEGIN:VEVENT");
            Line($"UID:learnhub-assignment-{a.Id}@{Request.Host.Host}");
            Line($"DTSTAMP:{stamp}");
            Line("DTSTART:" + a.DueDate.AddMinutes(-30).ToString("yyyyMMdd'T'HHmmss", CultureInfo.InvariantCulture));
            Line("DTEND:" + a.DueDate.ToString("yyyyMMdd'T'HHmmss", CultureInfo.InvariantCulture));
            Line($"SUMMARY:{Escape($"{a.Course!.Code}: {a.Title} (due)" + (submitted.Contains(a.Id) ? " ✓" : ""))}");
            Line($"DESCRIPTION:{Escape($"{a.MaxPoints} points · {a.Course.Title}\n{origin}/courses/{a.CourseId}/assignments/{a.Id}")}");
            Line($"URL:{origin}/courses/{a.CourseId}/assignments/{a.Id}");
            Line("BEGIN:VALARM");
            Line("TRIGGER:-PT24H");
            Line("ACTION:DISPLAY");
            Line($"DESCRIPTION:{Escape($"{a.Title} is due tomorrow")}");
            Line("END:VALARM");
            Line("END:VEVENT");
        }
        Line("END:VCALENDAR");

        return File(Encoding.UTF8.GetBytes(sb.ToString()), "text/calendar; charset=utf-8", "learnhub-due-dates.ics");
    }

    private static string Escape(string s) =>
        s.Replace("\\", "\\\\").Replace(";", "\\;").Replace(",", "\\,").Replace("\r", "").Replace("\n", "\\n");

    /// <summary>RFC 5545 line folding: lines longer than 75 octets continue on the next line after a space.</summary>
    private static string Fold(string line)
    {
        var bytes = Encoding.UTF8.GetBytes(line);
        if (bytes.Length <= 75) return line;
        var sb = new StringBuilder();
        var count = 0;
        foreach (var ch in line)
        {
            var n = Encoding.UTF8.GetByteCount(ch.ToString());
            if (count + n > 74) { sb.Append("\r\n "); count = 1; }
            sb.Append(ch);
            count += n;
        }
        return sb.ToString();
    }
}
