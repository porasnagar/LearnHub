# LearnHub — Online Learning Management System

LearnHub is a learning management system with:
- an **ASP.NET Core 8** back end (MVC controllers exposing a JSON Web API, **Entity Framework Core**, cookie authentication);
- an **Angular 19** front end.

Instructors publish courses and assignments. Students enroll, submit their work, and get grades and written feedback. Administrators manage the platform.

---

## 1. Features

| Role | What they can do |
|------|------------------|
| **Visitor** | Landing page with a working preview of a student's week (real dates from today; tap a day to filter), one-tap student and instructor demos, course catalog (search and subject filters), public course overview |
| **Student** | Register and sign in; enroll in and leave courses. Dashboard with an "Up next" card, a progress breakdown, a 7-day activity chart, current grade, a week strip with day pills, course cards and recent feedback. Calendar with month and list views, and an .ics export for Google Calendar, Apple Calendar or Outlook. Submit text and/or a file (drag and drop) and resubmit until the work is graded. Grades for each course, plus an overview across courses and a "what-if" calculator that projects the course grade and works out the average needed for a target letter. Course announcements. |
| **Instructor** | Create, edit, publish and delete their own courses, with a live preview card. Assignments; class list; gradebook matrix with CSV export. Grading screen (SpeedGrader-style) with a student switcher, a score slider, a live letter grade and "Save & next". Dashboard with figures, a submissions chart, a grading queue and assignment completion. Course announcements: post, pin, delete. |
| **Admin** | Everything an instructor can do, on every course, plus user administration (filter, change roles, delete accounts) |

**Everyone signed in** gets a notifications bell (new grades, work due within 48 hours, missing work, announcements, and new hand-ins for staff), a Ctrl/Cmd+K search palette (pages, courses, assignments, and people for admins; also opens with "/"), and can change their display name.

The interface has opaque cards on a soft canvas, with frosted glass only on the floating top bar, the phone tab bar and dialogs. It has light and dark themes. The active navigation item is a purple gradient pill. The icon set and logo are LearnHub's own, and each course gets a pastel colour and a flat illustration based on its subject. Motion is soft: pages rise in, lists arrive one row after another, and meters, rings and bars fill. All of it respects the system's reduced-motion setting.

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

24 xUnit tests cover the business rules:
- registration, login and password change;
- ownership checks;
- enrollment;
- submissions (enrollment required, resubmission, late detection, locked once graded);
- grading range;
- cascading deletes;
- admin user management;
- announcements (who can post, pin and delete; removed with their course) and display-name changes.

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
  - `DashboardController`, `CalendarController`, `GradesController`, `AdminController`;
  - `FeaturesControllers.cs` — announcements, notifications, search and the calendar `.ics` export.

**Front end**
- `core/` — typed `Api` service, `models.ts` (mirrors the C# DTOs), `Auth` / `Toasts` / `Confirm` / `Theme` services, route guards, error interceptor.
- `shared/` — icon set and logo; avatar, course illustration, ring and bar charts, course card, announcements, toasts and dialog.
- `layout/` — the shell (sidebar, top bar, phone tab bar), the notifications bell and the Ctrl+K search palette.
- `pages/` — one lazy-loaded component per screen. The course pages live under `pages/course/`, which has its own child routes and a shared `CourseStore`.

**Security**
- The session cookie is HttpOnly and SameSite=Strict.
- Every POST/PUT/DELETE must carry an `X-XSRF-TOKEN` header that matches the `XSRF-TOKEN` cookie. ASP.NET Core issues the cookie, Angular sends the header, and `AutoValidateAntiforgeryToken` checks it.
- API calls answer with 401/403 instead of redirecting to a login page.
- Deleted or re-roled accounts are signed out on their next request.
- Uploads are stored outside the web root, and each download checks the caller's access.

See [docs/DESIGN.md](docs/DESIGN.md) for the database schema and the business rules, and [docs/UI-DESIGN.md](docs/UI-DESIGN.md) for the design system.

## 6. Deployment

The repo ships a multi-stage `Dockerfile`. Node builds the Angular client, the .NET SDK publishes the API, and the result runs on the small ASP.NET runtime image. Anything that can run a container can host LearnHub.

Runtime settings:
- **`DataDirectory`** (the image sets it to `/data`) holds the SQLite database, uploaded files and the cookie-encryption keys. **Mount persistent storage there**, or all data resets on every restart.
- **`PORT`** is the port the app listens on. It defaults to 8080, and most platforms inject it automatically.
- HTTPS is handled by the platform's proxy. The app trusts `X-Forwarded-Proto`.

**Render** (simplest, deploys from GitHub):
1. Go to render.com and choose **New → Blueprint**.
2. Pick this repo. `render.yaml` creates the web service and a 1 GB disk mounted at `/data`.
3. Every push to `main` redeploys.

Disks need the paid *Starter* instance. On the free instance the app works, but the database resets on each deploy or restart, and the service sleeps after about 15 minutes idle. That's fine for a demo, since the seed data is recreated automatically.

**Azure App Service (Linux)** is the natural choice for .NET, and Azure for Students includes free credit:
1. Create a Web App, choosing *Container* as the publish type and linking this GitHub repo or an image pushed to a registry.
2. Add the app setting `DataDirectory=/home/data`, because `/home` is persistent storage on App Service.
3. Add the app setting `WEBSITES_PORT=8080`.

**Local container**:

```bash
docker build -t learnhub .
docker run -p 8080:8080 -v learnhub-data:/data learnhub
```

Then open http://localhost:8080.

## 7. Using SQL Server instead of SQLite

1. Add the SQL Server provider:
   ```bash
   dotnet add src/LearnHub.Web package Microsoft.EntityFrameworkCore.SqlServer --version 8.0.10
   ```
2. In `Program.cs`, replace `UseSqlite(connectionString)` with `UseSqlServer(connectionString)`.
3. In `appsettings.json`, set:
   ```json
   "LmsDb": "Server=(localdb)\\mssqllocaldb;Database=LearnHub;Trusted_Connection=True;TrustServerCertificate=True"
   ```

## 8. Project structure

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
