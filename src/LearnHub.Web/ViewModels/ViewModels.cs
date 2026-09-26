using System.ComponentModel.DataAnnotations;
using LearnHub.Web.Infrastructure;
using LearnHub.Web.Models;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace LearnHub.Web.ViewModels;

// ---------- Account ----------

public class LoginViewModel
{
    [Required, EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required, DataType(DataType.Password)]
    public string Password { get; set; } = string.Empty;

    [Display(Name = "Keep me signed in")]
    public bool RememberMe { get; set; }

    public string? ReturnUrl { get; set; }
}

public class RegisterViewModel
{
    [Required, StringLength(100, MinimumLength = 2), Display(Name = "Full name")]
    public string FullName { get; set; } = string.Empty;

    [Required, EmailAddress, StringLength(256)]
    public string Email { get; set; } = string.Empty;

    [Required, StringLength(100, MinimumLength = 6), DataType(DataType.Password)]
    public string Password { get; set; } = string.Empty;

    [Required, DataType(DataType.Password), Display(Name = "Confirm password")]
    [Compare(nameof(Password), ErrorMessage = "Passwords do not match.")]
    public string ConfirmPassword { get; set; } = string.Empty;

    [Display(Name = "Account type")]
    public UserRole Role { get; set; } = UserRole.Student;
}

public class ChangePasswordViewModel
{
    [Required, DataType(DataType.Password), Display(Name = "Current password")]
    public string CurrentPassword { get; set; } = string.Empty;

    [Required, StringLength(100, MinimumLength = 6), DataType(DataType.Password), Display(Name = "New password")]
    public string NewPassword { get; set; } = string.Empty;

    [Required, DataType(DataType.Password), Display(Name = "Confirm new password")]
    [Compare(nameof(NewPassword), ErrorMessage = "Passwords do not match.")]
    public string ConfirmNewPassword { get; set; } = string.Empty;
}

public class ProfileViewModel
{
    public AppUser User { get; set; } = null!;
    public int CourseCount { get; set; }
    public int SubmissionCount { get; set; }
    public ChangePasswordViewModel Password { get; set; } = new();
}

// ---------- Public home & catalog ----------

public record SubjectCount(string Name, int Count);

public class HomeViewModel
{
    public List<SubjectCount> Subjects { get; set; } = [];
    public List<CourseCardViewModel> Featured { get; set; } = [];
}

public class CourseCardViewModel
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public int Credits { get; set; }
    public bool IsPublished { get; set; }
    public string InstructorName { get; set; } = string.Empty;
    public int StudentCount { get; set; }
    public int AssignmentCount { get; set; }
    public bool IsEnrolled { get; set; }
    /// <summary>Assignments the current student has submitted (students only).</summary>
    public int MySubmitted { get; set; }
    /// <summary>Submissions waiting for a grade.</summary>
    public int ToGrade { get; set; }
}

public class CourseCatalogViewModel
{
    public string? Query { get; set; }
    public string? Category { get; set; }
    public int TotalPublished { get; set; }
    public List<SubjectCount> Subjects { get; set; } = [];
    public List<CourseCardViewModel> Courses { get; set; } = [];
}

// ---------- Course shell ----------

/// <summary>The course plus the viewer's relationship to it; drives the banner and course navigation.</summary>
public class CourseContext
{
    public Course Course { get; set; } = null!;
    public string ActiveTab { get; set; } = "home";
    public bool IsSignedIn { get; set; }
    public bool IsStudent { get; set; }
    public bool IsEnrolled { get; set; }
    public bool CanManage { get; set; }
    public int StudentCount { get; set; }

    /// <summary>Only enrolled students and the course's managers see assignments and grades.</summary>
    public bool CanSeeContent => CanManage || IsEnrolled;

    public string Color => Ui.CourseColor(Course.Id);
}

public class AssignmentRow
{
    public Assignment Assignment { get; set; } = null!;
    public int SubmissionCount { get; set; }
    public int UngradedCount { get; set; }
    public Submission? MySubmission { get; set; }
}

