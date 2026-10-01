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
    public DbSet<Announcement> Announcements => Set<Announcement>();

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

        b.Entity<Announcement>(e =>
        {
            e.HasIndex(a => new { a.CourseId, a.CreatedAt });
            e.HasOne(a => a.Course).WithMany()
             .HasForeignKey(a => a.CourseId).OnDelete(DeleteBehavior.Cascade);
            // Restrict (not cascade) on the author for the same multiple-cascade-path reason as above;
            // LmsService.DeleteUserAsync removes an author's posts explicitly.
            e.HasOne(a => a.Author).WithMany()
             .HasForeignKey(a => a.AuthorId).OnDelete(DeleteBehavior.Restrict);
        });
    }
}
