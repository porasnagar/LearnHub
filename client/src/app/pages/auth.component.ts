import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Role } from '../core/models';
import { Auth, Toasts } from '../core/services';
import { firstName } from '../core/util';
import { IconComponent, LogoComponent } from '../shared/icon.component';

/** Left-hand panel shared by sign-in and registration: what you'll see after signing in. */
@Component({
  selector: 'lh-auth-aside',
  imports: [LogoComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="aside">
      <a routerLink="/" class="brand" aria-label="LearnHub home"><lh-logo [size]="32" /></a>
      <div>
        <h2>Every due date in one list. Every grade with a comment.</h2>
        <p class="lead">After you sign in, this is the first thing you see.</p>
        <div class="list" aria-hidden="true">
          @for (r of rows; track r.title) {
            <div class="item">
              <span class="tile" [style.background]="r.c"><span>{{ r.mon }}</span><b>{{ r.day }}</b></span>
              <div class="grow"><div class="t">{{ r.title }}</div><div class="m">{{ r.meta }}</div></div>
              <span class="s" [class.ok]="r.ok">{{ r.status }}</span>
            </div>
          }
        </div>
      </div>
      <p class="foot">Demo data · a sample term with 7 courses</p>
    </aside>`,
  styles: [`
    .aside { height: 100%; min-height: 600px; border-radius: 20px; padding: 2rem 2.2rem; display: flex; flex-direction: column; justify-content: space-between; gap: 2rem;
      background: #17161d; color: #fff; }
    .brand { text-decoration: none !important; }
    .brand ::ng-deep .word { color: #fff; }
    h2 { color: #fff; font-family: var(--serif); font-weight: 600; font-size: 1.9rem; line-height: 1.2; max-width: 24ch; }
    .lead { color: rgba(255,255,255,.66); margin-top: .6rem; }
    .list { margin-top: 1.6rem; border-top: 1px solid rgba(255,255,255,.12); }
    .item { display: flex; align-items: center; gap: .85rem; padding: .8rem 0; border-bottom: 1px solid rgba(255,255,255,.12); }
    .tile { width: 44px; height: 48px; flex-shrink: 0; border-radius: 11px; color: #17161d; display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1; font-size: .72rem; }
    .tile b { font-size: 1.15rem; margin-top: 2px; }
    .t { font-weight: 700; }
    .m { font-size: .84rem; color: rgba(255,255,255,.62); }
    .s { font-size: .8rem; font-weight: 700; color: rgba(255,255,255,.72); white-space: nowrap; }
    .s.ok { color: #8fe0b4; }
    .foot { font-size: .82rem; color: rgba(255,255,255,.5); }
  `]
})
export class AuthAsideComponent {
  protected rows = [
    { c: '#c3ebd5', mon: 'Oct', day: 14, title: 'Flexbox Navigation Bar', meta: 'WD101 · graded 36 / 40', status: 'B+', ok: true },
    { c: '#eeea9e', mon: 'Oct', day: 15, title: 'EF Core Relationships', meta: 'DB201 · 60 points', status: 'Due Tue', ok: false },
    { c: '#d9ccff', mon: 'Oct', day: 17, title: 'Authentication with Cookies', meta: 'CS301 · 100 points', status: 'Due Thu', ok: false },
  ];
}

const authStyles = `
  :host { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); gap: 16px; min-height: 100vh; padding: 16px; }
  .panel { display: flex; align-items: center; justify-content: center; padding: 2rem 1rem; }
  .form { width: min(400px, 100%); }
  .mobile-brand { display: none; margin-bottom: 2rem; text-decoration: none !important; }
  h1 { font-size: 2.2rem; }
  .sub { color: var(--muted); margin: .4rem 0 1.6rem; }
  form { display: flex; flex-direction: column; gap: 1rem; }
  .pw { position: relative; }
  .pw button { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); }
  .check { display: flex; align-items: center; gap: .5rem; font-weight: 600; font-size: .9rem; cursor: pointer; }
  .check input { width: 18px; height: 18px; accent-color: var(--violet); }
  .alt { margin-top: 1.5rem; color: var(--muted); }
  @media (max-width: 900px) {
    :host { grid-template-columns: 1fr; }
    lh-auth-aside { display: none; }
    .mobile-brand { display: inline-flex; }
  }
`;

@Component({
  selector: 'lh-login',
  imports: [FormsModule, RouterLink, IconComponent, LogoComponent, AuthAsideComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lh-auth-aside />
    <section class="panel">
      <div class="form stagger">
        <a routerLink="/" class="mobile-brand"><lh-logo /></a>
        <div>
          <h1>Welcome back</h1>
          <p class="sub">Sign in to continue where you left off.</p>
        </div>
        <form (ngSubmit)="submit()" #f="ngForm">
          <div class="field">
            <label for="email">Email</label>
            <input id="email" class="input" type="email" name="email" [(ngModel)]="email" required email autocomplete="username" />
          </div>
          <div class="field">
            <label for="password">Password</label>
            <div class="pw">
              <input id="password" class="input" [type]="show() ? 'text' : 'password'" name="password" [(ngModel)]="password" required autocomplete="current-password" />
              <button type="button" class="btn btn-ghost btn-icon btn-sm" (click)="show.set(!show())" [attr.aria-label]="show() ? 'Hide password' : 'Show password'">
                <lh-icon [name]="show() ? 'eye-off' : 'eye'" class="sm" />
              </button>
            </div>
          </div>
          <label class="check"><input type="checkbox" name="remember" [(ngModel)]="remember" /> Keep me signed in</label>
          <button class="btn btn-ink btn-lg btn-block" type="submit" [disabled]="busy() || f.invalid">
            {{ busy() ? 'Signing in…' : 'Sign in' }} <lh-icon name="arrow-right" class="sm" />
          </button>
        </form>
        <p class="alt">New here? <a routerLink="/register" class="strong">Create an account</a></p>

        <div class="demo card card-flush">
          <div class="demo-head">Demo accounts — choose one to fill in the form</div>
          @for (d of demos; track d.email) {
            <button type="button" class="demo-row" (click)="fill(d.email, d.password)">
              <span class="role {{ d.role }}">{{ d.role }}</span><span class="grow truncate">{{ d.email }}</span><lh-icon name="arrow-right" class="sm" />
            </button>
          }
        </div>
      </div>
    </section>`,
  styles: [authStyles + `
    .demo { margin-top: 1.8rem; }
    .demo-head { padding: .7rem 1rem; font-size: .86rem; font-weight: 700; color: var(--ink-2); border-bottom: 1px solid var(--line); }
    .demo-row { display: flex; align-items: center; gap: .8rem; width: 100%; min-height: 46px; padding: .55rem 1rem; border: 0; background: transparent; cursor: pointer;
      text-align: left; font-size: .92rem; color: var(--ink-2); transition: background var(--dur) var(--ease); }
    .demo-row + .demo-row { border-top: 1px solid var(--line); }
    .demo-row:hover { background: var(--surface-2); }
    .demo-row .role { width: 92px; flex-shrink: 0; }
  `]
})
export class LoginComponent {
  private auth = inject(Auth);
  private router = inject(Router);
  private toasts = inject(Toasts);
  readonly returnUrl = input<string | undefined>();
  protected email = '';
  protected password = '';
  protected remember = false;
  protected busy = signal(false);
  protected show = signal(false);
  protected demos = [
    { role: 'Student', email: 'aarav@learnhub.local', password: 'Learn@123' },
    { role: 'Instructor', email: 'priya@learnhub.local', password: 'Teach@123' },
    { role: 'Admin', email: 'admin@learnhub.local', password: 'Admin@123' },
  ];

  fill(email: string, password: string) { this.email = email; this.password = password; }

  submit() {
    this.busy.set(true);
    this.auth.login(this.email, this.password, this.remember).subscribe({
      next: u => {
        this.toasts.ok(`Welcome back, ${firstName(u.fullName)}!`);
        const url = this.returnUrl();
        this.router.navigateByUrl(url && url.startsWith('/') && !url.startsWith('//') ? url : '/dashboard');
      },
      error: () => this.busy.set(false)
    });
  }
}

@Component({
  selector: 'lh-register',
  imports: [FormsModule, RouterLink, IconComponent, LogoComponent, AuthAsideComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lh-auth-aside />
    <section class="panel">
      <div class="form stagger">
        <a routerLink="/" class="mobile-brand"><lh-logo /></a>
        <div>
          <h1>Create your account</h1>
          <p class="sub">It takes less than a minute.</p>
        </div>
        <form (ngSubmit)="submit()" #f="ngForm">
          <div class="roles" role="radiogroup" aria-label="Account type">
            @for (r of roles; track r.value) {
              <button type="button" class="role-opt" [class.on]="role() === r.value" (click)="role.set(r.value)" role="radio" [attr.aria-checked]="role() === r.value">
                <span class="row strong"><lh-icon [name]="r.icon" /> {{ r.value }}</span><span class="small muted">{{ r.text }}</span>
              </button>
            }
          </div>
          <div class="field"><label for="name">Full name</label><input id="name" class="input" name="fullName" [(ngModel)]="fullName" required minlength="2" autocomplete="name" /></div>
          <div class="field"><label for="email">Email</label><input id="email" class="input" type="email" name="email" [(ngModel)]="email" required email autocomplete="email" /></div>
          <div class="field">
            <label for="password">Password</label>
            <input id="password" class="input" type="password" name="password" [(ngModel)]="password" required minlength="6" autocomplete="new-password" />
            <span class="hint">At least 6 characters.</span>
          </div>
          <button class="btn btn-ink btn-lg btn-block" type="submit" [disabled]="busy() || f.invalid">
            {{ busy() ? 'Creating account…' : 'Create account' }} <lh-icon name="arrow-right" class="sm" />
          </button>
        </form>
        <p class="alt">Already have an account? <a routerLink="/login" class="strong">Sign in</a></p>
      </div>
    </section>`,
  styles: [authStyles + `
    .roles { display: grid; grid-template-columns: 1fr 1fr; gap: .6rem; }
    .role-opt { display: flex; flex-direction: column; align-items: flex-start; gap: .25rem; padding: .85rem .9rem; border-radius: var(--r-ctl);
      background: var(--surface); border: 1px solid var(--line-strong); cursor: pointer; text-align: left;
      transition: border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease); }
    .role-opt .row { gap: .45rem; }
    .role-opt:hover { border-color: var(--ink-2); }
    /* Current selection → violet. */
    .role-opt.on { border-color: var(--violet); box-shadow: 0 0 0 1px var(--violet); }
  `]
})
export class RegisterComponent {
  private auth = inject(Auth);
  private router = inject(Router);
  private toasts = inject(Toasts);
  protected fullName = '';
  protected email = '';
  protected password = '';
  protected role = signal<Role>('Student');
  protected busy = signal(false);
  protected roles: { value: Role; icon: string; text: string }[] = [
    { value: 'Student', icon: 'backpack', text: 'Enroll and hand in work' },
    { value: 'Instructor', icon: 'presenter', text: 'Create courses and grade' },
  ];

  submit() {
    this.busy.set(true);
    this.auth.register({ fullName: this.fullName, email: this.email, password: this.password, role: this.role() }).subscribe({
      next: u => { this.toasts.ok(`Welcome to LearnHub, ${firstName(u.fullName)}!`); this.router.navigateByUrl('/dashboard'); },
      error: () => this.busy.set(false)
    });
  }
}