public class CourseHomeViewModel
{
    public int AssignmentCount { get; set; }
    public List<AssignmentRow> Upcoming { get; set; } = [];
    public int Submitted { get; set; }
    public int ToGrade { get; set; }
    public GradeSummary? Grade { get; set; }
}

public class CourseAssignmentsViewModel
{
    public List<AssignmentRow> Upcoming { get; set; } = [];
    public List<AssignmentRow> Past { get; set; } = [];
}

public class StudentGradesViewModel
{
    public List<AssignmentRow> Rows { get; set; } = [];
    public GradeSummary Summary { get; set; } = new(0, 0, 0);
}

public class GradebookRow
{
    public AppUser Student { get; set; } = null!;
    public Dictionary<int, Submission> Submissions { get; set; } = [];
    public GradeSummary Summary { get; set; } = new(0, 0, 0);
}

public class GradebookViewModel
{
    public List<Assignment> Assignments { get; set; } = [];
    public List<GradebookRow> Rows { get; set; } = [];

    public double? AverageFor(int assignmentId)
    {
        var scores = Rows.Select(r => r.Submissions.GetValueOrDefault(assignmentId)?.Score)
            .Where(s => s.HasValue).Select(s => s!.Value).ToList();
        return scores.Count == 0 ? null : scores.Average();
    }

    public double? AverageTotal()
    {
        var totals = Rows.Select(r => r.Summary.Percent).Where(p => p.HasValue).Select(p => p!.Value).ToList();
        return totals.Count == 0 ? null : totals.Average();
    }
}

public class CourseFormViewModel
{
    public int? Id { get; set; }

    [Required, StringLength(20), RegularExpression(@"^[A-Za-z0-9\-]+$", ErrorMessage = "Use letters, digits and hyphens only.")]
    [Display(Name = "Course code")]
    public string Code { get; set; } = string.Empty;

    [Required, StringLength(150), Display(Name = "Course title")]
    public string Title { get; set; } = string.Empty;

    [Required, StringLength(4000), Display(Name = "Description / syllabus")]
    public string Description { get; set; } = string.Empty;

    [Required, StringLength(50), Display(Name = "Subject")]
    public string Category { get; set; } = string.Empty;

    [Range(1, 10)]
    public int Credits { get; set; } = 3;

    [Display(Name = "Published — visible in the catalog and open for enrollment")]
    public bool IsPublished { get; set; } = true;

    [Display(Name = "Instructor")]
    public int? InstructorId { get; set; }

    public List<SelectListItem> Instructors { get; set; } = [];
}

public class RosterRow
{
    public int StudentId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public DateTime EnrolledAt { get; set; }
    public int Submitted { get; set; }
    public int Graded { get; set; }
}

public class RosterViewModel
{
    public int AssignmentCount { get; set; }
    public List<RosterRow> Students { get; set; } = [];
}

// ---------- Assignments & grading ----------

public class AssignmentFormViewModel
{
    public int? Id { get; set; }
    public int CourseId { get; set; }

    [Required, StringLength(150)]
    public string Title { get; set; } = string.Empty;

    [Required, StringLength(4000)]
    public string Instructions { get; set; } = string.Empty;

    [Display(Name = "Due date")]
    public DateTime DueDate { get; set; } = DateTime.Now.Date.AddDays(7).AddHours(23).AddMinutes(59);

    [Range(1, 1000), Display(Name = "Points possible")]
    public int MaxPoints { get; set; } = 100;
}

public class SubmissionRow
{
    public AppUser Student { get; set; } = null!;
    public Submission? Submission { get; set; }
    public bool StillEnrolled { get; set; } = true;
}

public class AssignmentDetailsViewModel
{
    public Assignment Assignment { get; set; } = null!;
    public bool CanManage { get; set; }
    public Submission? MySubmission { get; set; }
    public List<SubmissionRow> Rows { get; set; } = [];
    public string AllowedExtensions { get; set; } = string.Empty;
    public int MaxFileSizeMB { get; set; }
}

