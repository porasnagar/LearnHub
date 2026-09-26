using LearnHub.Web.Data;
using LearnHub.Web.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace LearnHub.Web.Services;

public class ServiceResult
{
    public bool Succeeded { get; init; }
    public string? Error { get; init; }

    public static ServiceResult Ok() => new() { Succeeded = true };
    public static ServiceResult Fail(string error) => new() { Error = error };
}

public class ServiceResult<T> : ServiceResult
{
    public T? Value { get; init; }

    public static ServiceResult<T> Ok(T value) => new() { Succeeded = true, Value = value };
    public static new ServiceResult<T> Fail(string error) => new() { Error = error };
}

/// <summary>
/// Business rules of the LMS: accounts, enrollment, submissions and grading.
/// Controllers stay thin and call into this class, which keeps the rules unit-testable.
/// </summary>
public class LmsService(LmsDbContext db, IPasswordHasher<AppUser> hasher)
{
    public const int MinPasswordLength = 6;

    public static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();

    public static bool CanManage(Course course, int userId, UserRole role) =>
        role == UserRole.Admin || (role == UserRole.Instructor && course.InstructorId == userId);

    // ---------- Accounts ----------

    public async Task<ServiceResult<AppUser>> RegisterAsync(string fullName, string email, string password, UserRole role)
    {
        if (role == UserRole.Admin)
            return ServiceResult<AppUser>.Fail("Administrator accounts cannot be self-registered.");
        if (string.IsNullOrWhiteSpace(password) || password.Length < MinPasswordLength)
            return ServiceResult<AppUser>.Fail($"Password must be at least {MinPasswordLength} characters.");

        var normalized = NormalizeEmail(email);
        if (await db.Users.AnyAsync(u => u.Email == normalized))
            return ServiceResult<AppUser>.Fail("An account with this email already exists.");

        var user = new AppUser { FullName = fullName.Trim(), Email = normalized, Role = role };
        user.PasswordHash = hasher.HashPassword(user, password);
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return ServiceResult<AppUser>.Ok(user);
    }

    public async Task<AppUser?> AuthenticateAsync(string email, string password)
    {
        var normalized = NormalizeEmail(email);
        var user = await db.Users.SingleOrDefaultAsync(u => u.Email == normalized);
        if (user is null) return null;

        var result = hasher.VerifyHashedPassword(user, user.PasswordHash, password);
        if (result == PasswordVerificationResult.Failed) return null;

        if (result == PasswordVerificationResult.SuccessRehashNeeded)
        {
            user.PasswordHash = hasher.HashPassword(user, password);
            await db.SaveChangesAsync();
        }
        return user;
    }

    public async Task<ServiceResult> ChangePasswordAsync(int userId, string currentPassword, string newPassword)
    {
        var user = await db.Users.FindAsync(userId);
        if (user is null) return ServiceResult.Fail("User not found.");
        if (hasher.VerifyHashedPassword(user, user.PasswordHash, currentPassword) == PasswordVerificationResult.Failed)
            return ServiceResult.Fail("Current password is incorrect.");
        if (newPassword.Length < MinPasswordLength)
            return ServiceResult.Fail($"Password must be at least {MinPasswordLength} characters.");

        user.PasswordHash = hasher.HashPassword(user, newPassword);
        await db.SaveChangesAsync();
        return ServiceResult.Ok();
    }

    public async Task<ServiceResult> ChangeRoleAsync(int userId, UserRole newRole, int actingAdminId)
    {
        if (userId == actingAdminId) return ServiceResult.Fail("You cannot change your own role.");

        var user = await db.Users.FindAsync(userId);
        if (user is null) return ServiceResult.Fail("User not found.");
        if (user.Role == newRole) return ServiceResult.Ok();

        if (user.Role == UserRole.Instructor && await db.Courses.AnyAsync(c => c.InstructorId == userId))
            return ServiceResult.Fail("Reassign or delete this instructor's courses before changing their role.");
        if (user.Role == UserRole.Student && await db.Enrollments.AnyAsync(e => e.StudentId == userId))
            return ServiceResult.Fail("This student is enrolled in courses; unenroll them before changing their role.");

        user.Role = newRole;
        await db.SaveChangesAsync();
        return ServiceResult.Ok();
    }

    /// <returns>On success, the stored file names of the user's uploads so the caller can delete them.</returns>
    public async Task<ServiceResult<List<string>>> DeleteUserAsync(int userId, int actingAdminId)
    {
        if (userId == actingAdminId) return ServiceResult<List<string>>.Fail("You cannot delete your own account.");

        var user = await db.Users.FindAsync(userId);
        if (user is null) return ServiceResult<List<string>>.Fail("User not found.");
        if (await db.Courses.AnyAsync(c => c.InstructorId == userId))
            return ServiceResult<List<string>>.Fail("This instructor still owns courses. Reassign or delete them first.");

        var submissions = await db.Submissions.Where(s => s.StudentId == userId).ToListAsync();
        var files = submissions.Where(s => s.StoredFileName != null).Select(s => s.StoredFileName!).ToList();

        db.Submissions.RemoveRange(submissions);
        db.Enrollments.RemoveRange(db.Enrollments.Where(e => e.StudentId == userId));
        db.Users.Remove(user);
        await db.SaveChangesAsync();
        return ServiceResult<List<string>>.Ok(files);
    }

