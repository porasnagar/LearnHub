# LearnHub — Online Learning Management System

LearnHub is a learning management system with:
- an **ASP.NET Core 8** back end (MVC controllers exposing a JSON Web API, **Entity Framework Core**, cookie authentication);
- an **Angular 19** front end.

Instructors publish courses and assignments. Students enroll, submit their work, and get grades and written feedback. Administrators manage the platform.

---

## 1. Features

| Role | What they can do |
|------|------------------|
| **Visitor** | Landing page, course catalog (search and subject filters), public course overview |
| **Student** | Register and sign in; enroll in and leave courses. Dashboard with an "Up next" card, a progress breakdown, a 7-day activity chart, current grade, a week strip with day pills, course cards and recent feedback. Calendar. Submit text and/or a file (drag and drop) and resubmit until the work is graded. Grades for each course, plus an overview across courses. |
| **Instructor** | Create, edit, publish and delete their own courses, with a live preview card. Assignments; class list; gradebook matrix with CSV export. Grading screen (SpeedGrader-style) with a student switcher, a score slider, a live letter grade and "Save & next". Dashboard with figures, a submissions chart, a grading queue and assignment completion. |
| **Admin** | Everything an instructor can do, on every course, plus user administration (filter, change roles, delete accounts) |

The interface uses frosted-glass panels over a soft animated background, with light and dark themes. On desktop there's a glass sidebar; on phones there's a floating glass tab bar with an animated pill for the active tab. The icon set and logo are LearnHub's own, and each course gets a pastel color and a flat illustration based on its subject. Motion includes staggered card entrances, counting numbers, bars and rings that draw themselves, and page transitions. All of it respects the system's reduced-motion setting.

## 2. Technology stack

| Layer | Technology |
|-------|------------|
| Front end | Angular 19 (standalone components, signals, lazy-loaded routes), TypeScript, SCSS |
| Back end | ASP.NET Core 8 MVC — API controllers returning JSON (C# 12) |
| Data access | Entity Framework Core 8 (code-first) |
| Database | SQLite (`App_Data/learnhub.db`); SQL Server supported (see §6) |
| Security | Cookie auth + roles, PBKDF2 password hashing, anti-forgery (XSRF) tokens on every write |
| Testing | xUnit (business rules) + an end-to-end API test script |

## 3. Getting started

Prerequisites:
- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- [Node.js](https://nodejs.org) 18.19+, 20 or 22

```bash
dotnet run --project src/LearnHub.Web
```

Open **http://localhost:5080**. The first build installs the client's npm packages and builds the Angular app into `wwwroot` (see `LearnHub.Web.csproj`). The first run also creates and seeds the database.

**Front-end development with hot reload:** keep the API running, then in a second terminal start the Angular dev server. It proxies `/api` to port 5080.

```bash
cd client && npm start
```

Then open **http://localhost:4200**.

Demo accounts:

| Role | Email | Password |
|------|-------|----------|
| Student | `aarav@learnhub.local` (also diya, kabir, ananya, vihaan, ishita, rohan, sara, arjun, neha) | `Learn@123` |
| Instructor | `priya@learnhub.local` / `rahul@learnhub.local` / `meera@learnhub.local` | `Teach@123` |
| Admin | `admin@learnhub.local` | `Admin@123` |

The seed is a realistic term: 7 courses, about 22 assignments and several weeks of submissions and grades, with all dates relative to today. To reset it, stop the app and delete `src/LearnHub.Web/App_Data/`.

## 4. Tests

```bash
dotnet test
```

20 xUnit tests cover the business rules:
- registration, login and password change;
- ownership checks;
- enrollment;
- submissions (enrollment required, resubmission, late detection, locked once graded);
- grading range;
- cascading deletes;
- admin user management.

## 5. Architecture

```
Angular SPA (client/)                          ASP.NET Core (src/LearnHub.Web)
┌──────────────────────────┐   JSON /api/*   ┌────────────────────────────────────────┐
│ pages → Api service      │ ──────────────▶ │ Api/*Controller (MVC, [ApiController]) │
│ Auth / Theme / Toasts    │  cookie + XSRF  │   → LmsService (business rules)        │
│ guards, interceptor      │ ◀────────────── │   → LmsDbContext (EF Core) → SQLite    │
└──────────────────────────┘                 │   → FileStorageService (App_Data)      │
     built into wwwroot/  ─── served by ───▶ │ static files + SPA fallback            │
                                             └────────────────────────────────────────┘
```

**Back end**
- `Models/` — entities.
- `Data/` — `LmsDbContext` and the seeder.
- `Services/` — `LmsService` (all business rules; unit-tested) and `FileStorageService`.
- `Api/` — controllers and DTOs:
  - `AuthController` — sign-in, registration, sign-out, profile, password;
  - `CoursesController` — catalog, course pages, gradebook, CSV export, class list, enrollment, create/update/delete;
  - `AssignmentsController` and `SubmissionsController` — assignment pages, submitting, downloads, grading;
  - `DashboardController`, `CalendarController`, `GradesController`, `AdminController`.

**Front end**
- `core/` — typed `Api` service, `models.ts` (mirrors the C# DTOs), `Auth` / `Toasts` / `Confirm` / `Theme` services, route guards, error interceptor.
- `shared/` — icon set and logo; avatar, course illustration, ring and bar charts, count-up, course card, toasts and dialog.
- `layout/shell` — sidebar, top bar and mobile tab bar.
- `pages/` — one lazy-loaded component per screen. The course pages live under `pages/course/`, which has its own child routes and a shared `CourseStore`.

**Security**
- The session cookie is HttpOnly and SameSite=Strict.
- Every POST/PUT/DELETE must carry an `X-XSRF-TOKEN` header that matches the `XSRF-TOKEN` cookie. ASP.NET Core issues the cookie, Angular sends the header, and `AutoValidateAntiforgeryToken` checks it.
- API calls answer with 401/403 instead of redirecting to a login page.
- Deleted or re-roled accounts are signed out on their next request.
- Uploads are stored outside the web root, and each download checks the caller's access.

See [docs/DESIGN.md](docs/DESIGN.md) for the database schema and the business rules, and [docs/UI-DESIGN.md](docs/UI-DESIGN.md) for the design system.

## 6. Using SQL Server instead of SQLite

1. Add the SQL Server provider:
   ```bash
   dotnet add src/LearnHub.Web package Microsoft.EntityFrameworkCore.SqlServer --version 8.0.10
   ```
2. In `Program.cs`, replace `UseSqlite(connectionString)` with `UseSqlServer(connectionString)`.
3. In `appsettings.json`, set:
   ```json
   "LmsDb": "Server=(localdb)\\mssqllocaldb;Database=LearnHub;Trusted_Connection=True;TrustServerCertificate=True"
   ```

## 7. Project structure

```
LearnHub.sln
├── client/                    Angular 19 front end (npm start / npm run build)
│   └── src/app/{core,shared,layout,pages}
├── src/LearnHub.Web/          ASP.NET Core back end
│   ├── Api/                   API controllers + DTOs
│   ├── Data/  Models/  Services/
│   └── Program.cs             DI, EF Core, auth, XSRF, SPA hosting
├── tests/LearnHub.Tests/      xUnit tests
└── docs/                      DESIGN.md, UI-DESIGN.md
```