public class SubmitViewModel
{
    public int AssignmentId { get; set; }

    [StringLength(8000), Display(Name = "Text entry")]
    public string? TextAnswer { get; set; }

    [Display(Name = "File upload")]
    public IFormFile? Attachment { get; set; }
}

public record GradeQueueItem(int SubmissionId, string StudentName, bool IsGraded);

public class GradeViewModel
{
    public int SubmissionId { get; set; }

    [Required, Range(0, 1000)]
    public double? Score { get; set; }

    [StringLength(2000), Display(Name = "Comment for the student")]
    public string? Feedback { get; set; }

    /// <summary>Set by the "Save &amp; next" button.</summary>
    public bool SaveAndNext { get; set; }

    public Submission? Submission { get; set; }
    public List<GradeQueueItem> Queue { get; set; } = [];
    public int? PrevId { get; set; }
    public int? NextId { get; set; }
    public int Position { get; set; }
}

// ---------- Dashboard, calendar, grades, admin ----------

public record KeyFigure(string Label, int Value, string Icon);

public record DayCount(DateTime Day, int Count);

public record AssignmentProgress(Assignment Assignment, int Submitted, int Enrolled);

public record CourseCount(int CourseId, string Code, string Title, int Count);

/// <summary>Donut chart: percent filled, the big center text and a caption.</summary>
public record RingModel(double Percent, string Center, string? Caption = null, int Size = 132);

public class DashboardViewModel
{
    public string FullName { get; set; } = string.Empty;
    public UserRole Role { get; set; }
    public List<KeyFigure> Figures { get; set; } = [];
    public List<CourseCardViewModel> Courses { get; set; } = [];

    /// <summary>Submissions per day for the last 7 days (student: own; instructor: received; admin: all).</summary>
    public List<DayCount> Activity { get; set; } = [];

    // Student
    public Assignment? NextUp { get; set; }
    public List<Assignment> Week { get; set; } = [];
    public HashSet<int> SubmittedIds { get; set; } = [];
    public List<Assignment> Missing { get; set; } = [];
    public List<Submission> RecentGrades { get; set; } = [];
    public int GradedCount { get; set; }
    public int AwaitingCount { get; set; }
    public int UpcomingCount { get; set; }
    public GradeSummary Overall { get; set; } = new(0, 0, 0);

    // Instructor / admin
    public List<Submission> PendingGrading { get; set; } = [];
    public int PendingTotal { get; set; }
    public List<AssignmentProgress> Completion { get; set; } = [];
    public List<CourseCount> EnrollmentByCourse { get; set; } = [];
    public List<AppUser> RecentUsers { get; set; } = [];

    public int TotalWork => GradedCount + AwaitingCount + Missing.Count + UpcomingCount;
}

public record CalendarCourse(int Id, string Code, string Title);

public class CalendarViewModel
{
    public DateTime Month { get; set; }
    public DateTime GridStart { get; set; }
    public int Weeks { get; set; }
    public List<Assignment> Items { get; set; } = [];
    public HashSet<int> SubmittedIds { get; set; } = [];
    public List<CalendarCourse> Courses { get; set; } = [];
    public bool IsStudent { get; set; }
}

public class CourseGradeRow
{
    public int CourseId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string InstructorName { get; set; } = string.Empty;
    public int AssignmentCount { get; set; }
    public GradeSummary Summary { get; set; } = new(0, 0, 0);
}

public class UserRow
{
    public AppUser User { get; set; } = null!;
    public int CoursesTaught { get; set; }
    public int Enrollments { get; set; }
}

public class AdminUsersViewModel
{
    public string? Query { get; set; }
    public UserRole? Role { get; set; }
    public List<UserRow> Users { get; set; } = [];
    public Dictionary<UserRole, int> Counts { get; set; } = [];
}
