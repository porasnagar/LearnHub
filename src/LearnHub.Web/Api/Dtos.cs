using System.ComponentModel.DataAnnotations;
using LearnHub.Web.Models;

namespace LearnHub.Web.Api;

// JSON contracts between the ASP.NET Core API and the Angular client (serialized as camelCase).

public record ApiError(string Message);

// ---------- Auth ----------

public record UserDto(int Id, string FullName, string Email, UserRole Role, DateTime CreatedAt)
{
    public static UserDto From(AppUser u) => new(u.Id, u.FullName, u.Email, u.Role, u.CreatedAt);
}

public record LoginRequest([Required, EmailAddress] string Email, [Required] string Password, bool RememberMe);

public record RegisterRequest(
    [Required, StringLength(100, MinimumLength = 2)] string FullName,
    [Required, EmailAddress, StringLength(256)] string Email,
    [Required, StringLength(100, MinimumLength = 6)] string Password,
    UserRole Role);

public record ChangePasswordRequest([Required] string CurrentPassword, [Required, StringLength(100, MinimumLength = 6)] string NewPassword);

public record ProfileDto(UserDto User, int CourseCount, int SubmissionCount);

// ---------- Courses ----------

public record SubjectCount(string Name, int Count);

public record CourseCardDto(
    int Id, string Code, string Title, string Description, string Category, int Credits, bool IsPublished,
    string InstructorName, int StudentCount, int AssignmentCount, bool IsEnrolled, int MySubmitted, int ToGrade);

public record CatalogDto(int TotalPublished, List<SubjectCount> Subjects, List<CourseCardDto> Courses);

public record PersonDto(int Id, string FullName, string Email);

public record CourseDetailDto(
    int Id, string Code, string Title, string Description, string Category, int Credits, bool IsPublished, DateTime CreatedAt,
    PersonDto Instructor, int StudentCount, int AssignmentCount,
    bool IsStudent, bool IsEnrolled, bool CanManage);

public record MySubmissionDto(int Id, DateTime SubmittedAt, double? Score, bool IsLate, bool HasFeedback);

public record AssignmentRowDto(
    int Id, int CourseId, string Title, DateTime DueDate, int MaxPoints,
    int SubmissionCount, int UngradedCount, MySubmissionDto? MySubmission);

public record GradebookCellDto(int SubmissionId, double? Score, bool IsLate);

public record GradebookRowDto(PersonDto Student, Dictionary<int, GradebookCellDto> Cells, double Earned, int Possible);

public record GradebookDto(List<AssignmentRowDto> Assignments, List<GradebookRowDto> Rows);

public record RosterRowDto(PersonDto Student, DateTime EnrolledAt, int Submitted, int Graded);

public record CourseFormDto(
    [Required, StringLength(20), RegularExpression(@"^[A-Za-z0-9\-]+$", ErrorMessage = "Use letters, digits and hyphens only.")] string Code,
    [Required, StringLength(150)] string Title,
    [Required, StringLength(4000)] string Description,
    [Required, StringLength(50)] string Category,
    [Range(1, 10)] int Credits,
    bool IsPublished,
    int? InstructorId);

// ---------- Assignments & submissions ----------

public record AssignmentFormDto(
    int CourseId,
    [Required, StringLength(150)] string Title,
    [Required, StringLength(4000)] string Instructions,
    DateTime DueDate,
    [Range(1, 1000)] int MaxPoints);

public record SubmissionDto(
    int Id, PersonDto Student, string? TextAnswer, string? OriginalFileName, DateTime SubmittedAt,
    double? Score, string? Feedback, DateTime? GradedAt, bool IsLate);

public record SubmissionRowDto(PersonDto Student, SubmissionDto? Submission, bool StillEnrolled);

public record AssignmentDetailDto(
    int Id, int CourseId, string Title, string Instructions, DateTime DueDate, int MaxPoints,
    bool CanManage, SubmissionDto? MySubmission, List<SubmissionRowDto> Rows,
    string AllowedExtensions, int MaxFileSizeMB);

public record GradeQueueItem(int SubmissionId, string StudentName, bool IsGraded);

public record GradingDto(
    SubmissionDto Submission, int AssignmentId, string AssignmentTitle, int MaxPoints, DateTime DueDate,
    int CourseId, string CourseCode, List<GradeQueueItem> Queue);

public record GradeRequest([Range(0, 1000)] double Score, [StringLength(2000)] string? Feedback);

public record GradeResult(int? NextSubmissionId, int AssignmentId);

// ---------- Dashboard, calendar, grades, admin ----------

public record AssignmentMiniDto(int Id, string Title, DateTime DueDate, int MaxPoints, int CourseId, string CourseCode, string CourseTitle, string CourseCategory, bool Submitted);

public record FeedbackDto(int SubmissionId, int AssignmentId, string AssignmentTitle, int CourseId, string CourseCode,
    double Score, int MaxPoints, string? Feedback, DateTime? GradedAt, string InstructorName);

public record PendingDto(int SubmissionId, string StudentName, int AssignmentId, string AssignmentTitle,
    int CourseId, string CourseCode, DateTime SubmittedAt, bool IsLate);

public record DayCount(DateTime Day, int Count);

public record CompletionDto(AssignmentMiniDto Assignment, int Submitted, int Enrolled);

public record DashboardDto(
    UserRole Role,
    List<CourseCardDto> Courses,
    List<DayCount> Activity,
    // student
    AssignmentMiniDto? NextUp,
    List<AssignmentMiniDto> Week,
    List<AssignmentMiniDto> Missing,
    List<FeedbackDto> RecentGrades,
    int GradedCount, int AwaitingCount, int UpcomingCount,
    double Earned, int Possible,
    // instructor & admin
    List<PendingDto> PendingGrading, int PendingTotal,
    List<CompletionDto> Completion,
    List<UserDto> RecentUsers,
    Dictionary<string, int> Figures);

public record CalendarCourseDto(int Id, string Code, string Title);

public record CalendarDto(List<CalendarCourseDto> Courses, List<AssignmentMiniDto> Items);

public record CourseGradeDto(int CourseId, string Code, string Title, string InstructorName, int AssignmentCount,
    int GradedCount, double Earned, int Possible);

public record UserRowDto(UserDto User, int CoursesTaught, int Enrollments);

public record AdminUsersDto(Dictionary<string, int> Counts, List<UserRowDto> Users);

public record ChangeRoleRequest(UserRole Role);
