# LearnHub — UI & Product Design Plan

## 0. Current design brief (v3, Angular client)

Sections 1–8 below record earlier iterations. The information architecture still applies: a course page with Home, Assignments, Grades, People and Settings tabs; a calendar; a gradebook; and a grading screen. This section is the contract for the current visual design. Tokens live in `client/src/styles.scss`.

### Who uses it, where, and for how long
- **Students:** on a phone, mostly in 30-second checks between classes ("what's due, did I get my grade?"), and for a few minutes when submitting work. So the to-do list is the hero, touch targets are at least 44px, and the bottom tab bar comes first.
- **Instructors:** on a laptop, in 30–60 minute grading sessions. So tables are dense, surfaces are calm, and the grading screen has previous/next controls.
- **Admins:** occasional use. Plain tables are enough.
- **Theme:** light follows the system setting; dark mode is there for evening study.

### References (conventions borrowed)
| Reference | What we borrow |
|---|---|
| Canvas | The To-do list, the gradebook matrix, and SpeedGrader's next/previous grading flow |
| Google Classroom app | The classwork list, course colour per class, and the bottom tab bar |
| Things 3 / Apple Reminders | Calm due-date lists: one row per item, with the date on the left |
| The owner's references (Mondly, Next Skill, the class-schedule app) | Pastel course colours, the day-pill week strip, and soft rounded shapes |

### What each colour means
| Hue | Meaning — and nothing else |
|---|---|
| Ink `#17161D` | Text and the primary action button |
| Purple gradient `--nav-grad` (`#9B84FF` → `#4B31CF`) | The active navigation item (sidebar and phone tab bar) and the selected day in the landing preview. Owner's request |
| Violet `#5B45E0` | Links, focus ring, "today" and the current selection |
| Eight course pastels | Which course something belongs to (date tile, course chip, banner). Never a status |
| Red | Missing or overdue work |
| Amber | Late, or waiting for the instructor to grade |
| Green | Graded, or on time |
| Blue | Submitted and waiting |
| Greys | Everything else |

Lemon is no longer used as decoration; it is only one of the course pastels.

### The one layout primitive
The **due row** is repeated everywhere: a course-coloured date tile, then the title, then course code and points, then a status or score on the right. It appears on the dashboard, the course assignment lists, the calendar agenda, grades and the grading queue.

### Tells removed
- The drifting aurora blobs.
- Glass on content cards.
- Coloured shadows and glows.
- The badge pill above the hero headline.
- The serif-italic accent word.
- Gradient text and gradient hero backgrounds.
- The row of four big KPI tiles.
- ALL-CAPS labels.
- Icons sitting in coloured squares.
- Coloured left stripes on rows.
- Floating, pulsing, blinking and count-up animations, and staggered card entrances.
- Vague copy ("beautifully organised", "one calm workspace").

