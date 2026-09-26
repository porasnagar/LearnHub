import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../core/api.service';
import { Theme } from '../core/services';
import { IconComponent, LogoComponent } from '../shared/icon.component';
import { AvatarComponent, BarsComponent, CourseArtComponent, CourseCardComponent, RingComponent } from '../shared/ui';

@Component({
  selector: 'lh-landing',
  imports: [RouterLink, FormsModule, IconComponent, LogoComponent, CourseCardComponent, CourseArtComponent, RingComponent, BarsComponent, AvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="nav glass">
      <lh-logo />
      <nav class="row">
        <a routerLink="/catalog" class="plink">Catalog</a>
        <button class="btn btn-ghost btn-icon btn-sm" (click)="theme.toggle()" aria-label="Switch theme"><lh-icon [name]="theme.mode() === 'dark' ? 'sun' : 'moon'" /></button>
        <a routerLink="/login" class="btn btn-glass btn-sm">Sign in</a>
        <a routerLink="/register" class="btn btn-ink btn-sm">Get started</a>
      </nav>
    </header>

    <section class="hero">
      <div class="copy stagger">
        <span class="eyebrow glass"><span class="pulse"></span> Learning management system</span>
        <h1>Learning, <em>beautifully</em> organised.</h1>
        <p class="lead">Courses, assignments, feedback and grades in one calm workspace for students, instructors and administrators.</p>
        <form class="hero-search glass" (ngSubmit)="search()" role="search">
          <lh-icon name="search" />
          <input [(ngModel)]="q" name="q" placeholder="What do you want to learn?" aria-label="Search courses" />
          <button class="btn btn-ink" type="submit">Explore <lh-icon name="arrow-right" class="sm" /></button>
        </form>
        <div class="chips mt-2">
          @for (s of subjects(); track s.name) {
            <a class="chip" routerLink="/catalog" [queryParams]="{ category: s.name }">{{ s.name }} <span class="count">{{ s.count }}</span></a>
          }
        </div>
      </div>

      <div class="showcase" aria-hidden="true">
        <div class="float f1 card card-flush">
          <div class="mini-banner" style="--c:#d9ccff;--c-deep:#5b3fe0"><lh-course-art kind="web" class="mini-art" /><span class="tag">CS301</span></div>
          <div class="mini-body">
            <div class="strong">ASP.NET Core MVC</div>
            <div class="tiny muted">Dr. Priya Sharma</div>
            <div class="meter mt-2"><span style="width:72%"></span></div>
          </div>
        </div>
        <div class="float f2 card">
          <lh-ring [percent]="88" center="88%" caption="Grade · B+" [size]="118" />
        </div>
        <div class="float f3 card">
          <div class="card-title small">This week</div>
          <lh-bars [bars]="demoBars" [height]="96" />
        </div>
        <div class="float f4 card tone" style="--tone:#e9e58e">
          <div class="row"><span class="ok-dot"><lh-icon name="check" class="sm" /></span>
            <div><div class="strong small">Submission received</div><div class="tiny">EF Core Relationships · on time</div></div></div>
        </div>
        <div class="float f5 card">
          <div class="row"><div class="avatar-stack"><lh-avatar name="Aarav Mehta" size="sm" /><lh-avatar name="Diya Kapoor" size="sm" /><lh-avatar name="Kabir Singh" size="sm" /></div>
            <span class="tiny strong">+24 enrolled</span></div>
        </div>
      </div>
    </section>

    @if (featured().length) {
      <section class="section">
        <div class="section-head">
          <div><div class="kicker">Course catalog</div><h2>Popular right now</h2></div>
          <a routerLink="/catalog" class="btn btn-glass btn-sm">Browse all <lh-icon name="arrow-right" class="sm" /></a>
        </div>
        <div class="cards-grid stagger">
          @for (c of featured(); track c.id) { <lh-course-card [c]="c" /> }
        </div>
      </section>
    }

    <section class="section">
      <div class="section-head"><div><div class="kicker">One platform</div><h2>Built for the whole classroom</h2></div></div>
      <div class="roles stagger">
        @for (r of roles; track r.title) {
          <div class="card card-lg tone role-card" [style.--tone]="r.tone">
            <div class="role-ico"><lh-icon [name]="r.icon" class="lg" /></div>
            <h3>{{ r.title }}</h3>
            <ul>@for (p of r.points; track p) { <li><lh-icon name="check" class="sm" /> {{ p }}</li> }</ul>
          </div>
        }
      </div>
    </section>

    <section class="cta card card-lg ink">
      <div>
        <h2 class="serif">Ready when you are.</h2>
        <p class="muted mt-1">Create a free account and enroll in your first course in under a minute.</p>
      </div>
      <div class="row wrap">
        <a routerLink="/register" class="btn btn-lemon btn-lg">Create account</a>
        <a routerLink="/login" class="btn btn-lg ghost-dark">Sign in</a>
      </div>
    </section>

    <footer class="foot">
      <lh-logo [size]="28" />
      <span class="small muted">© {{ year }} LearnHub · ASP.NET Core · Angular · Entity Framework Core</span>
    </footer>
  `,
  styles: [`
    :host { display: block; max-width: 1240px; margin: 0 auto; padding: 16px 20px 40px; }
    .nav { position: sticky; top: 14px; z-index: 20; display: flex; align-items: center; justify-content: space-between; padding: 10px 12px 10px 18px; border-radius: 999px; }
    .plink { font-weight: 700; color: var(--ink-2); padding: 0 .5rem; }

    .hero { display: grid; grid-template-columns: 1.05fr 1fr; gap: 2rem; align-items: center; padding: 4.5rem 0 3rem; }
    .eyebrow { display: inline-flex; align-items: center; gap: .55rem; height: 34px; padding: 0 14px; border-radius: 999px; font-size: .8rem; font-weight: 700; color: var(--ink-2); }
    .pulse { width: 8px; height: 8px; border-radius: 50%; background: var(--violet); box-shadow: 0 0 0 0 var(--violet); animation: ping 2s infinite; }
    @keyframes ping { 70% { box-shadow: 0 0 0 10px transparent; } 100% { box-shadow: 0 0 0 0 transparent; } }
    h1 { font-size: clamp(2.6rem, 6vw, 4.6rem); line-height: 1.02; margin: 1.1rem 0 1rem; }
    h1 em { font-style: italic; color: var(--violet); }
    .lead { font-size: 1.15rem; color: var(--muted); max-width: 34rem; }
    .hero-search { display: flex; align-items: center; gap: .7rem; margin-top: 1.8rem; max-width: 34rem; padding: 7px 7px 7px 18px; border-radius: 999px; color: var(--muted); }
    .hero-search input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; font: inherit; font-size: 1rem; color: var(--ink); }

    .showcase { position: relative; height: 470px; }
    .float { position: absolute; animation: rise .8s var(--ease) both, float 7s ease-in-out infinite; }
    .f1 { top: 20px; left: 8%; width: 250px; animation-delay: .1s, 0s; }
    .f2 { top: 0; right: 4%; animation-delay: .25s, -2s; }
    .f3 { bottom: 26px; right: 0; width: 250px; animation-delay: .4s, -4s; }
    .f4 { bottom: 70px; left: 0; width: 260px; animation-delay: .55s, -1s; }
    .f5 { top: 250px; left: 30%; animation-delay: .7s, -3s; }
    .mini-banner { position: relative; height: 96px; background: var(--c); overflow: hidden; }
    .mini-art { position: absolute; right: -4px; bottom: -12px; width: 130px; height: 100px; }
    .tag { position: absolute; top: 10px; left: 10px; font-size: .7rem; font-weight: 800; background: #16151c; color: #fff; padding: 3px 9px; border-radius: 999px; }
    .mini-body { padding: .8rem 1rem 1rem; }
    .ok-dot { width: 34px; height: 34px; border-radius: 50%; background: #16151c; color: #e9e58e; display: grid; place-items: center; }

    .section { padding: 2.5rem 0; }
    .section-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; margin-bottom: 1.4rem; }
    .kicker { font-size: .78rem; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--violet); }
    h2 { font-family: var(--serif); font-size: clamp(1.7rem, 3vw, 2.4rem); margin-top: .3rem; }
    .roles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.25rem; }
    .role-card h3 { font-size: 1.35rem; margin: 1rem 0 .8rem; }
    .role-card ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: .55rem; font-weight: 600; font-size: .95rem; }
    .role-card li { display: flex; gap: .5rem; align-items: center; }
    .role-ico { width: 52px; height: 52px; border-radius: 16px; background: #16151c; color: #fff; display: grid; place-items: center; }

    .cta { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1.5rem; margin: 2rem 0; padding: 2.4rem; }
    .cta h2 { color: #fff; margin: 0; }
    .ghost-dark { color: #fff; border-color: rgba(255,255,255,.25); }
    .foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1rem; padding: 1.5rem 0; }

    @media (max-width: 960px) {
      .hero { grid-template-columns: 1fr; padding-top: 2.5rem; }
      .showcase { height: 400px; }
      .roles { grid-template-columns: 1fr; }
    }
    @media (max-width: 560px) {
      .plink { display: none; }
      .showcase { height: 360px; transform: scale(.86); transform-origin: top left; width: 116%; }
      .hero-search .btn { padding: 0 .9rem; }
    }
  `]
})
export class LandingComponent {
  private api = inject(Api);
  private router = inject(Router);
  protected theme = inject(Theme);
  protected q = '';
  protected year = new Date().getFullYear();

  private catalog = toSignal(this.api.catalog());
  protected subjects = computed(() => this.catalog()?.subjects ?? []);
  protected featured = computed(() => [...(this.catalog()?.courses ?? [])].sort((a, b) => b.studentCount - a.studentCount).slice(0, 3));

  protected demoBars = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, i) => ({ label, value: [2, 4, 3, 5, 2, 6, 3][i], highlight: i === 5 }));

  protected roles = [
    { title: 'Students', icon: 'backpack', tone: 'var(--lilac)', points: ['Enroll from the catalog', 'Every due date on one calendar', 'Submit text or files', 'Feedback & live grades'] },
    { title: 'Instructors', icon: 'presenter', tone: 'var(--lemon)', points: ['Create & publish courses', 'Set assignments with due dates', 'Grade one after another', 'Gradebook with CSV export'] },
    { title: 'Administrators', icon: 'admin', tone: 'var(--mint)', points: ['Manage every account', 'Oversee all courses', 'Reassign instructors', 'Platform activity at a glance'] },
  ];

  search() { this.router.navigate(['/catalog'], { queryParams: { q: this.q || null } }); }
}
