using LearnHub.Web.Models;
using Microsoft.AspNetCore.Html;

namespace LearnHub.Web.Infrastructure;

/// <summary>A course's pastel color and its deep companion (used for accents and illustrations).</summary>
public record Tone(string Bg, string Deep);

/// <summary>Small formatting helpers shared by the Razor views.</summary>
public static class Ui
{
    /// <summary>Pastel course palette. Text on these is always the dark ink color.</summary>
    private static readonly Tone[] CourseTones =
    [
        new("#D9CCFF", "#5B3FE0"), // lavender
        new("#EEEA9E", "#6F6300"), // lemon
        new("#C3EBD5", "#1D6B45"), // mint
        new("#FFD9C2", "#A94A18"), // peach
        new("#CBE1FF", "#2456B3"), // sky
        new("#FFD0D6", "#AD2E43"), // rose
        new("#EDE0CC", "#7A5C30"), // sand
        new("#EBD3F7", "#7D35A3")  // lilac
    ];

    public static Tone CourseTone(int courseId) => CourseTones[Math.Abs(courseId - 1) % CourseTones.Length];

    /// <summary>Inline style that sets a course's colors as CSS variables (--c, --c-deep).</summary>
    public static string CourseStyle(int courseId)
    {
        var t = CourseTone(courseId);
        return $"--c:{t.Bg};--c-deep:{t.Deep}";
    }

    /// <summary>Which illustration a course banner gets, picked from its subject.</summary>
    public static string ArtFor(string category)
    {
        var c = category.ToLowerInvariant();
        if (c.Contains("web")) return "web";
        if (c.Contains("data")) return "data";
        if (c.Contains("engineer")) return "flow";
        if (c.Contains("program") || c.Contains("code") || c.Contains("computer")) return "code";
        if (c.Contains("design") || c.Contains("art")) return "design";
        if (c.Contains("math") || c.Contains("stat")) return "math";
        return "book";
    }

    /// <summary>Renders an icon from the LearnHub icon sprite (Views/Shared/_IconSprite.cshtml).</summary>
    public static IHtmlContent Icon(string name, string? css = null) =>
        new HtmlString($"<svg class=\"ico{(css is null ? "" : " " + css)}\" aria-hidden=\"true\" focusable=\"false\"><use href=\"#i-{name}\"></use></svg>");

    /// <summary>Stable pastel for an avatar, derived from the name (1–6).</summary>
    public static int AvatarTone(string name)
    {
        var sum = 0;
        foreach (var ch in name) sum += ch;
        return sum % 6 + 1;
    }

    public static string Greeting() => DateTime.Now.Hour switch
    {
        < 12 => "Good morning",
        < 17 => "Good afternoon",
        _ => "Good evening"
    };

    public static string DueText(DateTime due)
    {
        var diff = due - DateTime.Now;
        return diff.TotalSeconds < 0 ? $"{Humanize(-diff)} overdue" : $"Due in {Humanize(diff)}";
    }

    /// <summary>"Oct 3 at 11:59 PM"</summary>
    public static string When(DateTime d) => d.ToString("MMM d 'at' h:mm tt");

    /// <summary>"Sat, Oct 3, 2026 at 11:59 PM"</summary>
    public static string WhenLong(DateTime d) => d.ToString("ddd, MMM d, yyyy 'at' h:mm tt");

    public static string Score(double score) => score % 1 == 0 ? score.ToString("0") : score.ToString("0.##");

    public static string Percent(double score, int max) => $"{score / max * 100:0}%";

    public static string LetterGrade(double percent) => percent switch
    {
        >= 93 => "A",
        >= 90 => "A-",
        >= 87 => "B+",
        >= 83 => "B",
        >= 80 => "B-",
        >= 77 => "C+",
        >= 73 => "C",
        >= 70 => "C-",
        >= 67 => "D+",
        >= 60 => "D",
        _ => "F"
    };

    /// <summary>Status of a student's work on an assignment: (label, css modifier).</summary>
    public static (string Label, string Css) WorkStatus(Submission? submission, Assignment assignment)
    {
        if (submission is null)
            return assignment.IsOverdue ? ("Missing", "missing") : ("Not submitted", "open");
        if (submission.IsGraded) return ("Graded", "graded");
        return submission.SubmittedAt > assignment.DueDate ? ("Submitted late", "late") : ("Submitted", "submitted");
    }

    public static string RoleCss(UserRole role) => role switch
    {
        UserRole.Admin => "admin",
        UserRole.Instructor => "instructor",
        _ => "student"
    };

    public static string Initials(string name)
    {
        var parts = name.Replace("Dr.", "").Replace("Prof.", "")
            .Split(' ', StringSplitOptions.RemoveEmptyEntries);
        return parts.Length switch
        {
            0 => "?",
            1 => parts[0][..1].ToUpperInvariant(),
            _ => (parts[0][..1] + parts[^1][..1]).ToUpperInvariant()
        };
    }

    public static string FirstName(string name) =>
        name.Replace("Dr. ", "").Replace("Prof. ", "").Split(' ', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault() ?? name;

    public static string Truncate(string text, int length) =>
        text.Length <= length ? text : text[..length].TrimEnd() + "…";

    public static string Plural(int n, string unit) => n == 1 ? $"1 {unit}" : $"{n} {unit}s";

    private static string Humanize(TimeSpan t)
    {
        if (t.TotalDays >= 1) return Plural((int)t.TotalDays, "day");
        if (t.TotalHours >= 1) return Plural((int)t.TotalHours, "hour");
        return Plural(Math.Max(1, (int)t.TotalMinutes), "minute");
    }
}

/// <summary>Points-based grade total over graded work only (ungraded work is not counted, as in Canvas).</summary>
public record GradeSummary(double Earned, int Possible, int GradedCount)
{
    public double? Percent => Possible == 0 ? null : Earned / Possible * 100;
    public string? Letter => Percent is double p ? Ui.LetterGrade(p) : null;

    /// <param name="submissions">Submissions with their <see cref="Submission.Assignment"/> loaded.</param>
    public static GradeSummary From(IEnumerable<Submission> submissions)
    {
        var graded = submissions.Where(s => s.Score.HasValue && s.Assignment is not null).ToList();
        return new GradeSummary(graded.Sum(s => s.Score!.Value), graded.Sum(s => s.Assignment!.MaxPoints), graded.Count);
    }
}