### Tells kept on purpose (with reasons)
- **Frosted glass on floating chrome only** — the top bar, mobile tab bar and dialog scrim. Content scrolls underneath these, and the owner asked for glass.
- **Rounded shapes** — 16px on cards, 12px on controls, pills for chips and the tab bar. This is a consumer study app, not a dense tool, and the references are rounded.
- **Source Serif 4 for page titles and big numbers only** — the owner chose these fonts.
- **Flat course illustrations on course banners** — they let you tell courses apart at a glance.
- **A purple gradient on the active navigation item** — the owner asked for the nav highlight "purple, with shades", with the bar's border kept white. The same gradient marks other "you are here / selected" states: segmented controls, active filter chips, today in the calendar, and the one glowing call to action per screen (`.btn-glow`).
- **Glowing glass (v3.2, owner's request)** — cards are translucent (`--glass-card`) over a soft, static colour field (`--ambient` on `body::before`), with a 1px light-catching edge (a masked gradient ring) and a soft shadow. On desktop a faint light follows the cursor across cards. Cards have **no backdrop blur on purpose**: what's behind them is already a soft gradient, so blur would look the same and cost GPU time on every scroll frame (it made Android phones stutter before). Real blur is kept for things content scrolls under: the top bar, the phone tab bar, and floating panels (`.glass-panel`: notifications, search, dialogs, toasts). The colour field doesn't move, because animating it would make those frosted bars re-blur on every frame.

### Motion
The owner asked for soft animation throughout (v3.1). The rules that keep it calm:
- **Ease-out with no overshoot.** No bounce or elastic curves.
- **Short.** About 200–400ms for movement. Chart fills (meters, rings, bars) take up to 1s, once, when they first appear.
- **Only transform and opacity**, so nothing reflows. Entrance animations use `animation-fill-mode: backwards` so no transform stays behind afterwards, because a lingering transform would trap `position: fixed` children.
- **Nothing loops.** The exceptions are loading indicators, and the bell rings once when there are unread items.
- **`prefers-reduced-motion` turns all of it off.**

What moves:
- One highlight glides between items in the sidebar, the phone tab bar and every segmented control (`GlideDirective`). It settles with a slight spring (about 4% overshoot) — the one place overshoot is allowed.
- A soft ripple spreads from where you press buttons, tabs, rows and chips (`Interactions`).
- Big numbers count up (`CountUpDirective`): the term grade, handed-in count, course stats, the what-if projection.
- Switching theme spreads the new theme in a circle from the button you pressed (a view transition).
- During page changes the sidebar, top bar and tab bar stay still (their own `view-transition-name`); only the content cross-fades.
- Primary buttons lift and catch a light sheen on hover; course illustrations float up when you hover their card.
- Loading placeholders shimmer.
- Pages and course tabs rise 10px and fade in (340ms). The app shell is excluded because it holds the fixed sidebar and tab bar.
- Rows in `.due-list`, cards in `.cards-grid` and tiles in `.bento` arrive 45ms apart (capped at 300ms).
- Link cards lift 2px on hover. Buttons and calendar days press in slightly.
- Meters, segment bars, rings and bar charts fill from zero.
- The bell panel and the Ctrl+K palette drop in from their trigger. Dialogs rise in.
- A calendar month slides in from the side you moved towards.
- The phone tab pill widens to show its label.

## 1. Why the first UI felt "AI-generated"

| Symptom | Why it reads as a generic template |
|---------|-------------------------------------|
| Purple→violet gradients, gradient logo tile | The default look of AI-generated SaaS pages |
| Inter font everywhere, big rounded cards, hover lift | Startup landing-page styling, not an academic tool |
| Colored icon squares on stat cards, emoji greeting | Decoration with no information |
| A top navbar with a few links | Real LMSs are *applications*: global nav rail + course-level nav |
| No course identity | In Canvas, Classroom and Moodle every course has a color, a banner and its own sub-navigation |
| Missing core LMS screens | No calendar, no gradebook, no per-course grades, no grading workflow |

## 2. Reference products

| Product | Pattern we adopt |
|---------|------------------|
| **Canvas LMS** | Dark global navigation rail with icon + label; course sub-nav (Home, Assignments, Grades, People, Settings); dashboard course cards with colored headers; right-hand "To Do" list; red "Missing" / amber "Late" labels |
| **Google Classroom** | Course banner with the course name on a colored header |
| **Moodle / Brightspace** | Breadcrumb trail on every page; dense, table-first admin screens |
| **Canvas SpeedGrader** | Grading screen that shows the submission as a document, with a student switcher (previous / next) and a grading panel on the side |
| **Coursera / edX catalog** | Subject filters on the left, course results as rows |
| **University SSO pages** | Split sign-in screen: institutional panel on the left, form on the right |

## 3. Design language

**Personality:** institutional, calm, trustworthy, information-dense. It should feel like software a university licenses, not a startup landing page.

### Color
| Token | Value | Use |
|-------|-------|-----|
| Navy 900 | `#102A4C` | Global nav rail, public hero, sign-in panel |
| Navy 950 | `#0B1A33` | Public footer |
| Action blue | `#0A5BB5` | Links, primary buttons, focus rings |
| Academic gold | `#D4A02A` | Logo, active nav indicator, overlines on dark backgrounds (accent only) |
| Ink / muted | `#1C2230` / `#5F6878` | Body text / secondary text |
| Line | `#D8DDE4` | 1px borders (panels are bordered, almost no shadows) |
| Page | `#F3F4F6` | App background |
| Status colors | green `#17784A`, amber `#9A5B00`, red `#B3261E`, blue `#0A5BB5` | Graded / Late / Missing / Submitted |

**Course colors:** a fixed palette of 8 deep academic colors (navy, burgundy, forest, bronze, plum, teal, rust, slate). A course's color is chosen from its id. The color is reused on the course's banner, card header, calendar entries and date blocks, so a course is recognizable anywhere in the app.

### Typography
- **Source Serif 4** for page titles, course titles and grade numbers. It gives the academic, publishing feel.
- **Source Sans 3** for all UI text. It is a humanist sans (used by Coursera) and readable at small sizes.
- Section headings in panels are small uppercase labels ("TO DO", "RECENT FEEDBACK"), as in Canvas sidebars.

### Shape & texture
- Corner radius 4–6px. No pill-shaped buttons and no rounded "bubbles".
- A **graph-paper grid** texture on course banners and on the navy hero. It is a subtle education cue that doesn't need stock photos.
- Flat panels with 1px borders. Tables are the main way lists are shown.

## 4. Information architecture

```
Public (signed out)                App (signed in) — global nav rail
├── Home (campus portal)           ├── Account      (profile & password)
├── Course catalog                 ├── Dashboard    (cards + To Do / To Grade)
├── Course home (public overview)  ├── Courses      (all my courses, table)
├── Sign in (split screen)         ├── Calendar     (month grid / agenda of due dates)
└── Create account                 ├── Grades       (students: grade per course)
                                   ├── Catalog      (browse + enroll)
                                   ├── Admin        (users, all courses) — admins only
                                   └── Sign out

Course shell (inside any course): banner + course navigation
├── Home         syllabus/description, upcoming work, progress, instructor
├── Assignments  grouped Upcoming / Past, status per assignment
│   └── Assignment  instructions, submission panel, feedback
├── Grades       student: own grades + current grade · instructor: gradebook matrix + CSV export
├── People       class list (instructors/admins)
└── Settings     edit course, publish/unpublish, delete (instructors/admins)

Grading screen (SpeedGrader-style): document view · student switcher · score + comments · "Save & next"
```

## 5. Screen plans

| Screen | Layout |
|--------|--------|
| **Public home** | White header; navy graph-paper hero with a serif headline and a catalog search box; "Browse by subject" panel with course counts; featured course cards; "Built for every role" three-column checklist; navy footer |
| **Sign in / Register** | Split screen. Left: navy panel with the logo, a value statement and three product points. Right: the form. Sign-in has a "Demo environment" box where clicking an account fills the form. Register picks the role with two selectable cards |
| **Dashboard (student)** | Course cards (colored graph-paper header, serif title, instructor, progress meter, shortcut icons). Right column: *To Do* (date blocks tinted with the course color), *Missing*, *Recent feedback* |
| **Dashboard (instructor)** | Course cards showing student count and "N to grade". Right column: *To Grade* queue and *Coming Up* due dates |
| **Dashboard (admin)** | Figures strip (users, courses, enrollments, submissions), courses table, newest accounts, grading backlog |
| **Courses** | Table: color swatch, course, instructor, subject, progress or students, status |
| **Catalog** | Left filter column (search, subjects with counts), result rows with a colored course tile, meta line and an Enrolled / View button |
| **Course home** | Banner + course nav. Main: About this course, upcoming assignments. Side: your progress and current grade (student) or course status and shortcuts (instructor), instructor card, course facts |
| **Assignments** | Upcoming and Past groups; each row has the title, due date and points, plus a status label (student) or submitted/to-grade counts (instructor) |
| **Assignment** | Title, a facts row (due, points, submission type), instructions. Student: submission shown as a document, resubmit form, grade and feedback shown as a comment from the instructor. Instructor: submissions table, grading figures, "Start grading" |
| **Grades (student)** | Table per assignment (due, status, score, out of) with a total row; current-grade panel with percent and letter grade |
| **Gradebook (instructor)** | Matrix: students × assignments with a sticky student column. Each cell shows a score, "Missing", a "Grade" link or "–". Class-average row, total column, CSV export |
| **Grading screen** | Full width. Top bar with the assignment and a student switcher (‹ select ›, "2 of 5"). Left: the submission as a document page on grey, plus an attachment card. Right: score / max, live letter grade, comment, "Save" and "Save & next" |
| **Calendar** | Month grid (Sunday–Saturday) with color-coded due-date chips and today highlighted; previous / today / next navigation; list of course calendars; agenda list on phones |
| **People** | Instructor row, then students with enrolled date, submission progress and a remove action |
| **Admin** | Tabs (Users / Courses), filter toolbar, dense tables, inline role change |

## 6. Components

- **Page header**: breadcrumb trail + serif title + actions, separated from the content by a rule.
- **Panel**: white, 1px border, small uppercase header.
- **Status label**: a small square-cornered label with a dot. Variants: Not submitted, Submitted, Late, Missing, Graded, Unpublished, Published.
- **Date block**: a mini calendar leaf. The month strip is in the course color and the day is in serif type.
- **Meter**: a thin 6px progress bar in the course color.
- **Letter grade**: A–F with +/−, from the percentage (93+ A, 90 A−, 87 B+ …).
- **Comment**: avatar + name + timestamp + bubble, used for instructor feedback.
- **Empty state**: one left-aligned sentence plus an action. No giant icons.

## 7. Responsive behaviour

| Width | Behaviour |
|-------|-----------|
| ≥ 992px | Fixed 88px navy rail; course nav is a vertical list beside the content |
| < 992px | The rail becomes a navy top bar with a hamburger that opens the same nav in an off-canvas drawer; course nav becomes horizontally scrolling tabs |
| < 768px | The calendar switches from the month grid to an agenda list; wide tables (gradebook, users) scroll sideways with the student column pinned |

## 8. Accessibility

- Text/background contrast is at least 4.5:1, including white text on every course color.
- Visible 3px blue focus rings.
- Status is never shown by color alone: every status label has text.
- Landmarks (`nav`, `main`, `aside`) are labelled, and breadcrumbs use `aria-label`.
- The app works without JavaScript. JS only adds conveniences such as filling the demo account, confirmation dialogs and the live letter grade.
