using LearnHub.Web.Data;
using LearnHub.Web.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LearnHub.Web.Api;

[Authorize]
public class DashboardController(LmsDbContext db) : ApiControllerBase
{
    [HttpGet]
    public Task<DashboardDto> Get() => Role switch
    {
        UserRole.Student => StudentAsync(UserId),
        UserRole.Instructor => StaffAsync(db.Courses.Where(c => c.InstructorId == UserId)),
        _ => StaffAsync(db.Courses)
    };

    private async Task<DashboardDto> StudentAsync(int uid)
    {
        var now = DateTime.Now;
        var today = DateTime.Today;
        var courseIds = await db.Enrollments.Where(e => e.StudentId == uid).Select(e => e.CourseId).ToListAsync();
        var courses = await db.Courses.Where(c => courseIds.Contains(c.Id)).OrderBy(c => c.Code).ToCards(uid).ToListAsync();

        var assignments = await db.Assignments.Include(a => a.Course)
            .Where(a => courseIds.Contains(a.CourseId)).OrderBy(a => a.DueDate).ToListAsync();
        var submissions = await db.Submissions
            .Include(s => s.Assignment).ThenInclude(a => a!.Course).ThenInclude(c => c!.Instructor)
            .Where(s => s.StudentId == uid).ToListAsync();

        var submitted = submissions.Select(s => s.AssignmentId).ToHashSet();
        var open = assignments.Where(a => !submitted.Contains(a.Id)).ToList();
        var graded = submissions.Where(s => s.Score.HasValue).ToList();

        return Blank(UserRole.Student, courses) with
        {
            Activity = Queries.LastSevenDays(submissions.Select(s => s.SubmittedAt)),
            NextUp = open.FirstOrDefault(a => a.DueDate >= now)?.Mini(),
            Week = assignments.Where(a => a.DueDate >= today && a.DueDate < today.AddDays(7))
                .Select(a => a.Mini(submitted.Contains(a.Id))).ToList(),
            Missing = open.Where(a => a.DueDate < now).Select(a => a.Mini()).ToList(),
            RecentGrades = graded.OrderByDescending(s => s.GradedAt).Take(4).Select(s => new FeedbackDto(
                s.Id, s.AssignmentId, s.Assignment!.Title, s.Assignment.CourseId, s.Assignment.Course!.Code,
                s.Score!.Value, s.Assignment.MaxPoints, s.Feedback, s.GradedAt, s.Assignment.Course.Instructor!.FullName)).ToList(),
            GradedCount = graded.Count,
            AwaitingCount = submissions.Count - graded.Count,
            UpcomingCount = open.Count(a => a.DueDate >= now),
            Earned = graded.Sum(s => s.Score!.Value),
            Possible = graded.Sum(s => s.Assignment!.MaxPoints)
        };
    }

    /// <summary>Instructors see their own courses; admins see every course.</summary>
    private async Task<DashboardDto> StaffAsync(IQueryable<Course> scope)
    {
        var today = DateTime.Today;
        var courses = await scope.OrderBy(c => c.Code).ToCards(null).ToListAsync();
        var ids = courses.Select(c => c.Id).ToList();

        var pendingQuery = db.Submissions.Where(s => s.Score == null && ids.Contains(s.Assignment!.CourseId));
        var pending = await pendingQuery.OrderBy(s => s.SubmittedAt).Take(6)
            .Select(s => new PendingDto(s.Id, s.Student!.FullName, s.AssignmentId, s.Assignment!.Title,
                s.Assignment.CourseId, s.Assignment.Course!.Code, s.SubmittedAt, s.SubmittedAt > s.Assignment.DueDate))
            .ToListAsync();

        var recent = await db.Assignments.Include(a => a.Course)
            .Where(a => ids.Contains(a.CourseId) && a.DueDate >= today.AddDays(-10) && a.DueDate <= today.AddDays(14))
            .OrderBy(a => a.DueDate).Take(5).ToListAsync();
        var recentIds = recent.Select(a => a.Id).ToList();
        var counts = await db.Submissions.Where(s => recentIds.Contains(s.AssignmentId))
            .GroupBy(s => s.AssignmentId).Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count);
        var enrolled = courses.ToDictionary(c => c.Id, c => c.StudentCount);

