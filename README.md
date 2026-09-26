# LearnHub — Online Learning Management System (ASP.NET Core MVC)

LearnHub is a web-based learning management system built with the **ASP.NET Core MVC** framework,
**Entity Framework Core** and **Bootstrap 5**. Instructors publish courses and assignments, students
enroll and submit work, instructors grade it with feedback, and administrators manage the platform.

---

## 1. Features

| Role | What they can do |
|------|------------------|
| **Visitor** | Public portal home page, course catalog (search + subject filters), public course overview |
| **Student** | Register / sign in; enroll in and leave courses; dashboard with course cards, a *To Do* list, *Missing* work and recent feedback; calendar of due dates; submit text and/or a file and resubmit until graded; per-course grades with current percentage and letter grade; a grades overview across courses |
| **Instructor** | Create, edit, publish/unpublish and delete own courses; add, edit and delete assignments; *People* page (class list); gradebook matrix with class averages and CSV export; SpeedGrader-style grading screen with a student switcher and "Save & next"; dashboard *To Grade* queue |
| **Admin** | Everything an instructor can do, on every course; assign courses to instructors; administration console (users with figures, filters and inline role changes; all courses) |

### User interface

The UI follows the patterns of established LMS products (Canvas, Moodle, Google Classroom):

- a navy global navigation rail;
- a colored banner and its own navigation (Home · Assignments · Grades · People · Settings) inside each course;
- serif/sans academic typography;
- status labels such as Missing, Late and Graded.

The full plan (design language, information architecture, a plan for every screen, and responsive and accessibility rules) is in [docs/UI-DESIGN.md](docs/UI-DESIGN.md).

Cross-cutting:

- **Authentication**: cookie authentication; passwords hashed with PBKDF2 (`PasswordHasher<T>`).
- **Authorization**: role-based (`[Authorize(Roles = ...)]`) plus ownership rules (an instructor can only manage their own courses). If an account is deleted or its role changes, its existing sessions are rejected on the next request.
- **Security**: anti-forgery tokens on every POST (global filter), uploads stored outside `wwwroot` with random names, an extension allow-list and a size limit, and a download action that checks who is asking.
- **Responsive UI**: on phones and tablets, the navigation rail becomes a top bar with a slide-out menu, course navigation becomes scrolling tabs, the calendar switches to an agenda list, and wide tables scroll sideways. Checked at phone (375px), tablet (800px) and desktop (1366px) widths.
- **Validation**: data annotations checked on the server, plus client-side validation using jQuery Unobtrusive Validation.
- **Friendly errors**: custom 404/403 pages and an error page for unhandled exceptions.

## 2. Technology stack

| Layer | Technology |
|-------|------------|
| Framework | ASP.NET Core 8 MVC (C# 12) |
| Data access | Entity Framework Core 8 (code-first) |
| Database | SQLite by default (file `App_Data/learnhub.db`); SQL Server supported (see §6) |
| Front end | Razor views, HTML5, CSS3, JavaScript, Bootstrap 5.3, Bootstrap Icons |
| Testing | xUnit, with EF Core on an in-memory SQLite database |

## 3. Getting started

**Prerequisite:** the [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0).

```bash
dotnet run --project src/LearnHub.Web
```

Then open **http://localhost:5080**. The first run creates the database and fills it with demo data.

Demo accounts:

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@learnhub.local` | `Admin@123` |
| Instructor | `priya@learnhub.local` / `rahul@learnhub.local` | `Teach@123` |
| Student | `aarav@learnhub.local` / `diya@learnhub.local` / `kabir@learnhub.local` | `Learn@123` |

To reset to the demo data, stop the app and delete `src/LearnHub.Web/App_Data/`.

In Visual Studio 2022, open `LearnHub.sln` and press **F5**.

## 4. Running the tests

```bash
dotnet test
```

20 unit tests cover the business rules: registration and login, password change, ownership checks,
enrollment (no duplicates, students only, published courses only), submissions (must be enrolled,
resubmission, late detection, locked after grading), grading (score range, only the course owner),
cascading deletes and admin user management.

## 5. Architecture

```
Browser ──HTTP──▶ Controllers ──▶ LmsService (business rules) ──▶ LmsDbContext (EF Core) ──▶ Database
                     │                                              
                     ├──▶ FileStorageService (App_Data/uploads)
                     └──▶ Razor Views + ViewModels ──▶ HTML (Bootstrap)
```

- **Models** (`Models/Entities.cs`): the entity classes `AppUser`, `Course`, `Enrollment`, `Assignment` and `Submission`.
- **Data** (`Data/`): `LmsDbContext` holds the EF Core configuration (keys, unique indexes, delete behaviour), and `DbSeeder` loads the demo data.
- **Services** (`Services/`): `LmsService` holds every business rule, so controllers stay thin and the rules can be unit-tested. `FileStorageService` handles uploads.
- **Controllers**: `Home`, `Account`, `Dashboard`, `Courses` (catalog plus the course pages: home, assignments, grades/gradebook, people, settings), `Assignments`, `Submissions` (grading screen), `Calendar`, `Grades` and `Admin`.
- **Layouts**: `_Layout` (app shell with the navigation rail, or the public site header), `_CourseLayout` (course banner and course navigation, nested inside `_Layout`) and `_AuthLayout` (split-screen sign-in).
- **ViewModels**: typed models for forms and pages, kept separate from the entities so that model binding cannot overwrite fields like `Score`. This prevents over-posting.

See [docs/DESIGN.md](docs/DESIGN.md) for the database schema, the request flows and a mapping from the project objectives to the implementation.

## 6. Using SQL Server instead of SQLite

1. `dotnet add src/LearnHub.Web package Microsoft.EntityFrameworkCore.SqlServer --version 8.0.10`
2. In `Program.cs`, replace `options.UseSqlite(connectionString)` with `options.UseSqlServer(connectionString)`.
3. In `appsettings.json`, set
   `"LmsDb": "Server=(localdb)\\mssqllocaldb;Database=LearnHub;Trusted_Connection=True;TrustServerCertificate=True"`

The model is already set up for SQL Server: delete behaviours avoid multiple cascade paths.

## 7. Project structure

```
LearnHub.sln
├── src/LearnHub.Web/
│   ├── Controllers/        MVC controllers
│   ├── Data/               DbContext + seed data
│   ├── Infrastructure/     claims helpers, query projections, view helpers
│   ├── Models/             entity classes
│   ├── Services/           business logic + file storage
│   ├── ViewModels/         form / page models
│   ├── Views/              Razor views (per controller + Shared)
│   ├── wwwroot/            site.css, site.js
│   ├── Program.cs          startup: DI, EF Core, authentication, routing
│   └── appsettings.json    connection string, upload limits
├── tests/LearnHub.Tests/   xUnit tests
└── docs/DESIGN.md          design document
```
