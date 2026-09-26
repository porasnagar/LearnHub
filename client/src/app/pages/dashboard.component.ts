import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api.service';
import { AssignmentMini } from '../core/models';
import { Auth } from '../core/services';
import { artFor, dueText, firstName, greeting, isoDate, letterGrade, score, toneStyle } from '../core/util';
import { IconComponent } from '../shared/icon.component';
import {
  AvatarComponent, BarsComponent, CountUpDirective, CourseArtComponent, CourseCardComponent, DateTileComponent, EmptyComponent, RingComponent
} from '../shared/ui';

@Component({
  selector: 'lh-dashboard',
  imports: [RouterLink, DatePipe, NgTemplateOutlet, IconComponent, AvatarComponent, BarsComponent, CountUpDirective, CourseArtComponent, CourseCardComponent,
    DateTileComponent, EmptyComponent, RingComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head fade-in">
        <div>
          <p class="muted strong small">{{ today | date: 'EEEE, MMMM d' }}</p>
          <h1 class="page-title">{{ hello }}, {{ name() }}</h1>
        </div>
        @if (auth.isStudent()) {
          <a routerLink="/catalog" class="btn btn-glass"><lh-icon name="explore" /> Find a course</a>
        } @else {
          <a routerLink="/courses/new" class="btn btn-ink"><lh-icon name="plus" /> New course</a>
        }
      </div>

      @if (!d()) {
        <div class="bento">
          <div class="skeleton span-7" style="height:230px"></div><div class="skeleton span-5" style="height:230px"></div>
          <div class="skeleton span-4" style="height:260px"></div><div class="skeleton span-4" style="height:260px"></div><div class="skeleton span-4" style="height:260px"></div>
        </div>
      } @else {
        @let data = d()!;
        @if (data.role === 'Student') {
          <!-- ================= STUDENT ================= -->
          <div class="bento stagger">
            @if (data.nextUp; as n) {
              <a class="card card-lg next span-7 link-card" [routerLink]="['/courses', n.courseId, 'assignments', n.id]" [attr.style]="tone(n.courseId)">
                <div class="next-copy">
                  <span class="pill-live"><span class="live-dot"></span>{{ due(n.dueDate) }}</span>
                  <div class="tiny strong upper mt-3">Up next · {{ n.courseCode }}</div>
                  <h2 class="next-title serif">{{ n.title }}</h2>
                  <p class="small">{{ n.courseTitle }} · {{ n.maxPoints }} points</p>
                  <span class="btn btn-ink mt-3">Open assignment <lh-icon name="arrow-right" class="sm" /></span>
                </div>
                <lh-course-art class="next-art" [kind]="art(n.courseCategory)" />
              </a>
            } @else {
              <div class="card card-lg span-7 tone" style="--tone: var(--mint)">
                <lh-empty icon="check-circle" title="You're all caught up" text="Nothing is due right now. Enjoy the calm, or explore a new course." />
              </div>
            }

            <div class="card card-lg span-5">
              <div class="card-head"><div><div class="card-title">Progress</div><div class="card-sub">All coursework this term</div></div></div>
              <div class="row">
                <div class="big-num serif"><span [lhCountUp]="completion()"></span><small>%</small></div>
                <div class="small muted">of assignments<br>handed in</div>
              </div>
              <div class="segbar mt-3" aria-hidden="true">
                @for (s of segments(); track s.label) { <span [style.flex]="s.value || 0.0001" [style.background]="s.color"></span> }
              </div>
              <div class="legend mt-3">
                @for (s of segments(); track s.label) {
                  <div class="lg-item"><span class="lg-dot" [style.background]="s.color"></span><span class="grow small">{{ s.label }}</span><span class="strong">{{ s.value }}</span></div>
                }
              </div>
            </div>

            <div class="card span-4">
              <div class="card-head"><div><div class="card-title">Activity</div><div class="card-sub">Submissions, last 7 days</div></div>
                <span class="big-sm serif" [lhCountUp]="weekTotal()"></span></div>
              <lh-bars [bars]="bars()" [height]="170" />
            </div>

            <div class="card span-4 grade-card">
              <div class="card-head"><div><div class="card-title">Current grade</div><div class="card-sub">Across graded work</div></div>
                <a routerLink="/grades" class="btn btn-glass btn-sm">All grades</a></div>
              <div class="ring-wrap">
                <lh-ring [percent]="overall() ?? 0" [center]="overall() === null ? '–' : (overall()!.toFixed(0) + '%')"
                         [caption]="overall() === null ? 'No grades yet' : 'Letter grade ' + letter(overall()!)" [size]="176" />
              </div>
            </div>

            <div class="card span-4">
              <div class="card-head"><div><div class="card-title">This week</div><div class="card-sub">{{ weekItems().length }} due in the next 7 days</div></div>
                <a routerLink="/calendar" class="btn btn-glass btn-icon btn-sm" aria-label="Open calendar"><lh-icon name="calendar" class="sm" /></a></div>
              <ng-container [ngTemplateOutlet]="weekStrip" />
            </div>
          </div>

          <section class="stack">
            <div class="row between"><h2 class="section-title">My courses</h2><a routerLink="/courses" class="small strong">View all</a></div>
            @if (data.courses.length) {
              <div class="cards-grid stagger">@for (c of data.courses; track c.id) { <lh-course-card [c]="c" [mine]="true" /> }</div>
            } @else {
              <div class="card"><lh-empty icon="courses" title="No courses yet" text="Browse the catalog to enroll in your first course."><a routerLink="/catalog" class="btn btn-ink btn-sm">Browse catalog</a></lh-empty></div>
            }
          </section>

          <div class="bento stagger">
            <div class="card" [class.span-7]="data.missing.length" [class.span-12]="!data.missing.length">
              <div class="card-head"><div class="card-title">Recent feedback</div></div>
              @for (g of data.recentGrades; track g.submissionId) {
                <a class="fb" [routerLink]="['/courses', g.courseId, 'assignments', g.assignmentId]" [attr.style]="tone(g.courseId)">
                  <div class="fb-score serif">{{ fmt(g.score) }}<small>/{{ g.maxPoints }}</small></div>
                  <div class="grow">
                    <div class="row between"><span class="strong">{{ g.assignmentTitle }}</span><span class="code-chip">{{ g.courseCode }}</span></div>
                    @if (g.feedback) { <p class="small muted mt-1">“{{ g.feedback }}” — {{ g.instructorName }}</p> }
                  </div>
                </a>
              } @empty { <lh-empty icon="chat" title="No feedback yet" text="Comments from instructors will appear here." /> }
            </div>
            @if (data.missing.length) {
              <div class="card span-5 missing-card">
                <div class="card-head"><div class="card-title">Missing work</div><span class="status missing">{{ data.missing.length }}</span></div>
                @for (m of data.missing; track m.id) {
                  <a class="list-row" [routerLink]="['/courses', m.courseId, 'assignments', m.id]" [attr.style]="tone(m.courseId)">
                    <lh-date-tile [date]="m.dueDate" />
                    <div class="grow"><div class="strong">{{ m.title }}</div><div class="tiny muted">{{ m.courseCode }} · {{ due(m.dueDate) }}</div></div>
                    <lh-icon name="chevron-right" class="sm muted" />
                  </a>
                }
              </div>
            }
          </div>
        } @else {
          <!-- ================= INSTRUCTOR / ADMIN ================= -->
          <div class="figures stagger">
            @for (f of figures(); track f.key; let i = $index) {
              <div class="card figure" [class.tone]="i === 0 || f.key === 'toGrade'" [style.--tone]="f.key === 'toGrade' ? 'var(--lemon)' : 'var(--lilac)'">
                <div class="fig-ico"><lh-icon [name]="f.icon" /></div>
                <div class="fig-num serif" [lhCountUp]="f.value"></div>
                <div class="fig-label">{{ f.label }}</div>
              </div>
            }
          </div>

          <div class="bento stagger">
            <div class="card span-7">
              <div class="card-head"><div><div class="card-title">Submissions received</div><div class="card-sub">Last 7 days</div></div>
                <div class="row"><span class="big-sm serif" [lhCountUp]="weekTotal()"></span><lh-icon name="trend" class="muted" /></div></div>
              <lh-bars [bars]="bars()" [height]="200" />
            </div>

            <div class="card span-5">
              <div class="card-head"><div><div class="card-title">To grade</div><div class="card-sub">{{ data.pendingTotal }} waiting</div></div></div>
              @for (p of data.pendingGrading; track p.submissionId) {
                <a class="list-row" [routerLink]="['/grade', p.submissionId]">
                  <lh-avatar [name]="p.studentName" size="sm" />
                  <div class="grow"><div class="strong truncate">{{ p.studentName }}</div><div class="tiny muted truncate">{{ p.courseCode }} · {{ p.assignmentTitle }}</div></div>
                  @if (p.isLate) { <span class="status late">Late</span> }
                  <lh-icon name="chevron-right" class="sm muted" />
                </a>
              } @empty { <lh-empty icon="check-circle" title="Inbox zero" text="Every submission has been graded." /> }
            </div>

            <div class="card span-6">
              <div class="card-head"><div><div class="card-title">Assignment completion</div><div class="card-sub">Recent and upcoming work</div></div></div>
              @for (c of data.completion; track c.assignment.id) {
                <a class="comp" [routerLink]="['/courses', c.assignment.courseId, 'assignments', c.assignment.id]" [attr.style]="tone(c.assignment.courseId)">
                  <div class="row between"><span class="strong truncate">{{ c.assignment.title }}</span><span class="small muted nowrap">{{ c.submitted }}/{{ c.enrolled }}</span></div>
                  <div class="meter mt-1" [style.--fill]="'var(--c-deep)'"><span [style.width.%]="c.enrolled ? c.submitted * 100 / c.enrolled : 0"></span></div>
                  <div class="tiny muted mt-1">{{ c.assignment.courseCode }} · due {{ c.assignment.dueDate | date: 'MMM d' }}</div>
                </a>
              } @empty { <lh-empty icon="assignment" title="Nothing scheduled" /> }
            </div>

            <div class="card span-6">
              <div class="card-head"><div><div class="card-title">Coming up</div><div class="card-sub">Next 7 days</div></div>
                <a routerLink="/calendar" class="btn btn-glass btn-icon btn-sm" aria-label="Open calendar"><lh-icon name="calendar" class="sm" /></a></div>
              <ng-container [ngTemplateOutlet]="weekStrip" />
            </div>

            @if (data.role === 'Admin') {
              <div class="card span-12">
                <div class="card-head"><div class="card-title">Newest accounts</div><a routerLink="/admin" class="btn btn-glass btn-sm">Manage users</a></div>
                <div class="users">
                  @for (u of data.recentUsers; track u.id) {
                    <div class="user-chip glass"><lh-avatar [name]="u.fullName" size="sm" /><div class="grow"><div class="strong small truncate">{{ u.fullName }}</div><span class="role {{ u.role }}">{{ u.role }}</span></div></div>
                  }
                </div>
              </div>
            }
          </div>

          <section class="stack">
            <div class="row between"><h2 class="section-title">{{ data.role === 'Admin' ? 'All courses' : 'Courses I teach' }}</h2><a routerLink="/courses" class="small strong">View all</a></div>
            <div class="cards-grid stagger">@for (c of data.courses; track c.id) { <lh-course-card [c]="c" [mine]="true" /> }</div>
          </section>
        }
      }
    </div>

    <ng-template #weekStrip>
      <div class="days">
        @for (day of days(); track day.key) {
          <button class="day" [class.on]="selected() === day.key" [class.today]="day.isToday" (click)="selected.set(selected() === day.key ? null : day.key)">
            <span class="dname">{{ day.date | date: 'EEE' }}</span><span class="dnum">{{ day.date | date: 'd' }}</span>
            <span class="dots">@for (x of day.items.slice(0, 3); track x.id) { <i></i> }</span>
          </button>
        }
      </div>
      <div class="week-list">
        @for (w of weekItems(); track w.id) {
          <a class="list-row" [routerLink]="['/courses', w.courseId, 'assignments', w.id]" [attr.style]="tone(w.courseId)">
            <span class="bar-accent"></span>
            <div class="grow"><div class="strong truncate">{{ w.title }}</div><div class="tiny muted">{{ w.courseCode }} · {{ w.dueDate | date: 'EEE, h:mm a' }}</div></div>
            @if (w.submitted) { <span class="status submitted">Done</span> } @else { <span class="small strong nowrap">{{ w.maxPoints }} pts</span> }
          </a>
        } @empty { <p class="small muted empty-week">Nothing due {{ selected() ? 'that day' : 'this week' }}.</p> }
      </div>
    </ng-template>
  `,
  styles: [`
    .upper { text-transform: uppercase; letter-spacing: .08em; }
    .next { display: flex; justify-content: space-between; gap: 1rem; min-height: 230px; overflow: hidden; background: var(--c); border-color: transparent; color: #16151c; text-decoration: none !important; }
    .next::before { content: ""; position: absolute; inset: 0; background: radial-gradient(circle at 0 0, rgba(255,255,255,.6), transparent 60%); pointer-events: none; }
    .next-copy { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: flex-start; }
    .next-title { font-size: clamp(1.5rem, 2.6vw, 2.1rem); line-height: 1.15; margin: .35rem 0 .35rem; color: #16151c; }
    .next-art { width: 250px; height: 190px; flex-shrink: 0; align-self: flex-end; margin: -10px -20px -30px 0; transition: transform .6s var(--ease); }
    .next:hover .next-art { transform: rotate(-4deg) scale(1.05); }
    .pill-live { display: inline-flex; align-items: center; gap: .45rem; height: 30px; padding: 0 12px; border-radius: 999px; background: rgba(255,255,255,.7); font-size: .8rem; font-weight: 800; }
    .live-dot { width: 8px; height: 8px; border-radius: 50%; background: #16151c; animation: blink 1.6s infinite; }
    @keyframes blink { 50% { opacity: .25; } }

    .big-num { font-size: 4rem; font-weight: 600; line-height: 1; letter-spacing: -.03em; }
    .big-num small { font-size: 1.6rem; color: var(--muted); }
    .big-sm { font-size: 2rem; font-weight: 600; line-height: 1; }
    .legend { display: grid; grid-template-columns: 1fr 1fr; gap: .5rem 1.2rem; }
    .lg-item { display: flex; align-items: center; gap: .5rem; }
    .lg-dot { width: 10px; height: 10px; border-radius: 4px; }
    .grade-card { display: flex; flex-direction: column; }
    .ring-wrap { flex: 1; display: grid; place-items: center; padding: .5rem 0; }

    .days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; }
    .day { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 8px 0 6px; border-radius: 18px; border: 1px solid var(--glass-border);
      background: var(--glass-strong); cursor: pointer; transition: background .25s, color .25s, transform .2s var(--ease); }
    .day:hover { transform: translateY(-2px); }
    .day.today { box-shadow: inset 0 0 0 2px var(--violet); }
    .day.on { background: var(--violet); color: #fff; border-color: transparent; }
    .dname { font-size: .66rem; font-weight: 700; text-transform: uppercase; opacity: .7; }
    .dnum { font-size: 1.1rem; font-weight: 800; }
    .dots { display: flex; gap: 2px; height: 5px; }
    .dots i { width: 5px; height: 5px; border-radius: 50%; background: currentColor; opacity: .7; }
    .week-list { margin-top: .8rem; display: flex; flex-direction: column; }
    .bar-accent { width: 5px; align-self: stretch; border-radius: 4px; background: var(--c-deep); }
    .empty-week { padding: .8rem .2rem; }

    .list-row { display: flex; align-items: center; gap: .8rem; padding: .7rem .5rem; border-radius: 16px; color: inherit; text-decoration: none !important; transition: background .2s; }
    .list-row:hover { background: var(--glass-strong); }
    .list-row lh-date-tile { width: 46px; height: 50px; }

    .fb { display: flex; gap: 1rem; padding: .9rem .6rem; border-radius: 18px; color: inherit; text-decoration: none !important; transition: background .2s; }
    .fb:hover { background: var(--glass-strong); }
    .fb + .fb { border-top: 1px solid var(--line); }
    .fb-score { min-width: 76px; height: 64px; border-radius: 18px; background: var(--c); color: #16151c; display: grid; place-items: center; font-size: 1.5rem; font-weight: 700; }
    .fb-score small { font-size: .8rem; opacity: .6; }
    .code-chip { font-size: .72rem; font-weight: 800; padding: 3px 9px; border-radius: 999px; background: var(--c); color: #16151c; }

    .figures { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.25rem; }
    .figure { display: flex; flex-direction: column; gap: .2rem; min-height: 150px; }
    .fig-ico { width: 42px; height: 42px; border-radius: 14px; display: grid; place-items: center; background: var(--glass-strong); margin-bottom: auto; }
    .figure.tone .fig-ico { background: rgba(255,255,255,.6); }
    .fig-num { font-size: 2.6rem; font-weight: 600; line-height: 1; margin-top: 1rem; }
    .fig-label { font-weight: 700; color: var(--muted); }
    .figure.tone .fig-label { color: rgba(22,21,28,.62); }
    .comp { display: block; padding: .75rem .5rem; border-radius: 16px; color: inherit; text-decoration: none !important; }
    .comp:hover { background: var(--glass-strong); }
    .users { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: .75rem; }
    .user-chip { display: flex; align-items: center; gap: .7rem; padding: .7rem; border-radius: 18px; }

    @media (max-width: 1180px) { .figures { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 720px) {
      .next { flex-direction: column; }
      .next-art { width: 190px; height: 140px; margin: -20px -20px -30px auto; }
      .big-num { font-size: 3.2rem; }
      .figure { min-height: 130px; }
    }
  `]
})
export class DashboardComponent {
  private api = inject(Api);
  protected auth = inject(Auth);
  protected d = toSignal(this.api.dashboard());
  protected today = new Date();
  protected hello = greeting();
  protected selected = signal<string | null>(null);

  protected name = computed(() => firstName(this.auth.user()?.fullName ?? ''));
  protected tone = toneStyle;
  protected due = dueText;
  protected fmt = score;
  protected letter = letterGrade;
  protected art = artFor;

  protected bars = computed(() => (this.d()?.activity ?? []).map((a, i, all) => ({
    label: new Date(a.day).toLocaleDateString('en-US', { weekday: 'narrow' }), value: a.count, highlight: i === all.length - 1
  })));
  protected weekTotal = computed(() => (this.d()?.activity ?? []).reduce((s, a) => s + a.count, 0));

  protected overall = computed(() => { const d = this.d(); return d && d.possible ? d.earned / d.possible * 100 : null; });
  protected segments = computed(() => {
    const d = this.d();
    if (!d) return [];
    return [
      { label: 'Graded', value: d.gradedCount, color: '#7fd1a4' },
      { label: 'In review', value: d.awaitingCount, color: 'var(--lilac)' },
      { label: 'Upcoming', value: d.upcomingCount, color: 'var(--lemon)' },
      { label: 'Missing', value: d.missing.length, color: '#ff9fb2' },
    ];
  });
  protected completion = computed(() => {
    const d = this.d();
    if (!d) return 0;
    const total = d.gradedCount + d.awaitingCount + d.upcomingCount + d.missing.length;
    return total ? Math.round((d.gradedCount + d.awaitingCount) * 100 / total) : 0;
  });

  protected figures = computed(() => {
    const f = this.d()?.figures ?? {};
    const meta: Record<string, [string, string]> = {
      courses: ['Courses', 'courses'], students: ['Students', 'people'], assignments: ['Assignments', 'assignment'],
      toGrade: ['To grade', 'inbox'], users: ['Users', 'people'], enrollments: ['Enrollments', 'check-circle'], submissions: ['Submissions', 'inbox'],
    };
    return Object.entries(f).map(([key, value]) => ({ key, value, label: meta[key]?.[0] ?? key, icon: meta[key]?.[1] ?? 'info' }));
  });

  /** Seven day pills starting today; each carries the items due that day. */
  protected days = computed(() => {
    const week = this.d()?.week ?? [];
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() + i);
      const key = isoDate(date);
      return { key, date, isToday: i === 0, items: week.filter(w => isoDate(new Date(w.dueDate)) === key) };
    });
  });
  protected weekItems = computed<AssignmentMini[]>(() => {
    const sel = this.selected();
    const week = this.d()?.week ?? [];
    return sel ? week.filter(w => isoDate(new Date(w.dueDate)) === sel) : week;
  });
}
