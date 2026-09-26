import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Role } from '../core/models';
import { Auth, Toasts } from '../core/services';
import { firstName } from '../core/util';
import { IconComponent, LogoComponent } from '../shared/icon.component';
import { RingComponent } from '../shared/ui';

/** Left-hand brand panel shared by sign-in and registration. */
@Component({
  selector: 'lh-auth-aside',
  imports: [LogoComponent, IconComponent, RingComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="aside">
      <a routerLink="/" class="brand"><lh-logo /></a>
      <div class="art" aria-hidden="true">
        <div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div>
        <div class="glass card g1"><lh-ring [percent]="92" center="A-" caption="Current grade" [size]="120" color="#6c4dff" /></div>
        <div class="glass card g2">
          <div class="row"><span class="ic"><lh-icon name="calendar" /></span><div><div class="strong small">Due Thursday</div><div class="tiny muted">Responsive Portfolio · 100 pts</div></div></div>
        </div>
        <div class="glass card g3">
          <div class="tiny muted strong">FEEDBACK</div>
          <div class="small mt-1">“Excellent attention to detail. This is a model answer.”</div>
        </div>
      </div>
      <div>
        <h2>Your courses, coursework and grades, in one calm place.</h2>
        <p class="muted mt-1">Join thousands of learners and instructors on LearnHub.</p>
      </div>
    </aside>`,
  styles: [`
    .aside { position: relative; height: 100%; min-height: 640px; border-radius: 32px; padding: 2rem; display: flex; flex-direction: column; justify-content: space-between;
      background: #16151c; color: #fff; overflow: hidden; }
    .brand { position: relative; z-index: 2; text-decoration: none !important; }
    .brand ::ng-deep .word { color: #fff; }
    h2 { color: #fff; font-family: var(--serif); font-size: 2rem; line-height: 1.2; position: relative; z-index: 2; }
    .muted { color: rgba(255,255,255,.6); position: relative; z-index: 2; }
    .art { position: relative; flex: 1; margin: 1rem 0; }
    .blob { position: absolute; border-radius: 50%; filter: blur(2px); }
    .b1 { width: 240px; height: 240px; background: #cfc0ff; top: 20px; left: 8%; animation: float 9s ease-in-out infinite; }
    .b2 { width: 150px; height: 150px; background: #e9e58e; bottom: 30px; right: 12%; animation: float 7s ease-in-out infinite -2s; }
    .b3 { width: 90px; height: 90px; background: #bfebd4; top: 40%; right: 30%; animation: float 8s ease-in-out infinite -4s; }
    .card { position: absolute; color: var(--ink); background: rgba(255,255,255,.55); border-color: rgba(255,255,255,.6); }
    :host-context([data-theme="dark"]) .card { background: rgba(40,38,56,.6); }
    .g1 { top: 60px; left: 22%; animation: rise .8s var(--ease) both .1s, float 8s ease-in-out infinite -1s; }
    .g2 { bottom: 70px; left: 4%; width: 260px; animation: rise .8s var(--ease) both .3s, float 7s ease-in-out infinite -3s; }
    .g3 { top: 44%; right: 2%; width: 230px; animation: rise .8s var(--ease) both .5s, float 9s ease-in-out infinite -5s; }
    .ic { width: 38px; height: 38px; border-radius: 12px; background: #16151c; color: #e9e58e; display: grid; place-items: center; }
  `]
})
export class AuthAsideComponent {}

const authStyles = `
  :host { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); gap: 16px; min-height: 100vh; padding: 16px; }
  .panel { display: flex; align-items: center; justify-content: center; padding: 2rem 1rem; }
  .form { width: min(420px, 100%); }
  .mobile-brand { display: none; margin-bottom: 2rem; text-decoration: none !important; }
  h1 { font-size: 2.4rem; }
  .sub { color: var(--muted); margin: .4rem 0 1.8rem; }
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

        <div class="demo glass">
          <div class="demo-head"><lh-icon name="bolt" class="sm" /> Demo accounts — tap one to fill the form</div>
          @for (d of demos; track d.email) {
            <button type="button" class="demo-row" (click)="fill(d.email, d.password)">
              <span class="role {{ d.role }}">{{ d.role }}</span><span class="grow truncate">{{ d.email }}</span><lh-icon name="arrow-right" class="sm" />
            </button>
          }
        </div>
      </div>
    </section>`,
  styles: [authStyles + `
    .demo { margin-top: 1.8rem; border-radius: 20px; overflow: hidden; }
    .demo-head { display: flex; align-items: center; gap: .5rem; padding: .75rem 1rem; font-size: .82rem; font-weight: 700; color: var(--ink-2); border-bottom: 1px solid var(--line); }
    .demo-row { display: flex; align-items: center; gap: .8rem; width: 100%; padding: .7rem 1rem; border: 0; background: transparent; cursor: pointer; text-align: left; font-size: .9rem; color: var(--ink-2); transition: background .2s; }
    .demo-row + .demo-row { border-top: 1px solid var(--line); }
    .demo-row:hover { background: var(--glass-strong); }
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
              <button type="button" class="role-opt glass" [class.on]="role() === r.value" (click)="role.set(r.value)" role="radio" [attr.aria-checked]="role() === r.value">
                <span class="ri"><lh-icon [name]="r.icon" /></span>
                <span class="strong">{{ r.value }}</span><span class="tiny muted">{{ r.text }}</span>
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
    .roles { display: grid; grid-template-columns: 1fr 1fr; gap: .7rem; }
    .role-opt { display: flex; flex-direction: column; align-items: flex-start; gap: .2rem; padding: 1rem; border-radius: 20px; cursor: pointer; text-align: left; transition: box-shadow .25s, transform .2s; }
    .role-opt:hover { transform: translateY(-2px); }
    .role-opt.on { box-shadow: 0 0 0 2px var(--violet), var(--shadow); }
    .ri { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; background: var(--violet-soft); color: var(--violet); margin-bottom: .4rem; }
    .role-opt.on .ri { background: var(--violet); color: #fff; }
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
