using LearnHub.Web.Data;
using LearnHub.Web.Models;
using LearnHub.Web.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace LearnHub.Tests;

/// <summary>
/// Business-rule tests against a real (in-memory) SQLite database, so that unique indexes,
/// foreign keys and cascades behave exactly as they do in the running application.
/// </summary>
public sealed class LmsServiceTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly LmsDbContext _db;
    private readonly LmsService _lms;

    private readonly AppUser _instructor;
    private readonly AppUser _otherInstructor;
    private readonly AppUser _student;
    private readonly AppUser _admin;
    private readonly Course _course;
    private readonly Assignment _assignment;

    public LmsServiceTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();
        _db = new LmsDbContext(new DbContextOptionsBuilder<LmsDbContext>().UseSqlite(_connection).Options);
        _db.Database.EnsureCreated();
        _lms = new LmsService(_db, new PasswordHasher<AppUser>());

        _instructor = new AppUser { FullName = "Ina Instructor", Email = "ina@test", Role = UserRole.Instructor, PasswordHash = "x" };
        _otherInstructor = new AppUser { FullName = "Oscar Other", Email = "oscar@test", Role = UserRole.Instructor, PasswordHash = "x" };
        _student = new AppUser { FullName = "Sam Student", Email = "sam@test", Role = UserRole.Student, PasswordHash = "x" };
        _admin = new AppUser { FullName = "Ada Admin", Email = "ada@test", Role = UserRole.Admin, PasswordHash = "x" };
        _course = new Course { Code = "T100", Title = "Testing", Description = "d", Category = "c", Instructor = _instructor };
        _assignment = new Assignment { Course = _course, Title = "A1", Instructions = "i", DueDate = DateTime.Now.AddDays(1), MaxPoints = 50 };
        _db.AddRange(_instructor, _otherInstructor, _student, _admin, _course, _assignment);
        _db.SaveChanges();
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }

    // ---------- Accounts ----------

    [Fact]
    public async Task Register_then_authenticate_succeeds_with_normalized_email()
    {
        var result = await _lms.RegisterAsync("New Person", "  New@Example.COM ", "secret1", UserRole.Student);

        Assert.True(result.Succeeded);
        Assert.Equal("new@example.com", result.Value!.Email);
        Assert.NotEqual("secret1", result.Value.PasswordHash);
        Assert.NotNull(await _lms.AuthenticateAsync("NEW@example.com", "secret1"));
        Assert.Null(await _lms.AuthenticateAsync("new@example.com", "wrong-password"));
    }

    [Fact]
    public async Task Register_rejects_duplicate_email_and_admin_role()
    {
        await _lms.RegisterAsync("One", "dup@example.com", "secret1", UserRole.Student);

        Assert.False((await _lms.RegisterAsync("Two", "DUP@example.com", "secret1", UserRole.Student)).Succeeded);
        Assert.False((await _lms.RegisterAsync("Boss", "boss@example.com", "secret1", UserRole.Admin)).Succeeded);
    }

    [Fact]
    public async Task ChangePassword_requires_correct_current_password()
    {
        var user = (await _lms.RegisterAsync("P", "p@example.com", "oldpass", UserRole.Student)).Value!;

        Assert.False((await _lms.ChangePasswordAsync(user.Id, "wrong", "newpass")).Succeeded);
        Assert.True((await _lms.ChangePasswordAsync(user.Id, "oldpass", "newpass")).Succeeded);
        Assert.NotNull(await _lms.AuthenticateAsync("p@example.com", "newpass"));
    }

    // ---------- Authorization rule ----------

    [Fact]
    public void CanManage_allows_owner_and_admin_only()
    {
        Assert.True(LmsService.CanManage(_course, _instructor.Id, UserRole.Instructor));
        Assert.True(LmsService.CanManage(_course, _admin.Id, UserRole.Admin));
        Assert.False(LmsService.CanManage(_course, _otherInstructor.Id, UserRole.Instructor));
        Assert.False(LmsService.CanManage(_course, _student.Id, UserRole.Student));
    }

    // ---------- Enrollment ----------

    [Fact]
    public async Task Enroll_once_then_duplicate_is_rejected()
    {
        Assert.True((await _lms.EnrollAsync(_course.Id, _student.Id)).Succeeded);
        Assert.False((await _lms.EnrollAsync(_course.Id, _student.Id)).Succeeded);
        Assert.Equal(1, await _db.Enrollments.CountAsync());
    }

    [Fact]
    public async Task Enroll_rejects_instructors_and_unpublished_courses()
    {
        Assert.False((await _lms.EnrollAsync(_course.Id, _otherInstructor.Id)).Succeeded);

        _course.IsPublished = false;
        await _db.SaveChangesAsync();
        Assert.False((await _lms.EnrollAsync(_course.Id, _student.Id)).Succeeded);
    }

    [Fact]
    public async Task Unenroll_removes_enrollment()
    {
        await _lms.EnrollAsync(_course.Id, _student.Id);

        Assert.True((await _lms.UnenrollAsync(_course.Id, _student.Id)).Succeeded);
        Assert.False(await _lms.IsEnrolledAsync(_course.Id, _student.Id));
        Assert.False((await _lms.UnenrollAsync(_course.Id, _student.Id)).Succeeded);
    }

    // ---------- Submissions ----------

    [Fact]
    public async Task Submit_requires_enrollment()
    {
        var result = await _lms.SubmitAsync(_assignment.Id, _student.Id, "answer", null, null);
        Assert.False(result.Succeeded);
    }

    [Fact]
    public async Task Submit_requires_text_or_file()
    {
        await _lms.EnrollAsync(_course.Id, _student.Id);
        Assert.False((await _lms.SubmitAsync(_assignment.Id, _student.Id, "   ", null, null)).Succeeded);
    }

    [Fact]
    public async Task Resubmit_replaces_answer_and_reports_replaced_file()
    {
        await _lms.EnrollAsync(_course.Id, _student.Id);
        await _lms.SubmitAsync(_assignment.Id, _student.Id, "first", "old.pdf", "work.pdf");

        var keepFile = await _lms.SubmitAsync(_assignment.Id, _student.Id, "second", null, null);
        Assert.True(keepFile.Succeeded);
        Assert.Null(keepFile.Value);

        var replaceFile = await _lms.SubmitAsync(_assignment.Id, _student.Id, "third", "new.pdf", "work-v2.pdf");
        Assert.Equal("old.pdf", replaceFile.Value);

        var submission = await _db.Submissions.SingleAsync();
        Assert.Equal("third", submission.TextAnswer);
        Assert.Equal("new.pdf", submission.StoredFileName);
        Assert.Equal("work-v2.pdf", submission.OriginalFileName);
    }

    [Fact]
    public async Task Submission_after_due_date_is_late()
    {
        _assignment.DueDate = DateTime.Now.AddDays(-1);
        await _db.SaveChangesAsync();
        await _lms.EnrollAsync(_course.Id, _student.Id);

        await _lms.SubmitAsync(_assignment.Id, _student.Id, "late work", null, null);

        var submission = await _db.Submissions.Include(s => s.Assignment).SingleAsync();
        Assert.True(submission.IsLate);
    }

    // ---------- Grading ----------

    private async Task<Submission> CreateSubmissionAsync()
    {
        await _lms.EnrollAsync(_course.Id, _student.Id);
        await _lms.SubmitAsync(_assignment.Id, _student.Id, "answer", null, null);
        return await _db.Submissions.SingleAsync();
    }

    [Fact]
    public async Task Owner_can_grade_within_range()
    {
        var submission = await CreateSubmissionAsync();

        var result = await _lms.GradeAsync(submission.Id, _instructor.Id, UserRole.Instructor, 42.5, " Well done ");

        Assert.True(result.Succeeded);
        await _db.Entry(submission).ReloadAsync();
        Assert.Equal(42.5, submission.Score);
        Assert.Equal("Well done", submission.Feedback);
        Assert.NotNull(submission.GradedAt);
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(50.5)]
    public async Task Grade_outside_range_is_rejected(double score)
    {
        var submission = await CreateSubmissionAsync();
        Assert.False((await _lms.GradeAsync(submission.Id, _instructor.Id, UserRole.Instructor, score, null)).Succeeded);
    }

    [Fact]
    public async Task Other_instructor_cannot_grade()
    {
        var submission = await CreateSubmissionAsync();
        Assert.False((await _lms.GradeAsync(submission.Id, _otherInstructor.Id, UserRole.Instructor, 10, null)).Succeeded);
    }

    [Fact]
    public async Task Graded_submission_cannot_be_changed_by_student()
    {
        var submission = await CreateSubmissionAsync();
        await _lms.GradeAsync(submission.Id, _instructor.Id, UserRole.Instructor, 30, null);

        Assert.False((await _lms.SubmitAsync(_assignment.Id, _student.Id, "sneaky edit", null, null)).Succeeded);
    }

    // ---------- Administration ----------

    [Fact]
    public async Task Deleting_student_removes_their_enrollments_and_submissions()
    {
        await _lms.EnrollAsync(_course.Id, _student.Id);
        await _lms.SubmitAsync(_assignment.Id, _student.Id, "answer", "file.zip", "file.zip");

        var result = await _lms.DeleteUserAsync(_student.Id, _admin.Id);

        Assert.True(result.Succeeded);
        Assert.Equal(["file.zip"], result.Value!);
        Assert.Empty(_db.Enrollments);
        Assert.Empty(_db.Submissions);
    }

    [Fact]
    public async Task Cannot_delete_instructor_who_owns_courses_or_yourself()
    {
        Assert.False((await _lms.DeleteUserAsync(_instructor.Id, _admin.Id)).Succeeded);
        Assert.False((await _lms.DeleteUserAsync(_admin.Id, _admin.Id)).Succeeded);
    }

    [Fact]
    public async Task Deleting_course_cascades_to_enrollments_assignments_and_submissions()
    {
        await CreateSubmissionAsync();

        _db.Courses.Remove(_course);
        await _db.SaveChangesAsync();

        Assert.Empty(_db.Enrollments);
        Assert.Empty(_db.Assignments);
        Assert.Empty(_db.Submissions);
    }

    [Fact]
    public async Task ChangeRole_blocks_instructor_with_courses()
    {
        Assert.False((await _lms.ChangeRoleAsync(_instructor.Id, UserRole.Student, _admin.Id)).Succeeded);
        Assert.True((await _lms.ChangeRoleAsync(_otherInstructor.Id, UserRole.Student, _admin.Id)).Succeeded);
    }

    // ---------- Profile & announcements ----------

    [Fact]
    public async Task UpdateName_trims_and_validates_length()
    {
        var ok = await _lms.UpdateNameAsync(_student.Id, "  Samira Student  ");
        Assert.True(ok.Succeeded);
        Assert.Equal("Samira Student", (await _db.Users.FindAsync(_student.Id))!.FullName);

        Assert.False((await _lms.UpdateNameAsync(_student.Id, " x ")).Succeeded);
        Assert.False((await _lms.UpdateNameAsync(_student.Id, new string('a', 101))).Succeeded);
    }

    [Fact]
    public async Task Only_the_course_instructor_or_admin_can_post_announcements()
    {
        Assert.True((await _lms.PostAnnouncementAsync(_course.Id, _instructor.Id, UserRole.Instructor, "Hi", "Welcome", true)).Succeeded);
        Assert.True((await _lms.PostAnnouncementAsync(_course.Id, _admin.Id, UserRole.Admin, "Note", "From admin", false)).Succeeded);
        Assert.False((await _lms.PostAnnouncementAsync(_course.Id, _otherInstructor.Id, UserRole.Instructor, "No", "Not mine", false)).Succeeded);
        Assert.False((await _lms.PostAnnouncementAsync(_course.Id, _student.Id, UserRole.Student, "No", "Student", false)).Succeeded);
        Assert.False((await _lms.PostAnnouncementAsync(_course.Id, _instructor.Id, UserRole.Instructor, " ", "Empty title", false)).Succeeded);
        Assert.Equal(2, _db.Announcements.Count());
    }

    [Fact]
    public async Task Pin_and_delete_announcement_respect_ownership()
    {
        var posted = (await _lms.PostAnnouncementAsync(_course.Id, _instructor.Id, UserRole.Instructor, "Hi", "Welcome", false)).Value!;

        Assert.False((await _lms.SetAnnouncementPinnedAsync(posted.Id, _otherInstructor.Id, UserRole.Instructor, true)).Succeeded);
        Assert.True((await _lms.SetAnnouncementPinnedAsync(posted.Id, _instructor.Id, UserRole.Instructor, true)).Succeeded);
        Assert.True((await _db.Announcements.AsNoTracking().SingleAsync()).IsPinned);

        Assert.False((await _lms.DeleteAnnouncementAsync(posted.Id, _student.Id, UserRole.Student)).Succeeded);
        Assert.True((await _lms.DeleteAnnouncementAsync(posted.Id, _instructor.Id, UserRole.Instructor)).Succeeded);
        Assert.Empty(_db.Announcements);
    }

    [Fact]
    public async Task Deleting_course_removes_its_announcements()
    {
        await _lms.PostAnnouncementAsync(_course.Id, _instructor.Id, UserRole.Instructor, "Hi", "Welcome", false);
        _db.Courses.Remove(_course);
        await _db.SaveChangesAsync();
        Assert.Empty(_db.Announcements);
    }
}
