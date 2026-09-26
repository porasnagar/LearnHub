using LearnHub.Web.Models;
using LearnHub.Web.ViewModels;

namespace LearnHub.Web.Infrastructure;

public static class CourseQueries
{
    /// <summary>Projects courses into card view models in a single SQL query.</summary>
    public static IQueryable<CourseCardViewModel> ToCards(this IQueryable<Course> courses, int? studentId) =>
        courses.Select(c => new CourseCardViewModel
        {
            Id = c.Id,
            Code = c.Code,
            Title = c.Title,
            Description = c.Description,
            Category = c.Category,
            Credits = c.Credits,
            IsPublished = c.IsPublished,
            InstructorName = c.Instructor!.FullName,
            StudentCount = c.Enrollments.Count,
            AssignmentCount = c.Assignments.Count,
            IsEnrolled = studentId != null && c.Enrollments.Any(e => e.StudentId == studentId),
            MySubmitted = studentId == null ? 0 : c.Assignments.Count(a => a.Submissions.Any(s => s.StudentId == studentId)),
            ToGrade = c.Assignments.SelectMany(a => a.Submissions).Count(s => s.Score == null)
        });
}