    // ---------- Enrollment ----------

    public Task<bool> IsEnrolledAsync(int courseId, int studentId) =>
        db.Enrollments.AnyAsync(e => e.CourseId == courseId && e.StudentId == studentId);

    public async Task<ServiceResult> EnrollAsync(int courseId, int studentId)
    {
        var student = await db.Users.FindAsync(studentId);
        if (student is null || student.Role != UserRole.Student)
            return ServiceResult.Fail("Only students can enroll in courses.");

        var course = await db.Courses.FindAsync(courseId);
        if (course is null) return ServiceResult.Fail("Course not found.");
        if (!course.IsPublished) return ServiceResult.Fail("This course is not open for enrollment.");

        if (await IsEnrolledAsync(courseId, studentId))
            return ServiceResult.Fail("You are already enrolled in this course.");

        db.Enrollments.Add(new Enrollment { CourseId = courseId, StudentId = studentId });
        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // Unique index hit by a concurrent duplicate request (e.g. a double click).
            return ServiceResult.Fail("You are already enrolled in this course.");
        }
        return ServiceResult.Ok();
    }

    public async Task<ServiceResult> UnenrollAsync(int courseId, int studentId)
    {
        var enrollment = await db.Enrollments.SingleOrDefaultAsync(e => e.CourseId == courseId && e.StudentId == studentId);
        if (enrollment is null) return ServiceResult.Fail("You are not enrolled in this course.");

        db.Enrollments.Remove(enrollment);
        await db.SaveChangesAsync();
        return ServiceResult.Ok();
    }

    // ---------- Assignments ----------

    /// <summary>
    /// Creates or replaces a student's submission. A submission can be replaced until it is graded.
    /// </summary>
    /// <returns>On success, the stored file name that was replaced (if any) so the caller can delete it.</returns>
    public async Task<ServiceResult<string?>> SubmitAsync(
        int assignmentId, int studentId, string? textAnswer, string? storedFileName, string? originalFileName)
    {
        var assignment = await db.Assignments.FindAsync(assignmentId);
        if (assignment is null) return ServiceResult<string?>.Fail("Assignment not found.");
        if (!await IsEnrolledAsync(assignment.CourseId, studentId))
            return ServiceResult<string?>.Fail("You must be enrolled in the course to submit.");

        var text = string.IsNullOrWhiteSpace(textAnswer) ? null : textAnswer.Trim();
        var existing = await db.Submissions.SingleOrDefaultAsync(s => s.AssignmentId == assignmentId && s.StudentId == studentId);

        if (text is null && storedFileName is null && existing?.StoredFileName is null)
            return ServiceResult<string?>.Fail("Add a written answer or attach a file.");

        if (existing is null)
        {
            db.Submissions.Add(new Submission
            {
                AssignmentId = assignmentId,
                StudentId = studentId,
                TextAnswer = text,
                StoredFileName = storedFileName,
                OriginalFileName = originalFileName,
                SubmittedAt = DateTime.Now
            });
            await db.SaveChangesAsync();
            return ServiceResult<string?>.Ok(null);
        }

        if (existing.IsGraded)
            return ServiceResult<string?>.Fail("This submission has already been graded and can no longer be changed.");

        string? replaced = null;
        existing.TextAnswer = text;
        if (storedFileName is not null)
        {
            replaced = existing.StoredFileName;
            existing.StoredFileName = storedFileName;
            existing.OriginalFileName = originalFileName;
        }
        existing.SubmittedAt = DateTime.Now;
        await db.SaveChangesAsync();
        return ServiceResult<string?>.Ok(replaced);
    }

    public async Task<ServiceResult> GradeAsync(int submissionId, int userId, UserRole role, double score, string? feedback)
    {
        var submission = await db.Submissions
            .Include(s => s.Assignment).ThenInclude(a => a!.Course)
            .SingleOrDefaultAsync(s => s.Id == submissionId);
        if (submission is null) return ServiceResult.Fail("Submission not found.");
        if (!CanManage(submission.Assignment!.Course!, userId, role))
            return ServiceResult.Fail("You are not allowed to grade this submission.");
        if (score < 0 || score > submission.Assignment.MaxPoints)
            return ServiceResult.Fail($"Score must be between 0 and {submission.Assignment.MaxPoints}.");

        submission.Score = Math.Round(score, 2);
        submission.Feedback = string.IsNullOrWhiteSpace(feedback) ? null : feedback.Trim();
        submission.GradedAt = DateTime.Now;
        await db.SaveChangesAsync();
        return ServiceResult.Ok();
    }
}