        var dto = Blank(Role, courses) with
        {
            Activity = Queries.LastSevenDays(await db.Submissions
                .Where(s => ids.Contains(s.Assignment!.CourseId) && s.SubmittedAt >= today.AddDays(-6))
                .Select(s => s.SubmittedAt).ToListAsync()),
            Week = (await db.Assignments.Include(a => a.Course)
                .Where(a => ids.Contains(a.CourseId) && a.DueDate >= today && a.DueDate < today.AddDays(7))
                .OrderBy(a => a.DueDate).ToListAsync()).Select(a => a.Mini()).ToList(),
            PendingGrading = pending,
            PendingTotal = await pendingQuery.CountAsync(),
            Completion = recent.Select(a => new CompletionDto(a.Mini(), counts.GetValueOrDefault(a.Id), enrolled.GetValueOrDefault(a.CourseId))).ToList()
        };

        if (Role == UserRole.Admin)
        {
            dto = dto with
            {
                RecentUsers = (await db.Users.OrderByDescending(u => u.CreatedAt).Take(6).ToListAsync()).Select(UserDto.From).ToList(),
                Figures = new()
                {
                    ["users"] = await db.Users.CountAsync(),
                    ["courses"] = courses.Count,
                    ["enrollments"] = await db.Enrollments.CountAsync(),
                    ["submissions"] = await db.Submissions.CountAsync()
                }
            };
        }
        else
        {
            dto = dto with
            {
                Figures = new()
                {
                    ["courses"] = courses.Count,
                    ["students"] = courses.Sum(c => c.StudentCount),
                    ["assignments"] = courses.Sum(c => c.AssignmentCount),
                    ["toGrade"] = dto.PendingTotal
                }
            };
        }
        return dto;
    }

    private static DashboardDto Blank(UserRole role, List<CourseCardDto> courses) =>
        new(role, courses, [], null, [], [], [], 0, 0, 0, 0, 0, [], 0, [], [], []);
}

[Authorize]
public class CalendarController(LmsDbContext db) : ApiControllerBase
{
    /// <summary>Assignment due dates between two dates across the viewer's courses.</summary>
    [HttpGet]
    public async Task<CalendarDto> Get(DateTime from, DateTime to)
    {
        var uid = UserId;
        var courses = Role switch
        {
            UserRole.Student => db.Courses.Where(c => c.Enrollments.Any(e => e.StudentId == uid)),
            UserRole.Instructor => db.Courses.Where(c => c.InstructorId == uid),
            _ => db.Courses
        };
        var list = await courses.OrderBy(c => c.Code).Select(c => new CalendarCourseDto(c.Id, c.Code, c.Title)).ToListAsync();
        var ids = list.Select(c => c.Id).ToList();

        var submitted = Role == UserRole.Student
            ? (await db.Submissions.Where(s => s.StudentId == uid).Select(s => s.AssignmentId).ToListAsync()).ToHashSet()
            : [];
        var items = await db.Assignments.Include(a => a.Course)
            .Where(a => ids.Contains(a.CourseId) && a.DueDate >= from && a.DueDate < to)
            .OrderBy(a => a.DueDate).ToListAsync();

        return new CalendarDto(list, items.Select(a => a.Mini(submitted.Contains(a.Id))).ToList());
    }
}

[Authorize(Roles = nameof(UserRole.Student))]
public class GradesController(LmsDbContext db) : ApiControllerBase
{
    /// <summary>The student's current grade in each enrolled course.</summary>
    [HttpGet]
    public async Task<List<CourseGradeDto>> Get()
    {
        var uid = UserId;
        var courses = await db.Courses.Where(c => c.Enrollments.Any(e => e.StudentId == uid)).OrderBy(c => c.Code)
            .Select(c => new { c.Id, c.Code, c.Title, Instructor = c.Instructor!.FullName, Count = c.Assignments.Count })
            .ToListAsync();
        var graded = await db.Submissions.Include(s => s.Assignment)
            .Where(s => s.StudentId == uid && s.Score != null).ToListAsync();

        return courses.Select(c =>
        {
            var mine = graded.Where(s => s.Assignment!.CourseId == c.Id).ToList();
            return new CourseGradeDto(c.Id, c.Code, c.Title, c.Instructor, c.Count, mine.Count,
                mine.Sum(s => s.Score!.Value), mine.Sum(s => s.Assignment!.MaxPoints));
        }).ToList();
    }
}
