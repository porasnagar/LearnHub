using LearnHub.Web.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace LearnHub.Web.Data;

/// <summary>
/// Creates the database schema on first run and fills it with a realistic demo term:
/// 3 instructors, 10 students, 7 courses and a few weeks of submissions and grades
/// (see README for the demo accounts). Dates are relative to "now", so the demo always looks current.
/// </summary>
public static class DbSeeder
{
    private record CourseSeed(string Code, string Title, string Category, int Credits, int Instructor, bool Published, string Description,
        (string Title, int DueInDays, int Points, string Instructions)[] Assignments);

    public static async Task SeedAsync(IServiceProvider services)
    {
        var db = services.GetRequiredService<LmsDbContext>();
        var hasher = services.GetRequiredService<IPasswordHasher<AppUser>>();

        await db.Database.EnsureCreatedAsync();
        if (await db.Users.AnyAsync()) return;

        var rng = new Random(2026);
        var now = DateTime.Now;
        var endOfToday = DateTime.Today.AddHours(23).AddMinutes(59);

        AppUser User(string name, string email, UserRole role, string password, int joinedDaysAgo)
        {
            var u = new AppUser { FullName = name, Email = email, Role = role, CreatedAt = now.AddDays(-joinedDaysAgo).AddHours(-rng.Next(0, 10)) };
            u.PasswordHash = hasher.HashPassword(u, password);
            return u;
        }

        // ---------- People ----------
        var admin = User("System Administrator", "admin@learnhub.local", UserRole.Admin, "Admin@123", 90);
        var instructors = new[]
        {
            User("Dr. Priya Sharma", "priya@learnhub.local", UserRole.Instructor, "Teach@123", 80),
            User("Prof. Rahul Verma", "rahul@learnhub.local", UserRole.Instructor, "Teach@123", 78),
            User("Dr. Meera Iyer", "meera@learnhub.local", UserRole.Instructor, "Teach@123", 60)
        };
        var students = new[]
        {
            User("Aarav Mehta", "aarav@learnhub.local", UserRole.Student, "Learn@123", 45),
            User("Diya Kapoor", "diya@learnhub.local", UserRole.Student, "Learn@123", 44),
            User("Kabir Singh", "kabir@learnhub.local", UserRole.Student, "Learn@123", 40),
            User("Ananya Rao", "ananya@learnhub.local", UserRole.Student, "Learn@123", 38),
            User("Vihaan Gupta", "vihaan@learnhub.local", UserRole.Student, "Learn@123", 33),
            User("Ishita Nair", "ishita@learnhub.local", UserRole.Student, "Learn@123", 30),
            User("Rohan Das", "rohan@learnhub.local", UserRole.Student, "Learn@123", 21),
            User("Sara Khan", "sara@learnhub.local", UserRole.Student, "Learn@123", 14),
            User("Arjun Patel", "arjun@learnhub.local", UserRole.Student, "Learn@123", 6),
            User("Neha Joshi", "neha@learnhub.local", UserRole.Student, "Learn@123", 2)
        };
        db.Users.Add(admin);
        db.Users.AddRange(instructors);
        db.Users.AddRange(students);

        // ---------- Courses & assignments ----------
        var seeds = new[]
        {
            new CourseSeed("CS301", "ASP.NET Core MVC Fundamentals", "Web Development", 4, 0, true,
                "Build server-rendered web applications with the Model-View-Controller pattern. Covers routing, controllers, " +
                "Razor views, tag helpers, model binding, validation, dependency injection and cookie authentication.\n\n" +
                "Assessment: four practical assignments (60%) and a final project (40%).",
                [
                    ("Routing & Tag Helpers Quiz", -17, 20, "Answer: (1) What is conventional routing? (2) What does asp-for generate? (3) When would you use attribute routing?"),
                    ("Build a Student Directory with MVC", -6, 100, "Create an MVC app with a Student model, a StudentsController with CRUD actions and Razor views. Use data annotations for validation."),
                    ("Dependency Injection Worksheet", -1, 30, "Explain the three service lifetimes with an example of each, and register a custom service in Program.cs."),
                    ("Authentication with Cookies", 5, 100, "Add sign-in and sign-out to your Student Directory using cookie authentication, and protect the edit pages with [Authorize]."),
                    ("Final Project Proposal", 12, 50, "Submit a one-page proposal for your final project: the problem, the users, the main screens and the data model.")
                ]),
            new CourseSeed("DB201", "Database Systems with SQL & Entity Framework", "Databases", 4, 1, true,
                "Relational modelling, normalisation, SQL queries and transactions, followed by object-relational mapping with " +
                "Entity Framework Core: DbContext, relationships, migrations and LINQ.",
                [
                    ("ER Diagram for a Library", -14, 50, "Draw an ER diagram for a library system (books, members, loans, authors) in 3NF and list the CREATE TABLE statements."),
                    ("SQL Joins Lab", -4, 40, "Write the 8 queries in the lab sheet using INNER, LEFT and self joins. Include the output of each."),
                    ("EF Core Relationships", 3, 60, "Model one-to-many and many-to-many relationships with EF Core and seed sample data."),
                    ("Transactions Case Study", 10, 40, "Explain how isolation levels prevent dirty and phantom reads using the bank transfer example.")
                ]),
            new CourseSeed("WD101", "Responsive Web Design", "Web Development", 3, 0, true,
                "Semantic HTML, modern CSS layout with Flexbox and Grid, media queries, accessibility basics and DOM scripting with JavaScript.",
                [
                    ("Semantic HTML Page", -12, 30, "Mark up the provided article using semantic elements only. No divs allowed."),
                    ("Flexbox Navigation Bar", -3, 40, "Build a navigation bar that collapses into a menu below 768px."),
                    ("Responsive Portfolio Page", 4, 100, "Build a single-page portfolio that works on phone, tablet and desktop widths with at least one CSS Grid layout.")
                ]),
            new CourseSeed("SE401", "Software Engineering Practices", "Software Engineering", 3, 1, true,
                "Requirements, design documentation, version control with Git, code review, unit testing and debugging, and delivering software to stakeholders.",
                [
                    ("User Stories Workshop", -10, 25, "Write ten user stories with acceptance criteria for a campus canteen app."),
                    ("Git Branching Exercise", -2, 30, "Complete the branching exercise and submit the output of git log --graph."),
                    ("Unit Testing with xUnit", 6, 80, "Write unit tests for the GradeCalculator class, reaching at least 90% line coverage.")
                ]),
            new CourseSeed("CS210", "Data Structures in C#", "Programming", 4, 1, true,
                "Arrays, linked lists, stacks, queues, trees, hash tables and graphs implemented in C#, with Big-O analysis of each operation.",
                [
                    ("Linked List Implementation", -8, 50, "Implement a generic doubly linked list with Add, Remove, Find and an enumerator."),
                    ("Stacks & Queues", 2, 40, "Implement a queue using two stacks and analyse the amortised cost of Dequeue."),
                    ("Binary Search Trees", 9, 60, "Implement insert, delete and in-order traversal for a BST.")
                ]),
            new CourseSeed("UX220", "Interface Design Fundamentals", "Design", 3, 2, true,
                "Visual hierarchy, typography, color, layout grids and usability testing. Students design and test a small mobile app.",
                [
                    ("Typography Specimen", -9, 30, "Create a type specimen poster pairing a serif and a sans-serif typeface."),
                    ("Wireframes for a Study App", -1, 50, "Wireframe five key screens of a study planner app at mobile size."),
                    ("Usability Test Report", 8, 70, "Run a usability test with three participants and report the top five issues with fixes.")
                ]),
            new CourseSeed("MA150", "Discrete Mathematics", "Mathematics", 3, 2, false,
                "Logic, sets, relations, combinatorics and graph theory for computer science. (Draft — opens next term.)",
                [
                    ("Propositional Logic Set", 14, 40, "Solve problems 1–12 from chapter 1.")
                ])
        };

        var courses = new List<Course>();
        var assignmentsByCourse = new Dictionary<Course, List<Assignment>>();
        foreach (var s in seeds)
        {
            var course = new Course
            {
                Code = s.Code, Title = s.Title, Category = s.Category, Credits = s.Credits, IsPublished = s.Published,
                Description = s.Description, Instructor = instructors[s.Instructor], CreatedAt = now.AddDays(-rng.Next(40, 70))
            };
            courses.Add(course);
            assignmentsByCourse[course] = s.Assignments.Select(a => new Assignment
            {
                Course = course, Title = a.Title, Instructions = a.Instructions, MaxPoints = a.Points,
                DueDate = endOfToday.AddDays(a.DueInDays),
                CreatedAt = endOfToday.AddDays(a.DueInDays - 14)
            }).ToList();
        }
        db.Courses.AddRange(courses);
        db.Assignments.AddRange(assignmentsByCourse.Values.SelectMany(a => a));

        // ---------- Enrollments ----------
        // Student index → course indexes. Aarav (0) is the demo student.
        int[][] plan =
        [
            [0, 1, 2, 5], [0, 3, 5], [1, 3, 4], [0, 1, 4], [2, 5, 0], [1, 2, 3], [0, 4, 5], [3, 4, 1], [2, 0], [5, 1]
        ];
        for (var i = 0; i < students.Length; i++)
            foreach (var ci in plan[i])
                db.Enrollments.Add(new Enrollment { Course = courses[ci], Student = students[i], EnrolledAt = students[i].CreatedAt.AddDays(rng.Next(0, 3)) });

        // ---------- Submissions & grades ----------
        string[] answers =
        [
            "I've completed all parts of the task. My approach and reasoning are explained step by step below, with the final answers at the end of each section.",
            "Please find my work below. I tested each part against the examples from the lecture notes and included the results.",
            "Summary of my solution: I started from the requirements, sketched the structure first, and then implemented and checked each piece.",
            "Here is my submission. Part 2 took the longest; I've noted the assumptions I made where the brief was open to interpretation."
        ];
        string[] feedback =
        [
            "Clear and well organised. Your explanation of the trade-offs was the strongest part.",
            "Good work overall. Double-check edge cases next time; two of them were missed.",
            "Excellent attention to detail. This is a model answer.",
            "Solid attempt. The structure is right, but the final section needs more justification.",
            "Nice improvement on your last assignment. Keep your naming consistent.",
            "Meets the brief. Adding a short summary at the start would make it easier to follow."
        ];

        for (var si = 0; si < students.Length; si++)
        {
            var student = students[si];
            foreach (var ci in plan[si])
            {
                var assignments = assignmentsByCourse[courses[ci]];
                for (var ai = 0; ai < assignments.Count; ai++)
                {
                    var a = assignments[ai];
                    var isPast = a.DueDate < now;
                    // Aarav is deliberately missing the WD101 flexbox task, so the demo shows a "Missing" item.
                    // Aarav (the demo student) is missing the WD101 flexbox task and hasn't started this week's work,
                    // so his dashboard shows a "Missing" item and a to-do list.
                    var skip = si == 0
                        ? (ci == 2 && ai == 1) || !isPast
                        : rng.NextDouble() < (isPast ? 0.12 : 0.62);
                    if (skip || (!isPast && a.DueDate > now.AddDays(7))) continue;

                    var late = isPast && rng.NextDouble() < 0.12;
                    var submittedAt = late
                        ? a.DueDate.AddHours(rng.Next(2, 30))
                        : a.DueDate.AddHours(-rng.Next(2, 90));
                    if (submittedAt > now) submittedAt = now.AddHours(-rng.Next(1, 40));

                    var submission = new Submission
                    {
                        Assignment = a,
                        Student = student,
                        SubmittedAt = submittedAt,
                        TextAnswer = answers[rng.Next(answers.Length)]
                    };
                    // Work due more than a day ago is usually graded.
                    if (a.DueDate < now.AddDays(-1) && rng.NextDouble() < 0.88)
                    {
                        var pct = 0.62 + rng.NextDouble() * 0.38;
                        submission.Score = Math.Round(a.MaxPoints * pct * 2, MidpointRounding.AwayFromZero) / 2;
                        submission.Feedback = feedback[rng.Next(feedback.Length)];
                        submission.GradedAt = a.DueDate.AddDays(rng.Next(1, 3)) < now ? a.DueDate.AddDays(rng.Next(1, 3)) : now;
                    }
                    db.Submissions.Add(submission);
                }
            }
        }

        await db.SaveChangesAsync();
    }
}
