using LearnHub.Web.Models;
using Microsoft.EntityFrameworkCore;

namespace LearnHub.Web.Data;

public class LmsDbContext(DbContextOptions<LmsDbContext> options) : DbContext(options)
{
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<Course> Courses => Set<Course>();
    public DbSet<Enrollment> Enrollments => Set<Enrollment>();
    public DbSet<Assignment> Assignments => Set<Assignment>();
    public DbSet<Submission> Submissions => Set<Submission>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<AppUser>(e =>
        {
            e.HasIndex(u => u.Email).IsUnique();
            e.Property(u => u.Role).HasConversion<string>().HasMaxLength(20);
        });

        b.Entity<Course>(e =>
        {
            e.HasIndex(c => c.Code).IsUnique();
            // An instructor cannot be deleted while they still own courses.
            e.HasOne(c => c.Instructor)
             .WithMany(u => u.CoursesTaught)
             .HasForeignKey(c => c.InstructorId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<Enrollment>(e =>
        {
            e.HasIndex(x => new { x.CourseId, x.StudentId }).IsUnique();
            e.HasOne(x => x.Course).WithMany(c => c.Enrollments)
             .HasForeignKey(x => x.CourseId).OnDelete(DeleteBehavior.Cascade);
            // Restrict on the user side avoids multiple cascade paths (a SQL Server requirement);
            // LmsService.DeleteUserAsync removes a student's rows explicitly.
            e.HasOne(x => x.Student).WithMany(u => u.Enrollments)
             .HasForeignKey(x => x.StudentId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<Assignment>(e =>
        {
            e.HasOne(a => a.Course).WithMany(c => c.Assignments)
             .HasForeignKey(a => a.CourseId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<Submission>(e =>
        {
            e.HasIndex(s => new { s.AssignmentId, s.StudentId }).IsUnique();
            e.HasOne(s => s.Assignment).WithMany(a => a.Submissions)
             .HasForeignKey(s => s.AssignmentId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(s => s.Student).WithMany(u => u.Submissions)
             .HasForeignKey(s => s.StudentId).OnDelete(DeleteBehavior.Restrict);
        });
    }
}
