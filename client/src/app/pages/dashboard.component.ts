import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { Api } from '../core/api.service';
import { AssignmentMini } from '../core/models';
import { Auth } from '../core/services';
import { ago, artFor, dueText, firstName, greeting, isoDate, letterGrade, score, toneStyle } from '../core/util';
import { IconComponent } from '../shared/icon.component';
import { CountUpDirective } from '../shared/motion';
import { AvatarComponent, BarsComponent, CourseArtComponent, CourseCardComponent, DateTileComponent, EmptyComponent } from '../shared/ui';

@Component({
  selector: 'lh-dashboard',
  imports: [CountUpDirective, RouterLink, DatePipe, NgTemplateOutlet, IconComponent, AvatarComponent, BarsComponent, CourseArtComponent, CourseCardComponent,
    DateTileComponent, EmptyComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <p class="muted small">{{ today | date: 'EEEE, MMMM d' }}</p>
          <h1 class="page-title">{{ hello }}, {{ name() }}</h1>
          @if (d(); as data) { <p class="page-sub">{{ summary() }}</p> }
        </div>
        @if (auth.isStudent()) {
          <a routerLink="/catalog" class="btn btn-secondary"><lh-icon name="explore" class="sm" /> Find a course</a>
        } @else {
          <a routerLink="/courses/new" class="btn btn-ink"><lh-icon name="plus" class="sm" /> New course</a>
        }
      </div>

      @if (!d()) {
        <div class="bento" aria-busy="true">
          <div class="skeleton span-7" style="height:220px"></div><div class="skeleton span-5" style="height:220px"></div>
          <div class="skeleton span-7" style="height:300px"></div><div class="skeleton span-5" style="height:300px"></div>
        </div>
      } @else {
        @let data = d()!;
        @if (data.role === 'Student') {
          <!-- ================= STUDENT ================= -->
          <div class="bento">
            @if (data.nextUp; as n) {
              <a class="card card-lg next pastel span-7" [routerLink]="['/courses', n.courseId, 'assignments', n.id]" [attr.style]="tone(n.courseId)">
                <div class="next-copy">
                  <span class="due-pill"><lh-icon name="clock" class="sm" /> {{ due(n.dueDate) }}</span>
                  <p class="small strong mt-3">Up next · {{ n.courseCode }}</p>
                  <h2 class="next-title serif">{{ n.title }}</h2>
                  <p class="small">{{ n.courseTitle }} · {{ n.maxPoints }} points · {{ n.dueDate | date: 'EEE, MMM d, h:mm a' }}</p>
                  <span class="btn btn-ink mt-3">Open assignment <lh-icon name="arrow-right" class="sm" /></span>
                </div>
                <lh-course-art class="next-art" [kind]="art(n.courseCategory)" />
              </a>
            } @else {
              <div class="card card-lg span-7 caught-up">
                <lh-empty icon="check-circle" title="Nothing due right now" text="Everything you've been set is handed in. New assignments will appear here." />
              </div>
            }

            <section class="card card-lg span-5 term" aria-labelledby="term-title">
              <div class="card-head">
                <h2 id="term-title" class="card-title">This term</h2>
                <a routerLink="/grades" class="small strong">All grades</a>
              </div>
              <div class="term-top">
                <div>
                  <div class="big serif tabnum"><span [lhCountUp]="overall()" suffix="%"></span></div>
                  <div class="small muted">{{ overall() === null ? 'No grades yet' : 'Current grade · ' + letter(overall()!) }}</div>
                </div>
                <div class="handed">
                  <div class="big serif tabnum"><span [lhCountUp]="handedIn()"></span><span class="of">/{{ totalWork() }}</span></div>
                  <div class="small muted">handed in</div>
                </div>
              </div>
              <div class="segbar mt-3" role="img" [attr.aria-label]="segmentsLabel()">
                @for (s of segments(); track s.label) { @if (s.value) { <span [style.flex]="s.value" [style.background]="s.color"></span> } }
              </div>
              <ul class="legend mt-2">
                @for (s of segments(); track s.label) {
                  <li><span class="lg-dot" [style.background]="s.color"></span><span class="grow">{{ s.label }}</span><span class="strong tabnum">{{ s.value }}</span></li>
                }
              </ul>
            </section>

            <section class="card span-7" aria-labelledby="week-title">
              <div class="card-head">
                <div><h2 id="week-title" class="card-title">This week</h2><p class="card-sub">{{ data.week.length }} due in the next 7 days</p></div>
                <a routerLink="/calendar" class="btn btn-ghost btn-sm"><lh-icon name="calendar" class="sm" /> Calendar</a>
              </div>
              <ng-container [ngTemplateOutlet]="weekStrip" />
            </section>

            <div class="span-5 stack">
              @if (data.missing.length) {
                <section class="card" aria-labelledby="missing-title">
                  <div class="card-head"><h2 id="missing-title" class="card-title">Missing</h2><span class="status missing">{{ data.missing.length }}</span></div>
                  <div class="due-list">
                    @for (m of data.missing; track m.id) {
                      <a class="due-row" [routerLink]="['/courses', m.courseId, 'assignments', m.id]" [attr.style]="tone(m.courseId)">
                        <lh-date-tile [date]="m.dueDate" />
                        <div class="grow"><div class="title truncate">{{ m.title }}</div><div class="meta">{{ m.courseCode }} · {{ due(m.dueDate) }}</div></div>
                        <lh-icon name="chevron-right" class="sm muted" />
                      </a>
                    }
                  </div>
                </section>
              }
              <section class="card" aria-labelledby="fb-title">
                <div class="card-head"><h2 id="fb-title" class="card-title">Recent grades</h2></div>
                <div class="due-list">
                  @for (g of data.recentGrades; track g.submissionId) {
                    <a class="due-row fb" [routerLink]="['/courses', g.courseId, 'assignments', g.assignmentId]" [attr.style]="tone(g.courseId)">
                      <div class="score-tile"><span class="serif tabnum">{{ fmt(g.score) }}</span><span class="out">/{{ g.maxPoints }}</span></div>
                      <div class="grow">
                        <div class="title truncate">{{ g.assignmentTitle }}</div>
                        <div class="meta"><span class="code-chip">{{ g.courseCode }}</span> · {{ letter(g.score / g.maxPoints * 100) }}</div>
                        @if (g.feedback) { <p class="quote">“{{ g.feedback }}”</p> }
                      </div>
                    </a>
                  } @empty { <lh-empty icon="chat" title="No grades yet" text="Scores and comments from your instructors appear here." /> }
                </div>
              </section>
              <section class="card" aria-labelledby="news-title">
                <div class="card-head"><h2 id="news-title" class="card-title">Announcements</h2></div>
                <div class="due-list">
                  @for (a of feed() ?? []; track a.id) {
                    <a class="due-row" [routerLink]="['/courses', a.courseId]" [attr.style]="tone(a.courseId)">
                      <span class="news-ic"><lh-icon name="megaphone" class="sm" /></span>
                      <div class="grow"><div class="title truncate">{{ a.title }}</div><div class="meta"><span class="code-chip">{{ a.courseCode }}</span> · {{ ago(a.createdAt) }}</div></div>
                      @if (a.isPinned) { <lh-icon name="pin" class="sm muted" aria-label="Pinned" /> }
                    </a>
                  } @empty { <lh-empty icon="megaphone" title="No announcements" text="News from your instructors shows up here." /> }
                </div>
              </section>
            </div>
          </div>

          <section class="stack" aria-labelledby="courses-title">
            <div class="row between"><h2 id="courses-title" class="section-title">My courses</h2><a routerLink="/courses" class="small strong">All courses</a></div>
            @if (data.courses.length) {
              <div class="cards-grid">@for (c of data.courses; track c.id) { <lh-course-card [c]="c" [mine]="true" /> }</div>
            } @else {
              <div class="card"><lh-empty icon="courses" title="You're not enrolled in any courses" text="Find one in the catalog and enroll to see its assignments here."><a routerLink="/catalog" class="btn btn-ink btn-sm">Browse catalog</a></lh-empty></div>
            }
          </section>
        } @else {
          <!-- ================= INSTRUCTOR / ADMIN ================= -->
          <div class="bento">
            <section class="card span-7" aria-labelledby="grade-title">
              <div class="card-head">
                <div><h2 id="grade-title" class="card-title">To grade</h2><p class="card-sub">{{ data.pendingTotal }} submissions waiting, oldest first</p></div>
                @if (data.pendingGrading.length) {
                  <a class="btn btn-ink btn-sm" [routerLink]="['/grade', data.pendingGrading[0].submissionId]"><lh-icon name="pencil" class="sm" /> Start grading</a>
                }
              </div>
              <div class="due-list">
                @for (p of data.pendingGrading; track p.submissionId) {
                  <a class="due-row" [routerLink]="['/grade', p.submissionId]" [attr.style]="tone(p.courseId)">
                    <lh-avatar [name]="p.studentName" size="sm" />
                    <div class="grow">
                      <div class="title truncate">{{ p.studentName }}</div>
                      <div class="meta truncate"><span class="code-chip">{{ p.courseCode }}</span> {{ p.assignmentTitle }}</div>
                    </div>
                    <div class="end">
                      @if (p.isLate) { <span class="status late">Late</span> }
                      <span class="tiny muted nowrap">{{ p.submittedAt | date: 'MMM d' }}</span>
                    </div>
                  </a>
                } @empty { <lh-empty icon="check-circle" title="Nothing to grade" text="Every submission in your courses has a grade." /> }
              </div>
            </section>

            <section class="card span-5" aria-labelledby="subs-title">
              <div class="card-head">
                <div><h2 id="subs-title" class="card-title">Submissions received</h2><p class="card-sub">{{ weekTotal() }} in the last 7 days · today highlighted</p></div>
              </div>
              <lh-bars [bars]="bars()" [height]="190" />
            </section>

            <section class="card span-7" aria-labelledby="comp-title">
              <div class="card-head"><div><h2 id="comp-title" class="card-title">Assignment completion</h2><p class="card-sub">Handed in, out of enrolled students</p></div></div>
              <div class="due-list">
                @for (c of data.completion; track c.assignment.id) {
                  <a class="due-row" [routerLink]="['/courses', c.assignment.courseId, 'assignments', c.assignment.id]" [attr.style]="tone(c.assignment.courseId)">
                    <lh-date-tile [date]="c.assignment.dueDate" />
                    <div class="grow">
                      <div class="row between"><span class="title truncate">{{ c.assignment.title }}</span><span class="small strong tabnum nowrap">{{ c.submitted }}/{{ c.enrolled }}</span></div>
                      <div class="meter mt-1" [style.--fill]="'var(--c-deep)'"><span [style.width.%]="c.enrolled ? c.submitted * 100 / c.enrolled : 0"></span></div>
                    </div>
                  </a>
                } @empty { <lh-empty icon="assignment" title="Nothing due recently" text="Assignments due in the last 10 days or next 2 weeks show here." /> }
              </div>
            </section>

            <section class="card span-5" aria-labelledby="up-title">
              <div class="card-head">
                <div><h2 id="up-title" class="card-title">Coming up</h2><p class="card-sub">Due in the next 7 days</p></div>
                <a routerLink="/calendar" class="btn btn-ghost btn-sm"><lh-icon name="calendar" class="sm" /> Calendar</a>
              </div>
              <ng-container [ngTemplateOutlet]="weekStrip" />
            </section>

            @if (data.role === 'Admin') {
              <section class="card span-12" aria-labelledby="users-title">
                <div class="card-head"><h2 id="users-title" class="card-title">Newest accounts</h2><a routerLink="/admin" class="small strong">Manage users</a></div>
                <div class="users">
                  @for (u of data.recentUsers; track u.id) {
                    <div class="user"><lh-avatar [name]="u.fullName" size="sm" /><div class="grow"><div class="strong small truncate">{{ u.fullName }}</div><span class="role {{ u.role }}">{{ u.role }}</span></div></div>
                  }
                </div>
              </section>
            }
          </div>

          <section class="stack" aria-labelledby="teach-title">
            <div class="row between"><h2 id="teach-title" class="section-title">{{ data.role === 'Admin' ? 'All courses' : 'Courses you teach' }}</h2><a routerLink="/courses" class="small strong">All courses</a></div>
            <div class="cards-grid">@for (c of data.courses; track c.id) { <lh-course-card [c]="c" [mine]="true" /> }</div>
          </section>
        }
      }
    </div>

    <ng-template #weekStrip>
      <div class="days" role="group" aria-label="Filter by day">
        @for (day of days(); track day.key) {
          <button class="day" [class.on]="selected() === day.key" [class.today]="day.isToday" (click)="selected.set(selected() === day.key ? null : day.key)"
                  [attr.aria-pressed]="selected() === day.key" [attr.aria-label]="(day.date | date: 'EEEE d') + ', ' + day.items.length + ' due'">
            <span class="dname">{{ day.date | date: 'EEE' }}</span><span class="dnum">{{ day.date | date: 'd' }}</span>
            <span class="dots" aria-hidden="true">@for (x of day.items.slice(0, 3); track x.id) { <i></i> }</span>
          </button>
        }
      </div>
      <div class="due-list mt-2">
        @for (w of weekItems(); track w.id) {
          <a class="due-row" [routerLink]="['/courses', w.courseId, 'assignments', w.id]" [attr.style]="tone(w.courseId)">
            <lh-date-tile [date]="w.dueDate" />
            <div class="grow"><div class="title truncate">{{ w.title }}</div><div class="meta">{{ w.courseCode }} · {{ w.dueDate | date: 'EEE h:mm a' }} · {{ w.maxPoints }} pts</div></div>
            @if (w.submitted) { <span class="status submitted">Handed in</span> }
          </a>
        } @empty { <p class="small muted empty-week">Nothing due {{ selected() ? 'that day' : 'in the next 7 days' }}.</p> }
      </div>
    </ng-template>
  `,
  styles: [`
    /* Filled with the course's pastel: the colour says which course, the text stays dark ink in both themes. */
    .next { display: flex; justify-content: space-between; gap: 1rem; min-height: 220px; overflow: hidden; text-decoration: none !important;
      background: var(--c); border-color: transparent; color: #17161d; }
    .next:hover { text-decoration: none; }
    .next-copy { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: flex-start; min-width: 0; }
    .next-title { font-size: clamp(1.45rem, 2.4vw, 1.95rem); line-height: 1.15; margin: .3rem 0 .4rem; color: #17161d; }
    .next-art { width: 230px; height: 176px; flex-shrink: 0; align-self: flex-end; margin: -10px -18px -28px 0; transition: transform 500ms var(--spring); }
    .next.card { box-shadow: 0 26px 50px -30px var(--c-deep), inset 0 1px 0 rgba(255,255,255,.6); }
    .next::before { content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
      background: radial-gradient(90% 120% at 0% 0%, rgba(255,255,255,.5), transparent 55%); }
    @media (hover: hover) { .next:hover .next-art { transform: translate(-6px, -8px) rotate(-3deg); } }
    .due-pill { display: inline-flex; align-items: center; gap: .4rem; height: 28px; padding: 0 10px; border-radius: 999px; background: rgba(255,255,255,.72); font-size: .82rem; font-weight: 700; }
    .caught-up { display: flex; align-items: center; }

    .term { display: flex; flex-direction: column; }
    .term-top { display: flex; justify-content: space-between; gap: 1rem; }
    .handed { text-align: right; }
    .big { font-size: 2.6rem; font-weight: 600; line-height: 1; }
    .of { font-size: 1.3rem; color: var(--muted); }
    .legend { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: .4rem 1.2rem; font-size: .9rem; }
    .legend li { display: flex; align-items: center; gap: .5rem; }
    .lg-dot { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }

    .days { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; }
    .day { display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 7px 0 6px; border-radius: var(--r-ctl);
      border: 1px solid var(--line); background: var(--surface); cursor: pointer; min-width: 0;
      transition: background var(--dur) var(--ease), border-color var(--dur) var(--ease), color var(--dur) var(--ease); }
    .day:hover { border-color: var(--line-strong); }
    .dname { font-size: .74rem; font-weight: 600; color: var(--muted); }
    .dnum { font-size: 1.05rem; font-weight: 700; font-variant-numeric: tabular-nums; }
    .day.today .dnum { color: var(--violet); }
    .day.on { background: var(--btn-bg); border-color: var(--btn-bg); color: var(--btn-fg); }
    .day.on .dname, .day.on .dnum { color: inherit; }
    .dots { display: flex; gap: 2px; height: 5px; }
    .dots i { width: 5px; height: 5px; border-radius: 50%; background: currentColor; opacity: .55; }
    .empty-week { padding: .9rem .4rem; }

    .news-ic { width: 40px; height: 40px; flex-shrink: 0; border-radius: 12px; display: grid; place-items: center; background: var(--c); color: #17161d; --duo: .3; }
    .score-tile { width: 68px; height: 52px; flex-shrink: 0; border-radius: var(--r-ctl); background: var(--c); color: #17161d;
      display: flex; align-items: baseline; justify-content: center; padding-top: 12px; line-height: 1; }
    .score-tile .serif { font-size: 1.3rem; font-weight: 700; }
    .score-tile .out { font-size: .72rem; opacity: .65; margin-left: 1px; }
    .fb { align-items: flex-start; }
    .quote { font-size: .86rem; color: var(--ink-2); margin-top: .3rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

    .users { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: .5rem 1rem; }
    .user { display: flex; align-items: center; gap: .65rem; padding: .4rem 0; min-width: 0; }

    @media (max-width: 720px) {
      /* Phones: illustration tucks into the bottom-right corner beside the button instead of adding height. */
      .next { min-height: 0; position: relative; }
      .next-art { position: absolute; right: -14px; bottom: -22px; width: 140px; height: 106px; margin: 0; }
      .next-copy .btn { position: relative; z-index: 1; }
      .big { font-size: 2.2rem; }
      .day { padding: 6px 0 5px; }
      .dname { font-size: .7rem; }
    }
  `]
})
export class DashboardComponent {
  private api = inject(Api);
  protected auth = inject(Auth);
  protected d = toSignal(this.api.dashboard());
  // Only the student dashboard shows the announcements card.
  protected feed = toSignal(this.auth.isStudent() ? this.api.announcementFeed(4) : of([]));
  protected ago = ago;
  protected today = new Date();
  protected hello = greeting();
  protected selected = signal<string | null>(null);

  protected name = computed(() => firstName(this.auth.user()?.fullName ?? ''));
  protected tone = toneStyle;
  protected due = dueText;
  protected fmt = score;
  protected letter = letterGrade;
  protected art = artFor;

  /** One sentence of numbers in context, instead of a row of KPI tiles. */
  protected summary = computed(() => {
    const d = this.d();
    if (!d) return '';
    const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
    if (d.role === 'Student') {
      const parts = [`${d.week.filter(w => !w.submitted).length} due this week`];
      if (d.missing.length) parts.push(`${d.missing.length} missing`);
      parts.push(plural(d.courses.length, 'course'));
      return parts.join(' · ');
    }
    if (d.role === 'Admin') {
      const f = d.figures;
      return `${plural(f['users'] ?? 0, 'account')} · ${plural(f['courses'] ?? 0, 'course')} · ${f['enrollments'] ?? 0} enrollments · ${d.pendingTotal} waiting to be graded`;
    }
    return `${d.pendingTotal} waiting to be graded · ${plural(d.week.length, 'assignment')} due this week · ${plural(d.figures['students'] ?? 0, 'student')}`;
  });

  protected bars = computed(() => (this.d()?.activity ?? []).map((a, i, all) => ({
    label: new Date(a.day).toLocaleDateString('en-US', { weekday: 'short' }), value: a.count, highlight: i === all.length - 1
  })));
  protected weekTotal = computed(() => (this.d()?.activity ?? []).reduce((s, a) => s + a.count, 0));

  protected overall = computed(() => { const d = this.d(); return d && d.possible ? d.earned / d.possible * 100 : null; });
  protected segments = computed(() => {
    const d = this.d();
    if (!d) return [];
    // Status colours carry their fixed meaning: green graded, blue submitted/waiting, red missing; grey = not yet due.
    return [
      { label: 'Graded', value: d.gradedCount, color: 'var(--ok)' },
      { label: 'Waiting for grade', value: d.awaitingCount, color: 'var(--info)' },
      { label: 'Not yet due', value: d.upcomingCount, color: 'var(--line-strong)' },
      { label: 'Missing', value: d.missing.length, color: 'var(--bad)' },
    ];
  });
  protected totalWork = computed(() => this.segments().reduce((s, x) => s + x.value, 0));
  protected handedIn = computed(() => { const d = this.d(); return d ? d.gradedCount + d.awaitingCount : 0; });
  protected segmentsLabel = computed(() => this.segments().map(s => `${s.label}: ${s.value}`).join(', '));

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
