using LearnHub.Web.Models;

namespace LearnHub.Web.Api;

/// <summary>Reusable EF Core projections and mappers.</summary>
public static class Queries
{
    /// <summary>Projects courses into card DTOs in a single SQL query.</summary>
    public static IQueryable<CourseCardDto> ToCards(this IQueryable<Course> courses, int? studentId) =>
        courses.Select(c => new CourseCardDto(
            c.Id, c.Code, c.Title, c.Description, c.Category, c.Credits, c.IsPublished,
            c.Instructor!.FullName,
            c.Enrollments.Count,
            c.Assignments.Count,
            studentId != null && c.Enrollments.Any(e => e.StudentId == studentId),
            studentId == null ? 0 : c.Assignments.Count(a => a.Submissions.Any(s => s.StudentId == studentId)),
            c.Assignments.SelectMany(a => a.Submissions).Count(s => s.Score == null)));

    public static PersonDto Person(AppUser u) => new(u.Id, u.FullName, u.Email);

    /// <param name="s">Submission with Student and Assignment loaded.</param>
    public static SubmissionDto ToDto(this Submission s) => new(
        s.Id, Person(s.Student!), s.TextAnswer, s.OriginalFileName, s.SubmittedAt,
        s.Score, s.Feedback, s.GradedAt, s.Assignment is not null && s.SubmittedAt > s.Assignment.DueDate);

    /// <param name="a">Assignment with Course loaded.</param>
    public static AssignmentMiniDto Mini(this Assignment a, bool submitted = false) =>
        new(a.Id, a.Title, a.DueDate, a.MaxPoints, a.CourseId, a.Course!.Code, a.Course.Title, a.Course.Category, submitted);

    public static List<DayCount> LastSevenDays(IEnumerable<DateTime> times)
    {
        var dates = times.Select(t => t.Date).ToList();
        return Enumerable.Range(-6, 7)
            .Select(offset => DateTime.Today.AddDays(offset))
            .Select(day => new DayCount(day, dates.Count(d => d == day)))
            .ToList();
    }
}
