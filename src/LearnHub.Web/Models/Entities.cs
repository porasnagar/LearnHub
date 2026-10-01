using System.ComponentModel.DataAnnotations;

namespace LearnHub.Web.Models;

public enum UserRole
{
    Student,
    Instructor,
    Admin
}

public class AppUser
{
    public int Id { get; set; }

    [Required, StringLength(100)]
    public string FullName { get; set; } = string.Empty;

    [Required, EmailAddress, StringLength(256)]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string PasswordHash { get; set; } = string.Empty;

    public UserRole Role { get; set; } = UserRole.Student;

    public DateTime CreatedAt { get; set; } = DateTime.Now;

    public ICollection<Course> CoursesTaught { get; set; } = new List<Course>();
    public ICollection<Enrollment> Enrollments { get; set; } = new List<Enrollment>();
    public ICollection<Submission> Submissions { get; set; } = new List<Submission>();
}

public class Course
{
    public int Id { get; set; }

    [Required, StringLength(20)]
    public string Code { get; set; } = string.Empty;

    [Required, StringLength(150)]
    public string Title { get; set; } = string.Empty;

    [Required, StringLength(4000)]
    public string Description { get; set; } = string.Empty;

    [Required, StringLength(50)]
    public string Category { get; set; } = string.Empty;

    [Range(1, 10)]
    public int Credits { get; set; } = 3;

    public bool IsPublished { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.Now;

    public int InstructorId { get; set; }
    public AppUser? Instructor { get; set; }

    public ICollection<Enrollment> Enrollments { get; set; } = new List<Enrollment>();
    public ICollection<Assignment> Assignments { get; set; } = new List<Assignment>();
}

public class Enrollment
{
    public int Id { get; set; }

    public int CourseId { get; set; }
    public Course? Course { get; set; }

    public int StudentId { get; set; }
    public AppUser? Student { get; set; }

    public DateTime EnrolledAt { get; set; } = DateTime.Now;
}

public class Assignment
{
    public int Id { get; set; }

    public int CourseId { get; set; }
    public Course? Course { get; set; }

    [Required, StringLength(150)]
    public string Title { get; set; } = string.Empty;

    [Required, StringLength(4000)]
    public string Instructions { get; set; } = string.Empty;

    public DateTime DueDate { get; set; }

    [Range(1, 1000)]
    public int MaxPoints { get; set; } = 100;

    public DateTime CreatedAt { get; set; } = DateTime.Now;

    public ICollection<Submission> Submissions { get; set; } = new List<Submission>();

    public bool IsOverdue => DateTime.Now > DueDate;
}

public class Submission
{
    public int Id { get; set; }

    public int AssignmentId { get; set; }
    public Assignment? Assignment { get; set; }

    public int StudentId { get; set; }
    public AppUser? Student { get; set; }

    [StringLength(8000)]
    public string? TextAnswer { get; set; }

    /// <summary>Name of the file on disk (a GUID), never shown to users.</summary>
    [StringLength(260)]
    public string? StoredFileName { get; set; }

    /// <summary>Original name of the uploaded file, used as the download name.</summary>
    [StringLength(260)]
    public string? OriginalFileName { get; set; }

    public DateTime SubmittedAt { get; set; } = DateTime.Now;

    public double? Score { get; set; }

    [StringLength(2000)]
    public string? Feedback { get; set; }

    public DateTime? GradedAt { get; set; }

    public bool IsGraded => Score.HasValue;

    public bool IsLate => Assignment is not null && SubmittedAt > Assignment.DueDate;
}

/// <summary>A post from the course's instructor (or an admin) to everyone enrolled.</summary>
public class Announcement
{
    public int Id { get; set; }

    public int CourseId { get; set; }
    public Course? Course { get; set; }

    public int AuthorId { get; set; }
    public AppUser? Author { get; set; }

    [Required, StringLength(150)]
    public string Title { get; set; } = string.Empty;

    [Required, StringLength(4000)]
    public string Body { get; set; } = string.Empty;

    /// <summary>Pinned posts stay at the top of the course page.</summary>
    public bool IsPinned { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.Now;
}

public class ErrorViewModel
{
    public string? RequestId { get; set; }

    public bool ShowRequestId => !string.IsNullOrEmpty(RequestId);
}
