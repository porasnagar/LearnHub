import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../core/api.service';
import { Auth, Theme } from '../core/services';
import { isoDate, toneStyle } from '../core/util';
import { IconComponent, LogoComponent } from '../shared/icon.component';
import { CourseCardComponent, ScrollerComponent } from '../shared/ui';

@Component({
  selector: 'lh-landing',
  imports: [DatePipe, RouterLink, FormsModule, IconComponent, LogoComponent, CourseCardComponent, ScrollerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="top frost">
      <div class="top-in">
        <a routerLink="/" aria-label="LearnHub home" class="brand"><lh-logo [size]="32" /></a>
        <nav class="row">
          <a routerLink="/catalog" class="plink">Catalog</a>
          <button class="btn btn-ghost btn-icon btn-sm" (click)="theme.toggle()" [attr.aria-label]="theme.mode() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'">
            <lh-icon [name]="theme.mode() === 'dark' ? 'sun' : 'moon'" />
          </button>
          <a routerLink="/login" class="btn btn-ghost btn-sm">Sign in</a>
          <a routerLink="/register" class="btn btn-ink btn-sm getstarted">Create account</a>
        </nav>
      </div>
    </header>

    <div class="wrap-in">
      <section class="hero">
        <div class="copy">
          <h1>Know what's due.<br>Hand it in.<br>See your grade.</h1>
          <p class="lead">
            LearnHub is the course site for your classes. Every due date sits in one list, you submit text or files
            from your phone, and your instructor's grade and comments appear as soon as they're saved.
          </p>

          <form class="search" (ngSubmit)="search()" role="search">
            <lh-icon name="search" />
            <input [(ngModel)]="q" name="q" placeholder="Search {{ total() }} courses by title, code or subject" aria-label="Search the course catalog" />
            <button class="btn btn-ink" type="submit">Search</button>
          </form>
          <lh-scroller class="chips-row mt-2" aria-label="Browse by subject">
            @for (s of subjects(); track s.name) {
              <a class="chip" routerLink="/catalog" [queryParams]="{ category: s.name }">{{ s.name }} <span class="count">{{ s.count }}</span></a>
            }
          </lh-scroller>

          <div class="cta-row">
            <a routerLink="/register" class="btn btn-ink btn-lg">Create a free account</a>
            <a routerLink="/login" class="btn btn-secondary btn-lg">Sign in</a>
          </div>

          <!-- Phones: the onboarding-style slider from the owner's reference (drag to the right, or tap). -->
          <div class="slide-cta" role="link" tabindex="0" aria-label="Create a free account"
               (keydown.enter)="go()" (click)="!moved && go()"
               (pointerdown)="swipeStart($event)" (pointermove)="swipeMove($event)"
               (pointerup)="swipeEnd()" (pointercancel)="swipeEnd()">
            <span class="knob" #knob [style.transform]="knobX ? 'translateX(' + knobX + 'px)' : ''"
                  [style.transition]="dragging ? 'none' : 'transform 200ms var(--ease)'">
              <lh-icon [name]="knobX > 60 ? 'arrow-right' : 'check'" />
            </span>
            <span class="grow" [style.opacity]="1 - knobX / 140">Slide to create an account</span>
            <span class="chev" aria-hidden="true"><lh-icon name="chevron-right" class="sm" /><lh-icon name="chevron-right" class="sm" /></span>
          </div>

          <!-- One tap into the seeded demo term, no typing. -->
          <div class="try">
            <span class="small muted strong">Or look around first:</span>
            <button type="button" class="btn btn-secondary btn-sm" (click)="demo('Student')" [disabled]="!!busy()">
              <lh-icon name="backpack" class="sm" /> {{ busy() === 'Student' ? 'Opening…' : 'Student demo' }}
            </button>
            <button type="button" class="btn btn-secondary btn-sm" (click)="demo('Instructor')" [disabled]="!!busy()">
              <lh-icon name="presenter" class="sm" /> {{ busy() === 'Instructor' ? 'Opening…' : 'Instructor demo' }}
            </button>
          </div>
        </div>

        <!-- A working preview of the product's main screen: the student's week, starting today. Tap a day. -->
        <div class="preview-wrap">
          <svg class="arcs" viewBox="0 0 400 220" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
            <path d="M20 220a180 180 0 0 1 360 0" stroke="var(--sky)" />
            <path d="M60 220a140 140 0 0 1 280 0" stroke="var(--peach)" />
            <path d="M100 220a100 100 0 0 1 200 0" stroke="var(--mint)" />
            <path d="M140 220a60 60 0 0 1 120 0" stroke="var(--lemon)" />
          </svg>
          <div class="preview card" aria-label="Preview: a student's week">
            <div class="row between">
              <div><div class="card-title">This week</div><div class="card-sub">{{ demoRows.length }} due · tap a day</div></div>
              <span class="avatar sm t1" aria-hidden="true">AM</span>
            </div>
            <div class="mini-days" role="tablist" aria-label="Days this week">
              @for (d of days; track d.key) {
                <button type="button" role="tab" class="mini-day" [class.on]="d.key === sel()" [attr.aria-selected]="d.key === sel()"
                        [attr.aria-label]="(d.date | date: 'EEEE d MMMM') + ', ' + d.count + ' due'" (click)="sel.set(d.key)">
                  <span class="dn">{{ d.today ? 'Today' : (d.date | date: 'EEE') }}</span>
                  <span class="dd">{{ d.date | date: 'd' }}</span>
                  <span class="pip" [class.has]="d.count > 0"></span>
                </button>
              }
            </div>
            @for (k of [sel()]; track k) {
              <div class="due-list day-list">
                @for (r of selRows(); track r.title) {
                  <button type="button" class="due-row" [attr.style]="tone(r.course)" (click)="demo('Student')" title="Open the student demo">
                    <span class="tile"><span>{{ r.due | date: 'MMM' }}</span><b>{{ r.due | date: 'd' }}</b></span>
                    <div class="grow"><div class="title truncate">{{ r.title }}</div><div class="meta">{{ r.code }} · {{ r.due | date: 'EEE h:mm a' }}</div></div>
                    <span class="status {{ r.css }}">{{ r.status }}</span>
                  </button>
                } @empty {
                  <div class="free">
                    <lh-icon name="check-circle" />
                    <span><strong class="d-block">Nothing due</strong><span class="small muted">A free day. Tap another one.</span></span>
                  </div>
                }
              </div>
            }
            <div class="grade-row">
              <span class="code-chip" style="--c:#d9ccff">CS301</span>
              <span class="grow small">Routing &amp; Tag Helpers Quiz <span class="muted">· graded</span></span>
              <span class="serif strong">18<span class="muted small">/20</span></span>
            </div>
          </div>
        </div>
      </section>

      @if (featured().length) {
        <section class="section" aria-labelledby="open-title">
          <div class="section-head">
            <h2 id="open-title">Open for enrollment</h2>
            <a routerLink="/catalog" class="btn btn-ghost btn-sm">Full catalog <lh-icon name="arrow-right" class="sm" /></a>
          </div>
          <lh-scroller class="cards-scroller">
            @for (c of featured(); track c.id) { <lh-course-card class="fcard" [c]="c" /> }
          </lh-scroller>
        </section>
      }

      <section class="section" aria-labelledby="roles-title">
        <h2 id="roles-title">What each account can do</h2>
        <div class="roles">
          @for (r of roles; track r.title) {
            <div class="role-col">
              <h3><lh-icon [name]="r.icon" /> {{ r.title }}</h3>
              <ul>@for (p of r.points; track p) { <li>{{ p }}</li> }</ul>
            </div>
          }
        </div>
      </section>

      <section class="cta card card-lg">
        <div>
          <h2>Your first course is a minute away</h2>
          <p class="muted mt-1">Create a student account, pick a course from the catalog and enroll — no invite needed.</p>
        </div>
        <div class="row wrap">
          <a routerLink="/register" class="btn btn-ink btn-lg">Create account</a>
          <a routerLink="/catalog" class="btn btn-secondary btn-lg">Browse catalog</a>
        </div>
      </section>

      <footer class="foot">
        <lh-logo [size]="26" />
        <span class="small muted">© {{ year }} LearnHub · ASP.NET Core, Angular and Entity Framework Core</span>
      </footer>
    </div>
  `,
  styles: [`
    :host { display: block; overflow-x: clip; }
    .top { position: sticky; top: 0; z-index: 20; border-bottom: 1px solid var(--line); }
    .top-in { max-width: 1200px; margin: 0 auto; height: 64px; padding: 0 20px; display: flex; align-items: center; justify-content: space-between; }
    .brand { text-decoration: none !important; }
    .plink { font-weight: 600; color: var(--ink-2); padding: 0 .5rem; }
    .wrap-in { max-width: 1200px; margin: 0 auto; padding: 0 20px 40px; }

    .hero { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, .95fr); gap: 3rem; align-items: center; padding: 4rem 0 3rem; }
    .copy { min-width: 0; }
    h1 { font-size: clamp(2.4rem, 5vw, 3.9rem); line-height: 1.05; }
    .lead { font-size: 1.1rem; color: var(--ink-2); max-width: 36rem; margin-top: 1.1rem; }
    .search { display: flex; align-items: center; gap: .6rem; margin-top: 1.7rem; max-width: 36rem; padding: 5px 5px 5px 14px;
      border-radius: var(--r-ctl); background: var(--surface); border: 1px solid var(--line-strong); color: var(--muted); }
    .search:focus-within { border-color: var(--violet); box-shadow: 0 0 0 3px var(--violet-soft); }
    .search input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; font: inherit; font-size: 1rem; color: var(--ink); }
    .search input::placeholder { color: var(--faint); }
    .chips-row { max-width: 36rem; }
    .cta-row { display: flex; gap: .6rem; flex-wrap: wrap; margin-top: 1.6rem; }
    .slide-cta { display: none; }

    .preview-wrap { position: relative; min-width: 0; }
    .arcs { display: none; }
    .preview { padding: 1.1rem; box-shadow: var(--shadow-float); }
    .d-block { display: block; }
    .try { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; margin-top: 1rem; }
    .mini-days { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 5px; margin: .9rem 0 .4rem; }
    .mini-day { display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 6px 0 5px; min-width: 0; border-radius: 12px; border: 1px solid var(--line);
      background: var(--surface); color: var(--ink); line-height: 1.2; cursor: pointer; font: inherit;
      transition: background 220ms var(--ease-out), border-color 220ms var(--ease-out), color 220ms var(--ease-out), transform 120ms var(--ease-out), box-shadow 220ms var(--ease-out); }
    .mini-day:hover { border-color: var(--line-strong); }
    .mini-day:active { transform: scale(.94); }
    .mini-day .dn { font-size: .68rem; color: var(--muted); white-space: nowrap; }
    .mini-day .dd { font-size: .95rem; font-weight: 700; font-variant-numeric: tabular-nums; }
    .pip { width: 5px; height: 5px; border-radius: 50%; background: transparent; }
    .pip.has { background: var(--violet); }
    /* Selected day: the same purple pill as the active navigation. */
    .mini-day.on { background: var(--nav-grad); color: #fff; border-color: transparent; box-shadow: var(--nav-glow); }
    .mini-day.on .dn { color: inherit; opacity: .85; }
    .mini-day.on .pip.has { background: #fff; }
    .day-list { min-height: 140px; }
    button.due-row { width: 100%; border: 0; background: transparent; font: inherit; text-align: left; cursor: pointer; }
    .free { display: flex; align-items: center; gap: .7rem; padding: 1.1rem .5rem; color: var(--ok); animation: lh-enter 300ms var(--ease-out) backwards; }
    .free strong { color: var(--ink); }
    .tile { width: 42px; height: 46px; flex-shrink: 0; border-radius: 11px; background: var(--c); color: #17161d; display: flex; flex-direction: column;
      align-items: center; justify-content: center; line-height: 1; font-size: .7rem; }
    .tile b { font-size: 1.15rem; margin-top: 2px; }
    .grade-row { display: flex; align-items: center; gap: .6rem; margin-top: .4rem; padding: .7rem .5rem 0; border-top: 1px solid var(--line); }

    .section { padding: 2.5rem 0; }
    .section-head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1rem; }
    h2 { font-size: 1.45rem; font-weight: 700; }
    .cards-scroller ::ng-deep .track { gap: 1rem; padding-bottom: 4px; }
    .fcard { flex: 0 0 290px; }

    .roles { display: grid; grid-template-columns: repeat(3, 1fr); margin-top: 1.25rem; border-top: 1px solid var(--line); }
    .role-col { padding: 1.25rem 1.5rem 0 0; }
    .role-col + .role-col { padding-left: 1.5rem; border-left: 1px solid var(--line); }
    .role-col h3 { font-size: 1.05rem; display: flex; align-items: center; gap: .5rem; margin-bottom: .6rem; }
    .role-col ul { margin: 0; padding-left: 1.1rem; color: var(--ink-2); display: flex; flex-direction: column; gap: .35rem; }

    .cta { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1.25rem; margin: 1.5rem 0 1rem; }
    .foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1rem; padding: 1.5rem 0; border-top: 1px solid var(--line); }

    @media (max-width: 960px) {
      .hero { grid-template-columns: 1fr; gap: 2rem; padding-top: 2.5rem; }
      .preview-wrap { max-width: 520px; }
    }
    @media (max-width: 760px) {
      .roles { grid-template-columns: 1fr; border-top: 0; }
      .role-col, .role-col + .role-col { padding: 1rem 0; border-left: 0; border-top: 1px solid var(--line); }
    }

    /* ---------- Phones: onboarding layout (preview with arcs on top, copy and slider below) ---------- */
    @media (max-width: 640px) {
      .top-in { padding: 0 12px 0 16px; height: 58px; }
      .plink, .getstarted { display: none; }
      .wrap-in { padding: 0 16px 32px; }
      .hero { display: flex; flex-direction: column-reverse; align-items: stretch; gap: 1.5rem; padding: 1.25rem 0 1.5rem; }
      .hero > * { min-width: 0; max-width: 100%; }
      h1 { font-size: 2.35rem; }
      .lead { font-size: 1rem; }
      .search { margin-top: 1.3rem; }
      .search .btn { padding: 0 .9rem; }
      .cta-row { display: none; }

      .preview-wrap { padding: 46px 6px 0; }
      .arcs { display: block; position: absolute; left: -16px; right: -16px; top: 0; width: calc(100% + 32px); height: 210px; }
      .arcs path { fill: none; stroke-width: 30; stroke-linecap: round; }
      .preview { position: relative; }
      .preview .status { display: none; }
      .try { justify-content: center; }
      .try > span { width: 100%; text-align: center; }

      .slide-cta { display: flex; align-items: center; gap: .75rem; height: 60px; margin-top: 1.4rem; padding: 6px 16px 6px 6px;
        border-radius: 999px; background: var(--surface); border: 1px solid var(--line-strong); font-weight: 700; color: var(--ink);
        cursor: grab; user-select: none; touch-action: pan-y; overflow: hidden; }
      .slide-cta:focus-visible { outline: 2px solid var(--violet); outline-offset: 2px; }
      .knob { width: 48px; height: 48px; border-radius: 50%; background: var(--btn-bg); color: var(--btn-fg); display: grid; place-items: center; flex-shrink: 0; }
      .chev { display: flex; color: var(--faint); }
      .chev lh-icon + lh-icon { margin-left: -8px; }
      .fcard { flex-basis: 260px; }
    }
  `]
})
export class LandingComponent {
  private api = inject(Api);
  private router = inject(Router);
  protected theme = inject(Theme);
  protected q = '';
  protected year = new Date().getFullYear();
  protected tone = toneStyle;
  private auth = inject(Auth);
  protected busy = signal<'Student' | 'Instructor' | null>(null);

  private catalog = toSignal(this.api.catalog());
  protected total = computed(() => this.catalog()?.totalPublished ?? '');
  protected subjects = computed(() => this.catalog()?.subjects ?? []);
  protected featured = computed(() => [...(this.catalog()?.courses ?? [])].sort((a, b) => b.studentCount - a.studentCount).slice(0, 6));

  // Preview content: the kind of week the seeded demo term has, laid out from today so the dates are always real.
  private readonly start = new Date(new Date().setHours(0, 0, 0, 0));
  private at(days: number, h: number, m = 0) { const d = new Date(this.start); d.setDate(d.getDate() + days); d.setHours(h, m); return d; }
  protected demoRows = [
    { course: 2, code: 'DB201', title: 'Normalization Worksheet', due: this.at(0, 17), status: 'Handed in', css: 'submitted' },
    { course: 1, code: 'CS301', title: 'Authentication with Cookies', due: this.at(0, 23, 59), status: 'To do', css: 'open' },
    { course: 3, code: 'WD101', title: 'Responsive Portfolio Page', due: this.at(1, 23, 59), status: 'To do', css: 'open' },
    { course: 2, code: 'DB201', title: 'EF Core Relationships', due: this.at(2, 23, 59), status: 'To do', css: 'open' },
    { course: 4, code: 'SE401', title: 'Sprint Retrospective Report', due: this.at(3, 18), status: 'To do', css: 'open' },
    { course: 5, code: 'CS210', title: 'Linked Lists Lab', due: this.at(4, 23, 59), status: 'To do', css: 'open' },
    { course: 6, code: 'UX220', title: 'Usability Test Plan', due: this.at(6, 9), status: 'To do', css: 'open' },
  ];
  protected days = Array.from({ length: 7 }, (_, i) => {
    const date = this.at(i, 0);
    const key = isoDate(date);
    return { key, date, today: i === 0, count: this.demoRows.filter(r => isoDate(r.due) === key).length };
  });
  protected sel = signal(this.days[0].key);
  protected selRows = computed(() => this.demoRows.filter(r => isoDate(r.due) === this.sel()));

  /** Signs in with a seeded demo account (the same ones listed on the sign-in page). */
  demo(role: 'Student' | 'Instructor') {
    if (this.busy()) return;
    this.busy.set(role);
    const account = role === 'Student'
      ? { email: 'aarav@learnhub.local', password: 'Learn@123' }
      : { email: 'priya@learnhub.local', password: 'Teach@123' };
    this.auth.login(account.email, account.password, false).subscribe({
      next: () => this.router.navigateByUrl('/dashboard'),
      error: () => this.busy.set(null)
    });
  }

  protected roles = [
    { title: 'Students', icon: 'backpack', points: ['Enroll from the catalog', 'See every due date on one calendar', 'Submit text or files, and resubmit until graded', 'Read grades and written feedback'] },
    { title: 'Instructors', icon: 'presenter', points: ['Create and publish courses', 'Set assignments with due dates and points', 'Grade one submission after another', 'Keep a gradebook and export it to CSV'] },
    { title: 'Administrators', icon: 'admin', points: ['Manage student and instructor accounts', 'Oversee every course', 'Reassign courses to instructors', 'See what is waiting to be graded'] },
  ];

  search() { this.router.navigate(['/catalog'], { queryParams: { q: this.q || null } }); }
  go() { this.router.navigate(['/register']); }

  // ---------- Slide-to-start (phones). Tap or Enter also works. ----------
  @ViewChild('knob') private knobEl!: ElementRef<HTMLElement>;
  protected knobX = 0;
  protected dragging = false;
  protected moved = false;
  private startX = 0;
  private trackWidth = 0;

  swipeStart(e: PointerEvent) {
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    this.dragging = true;
    this.moved = false;
    this.startX = e.clientX;
    this.trackWidth = target.clientWidth - 60;
  }

  swipeMove(e: PointerEvent) {
    if (!this.dragging) return;
    const dx = Math.max(0, e.clientX - this.startX);
    if (dx > 6) this.moved = true;
    this.knobX = Math.min(dx, this.trackWidth);
  }

  swipeEnd() {
    if (!this.dragging) return;
    this.dragging = false;
    if (this.knobX >= this.trackWidth * 0.6) {
      this.knobX = this.trackWidth;
      setTimeout(() => this.go(), 200);
    } else {
      this.knobX = 0;
    }
  }
}
