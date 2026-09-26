import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Api } from '../core/api.service';
import { Auth, Theme, Toasts } from '../core/services';
import { IconComponent } from '../shared/icon.component';
import { AvatarComponent } from '../shared/ui';

@Component({
  selector: 'lh-profile',
  imports: [DatePipe, FormsModule, IconComponent, AvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head fade-in"><div><h1 class="page-title">Account</h1><p class="page-sub">Your profile, appearance and password.</p></div></div>
      <div class="bento stagger">
        <section class="card card-lg span-5 me">
          @if (p(); as p) {
            <lh-avatar [name]="p.user.fullName" size="lg" />
            <h2 class="serif name">{{ p.user.fullName }}</h2>
            <span class="role {{ p.user.role }}">{{ p.user.role }}</span>
            <div class="stats">
              <div><div class="n serif">{{ p.courseCount }}</div><div class="tiny muted">{{ p.user.role === 'Student' ? 'Courses' : 'Teaching' }}</div></div>
              @if (p.user.role === 'Student') { <div><div class="n serif">{{ p.submissionCount }}</div><div class="tiny muted">Submissions</div></div> }
              <div><div class="n serif">{{ p.user.createdAt | date: 'MMM y' }}</div><div class="tiny muted">Joined</div></div>
            </div>
            <div class="row small muted"><lh-icon name="mail" class="sm" /> {{ p.user.email }}</div>
          } @else { <div class="skeleton" style="height:260px;width:100%"></div> }
        </section>

        <div class="span-7 stack">
          <section class="card card-lg">
            <div class="card-title mb-2">Appearance</div>
            <div class="themes">
              <button class="theme-opt" [class.on]="theme.mode() === 'light'" (click)="theme.mode() !== 'light' && theme.toggle()">
                <span class="sw light"><span></span></span><span class="strong small">Light</span></button>
              <button class="theme-opt" [class.on]="theme.mode() === 'dark'" (click)="theme.mode() !== 'dark' && theme.toggle()">
                <span class="sw dark"><span></span></span><span class="strong small">Dark</span></button>
            </div>
          </section>

          <form class="card card-lg stack" (ngSubmit)="change()" #f="ngForm">
            <div class="card-title">Change password</div>
            <div class="field"><label for="cur">Current password</label><input id="cur" class="input" type="password" name="cur" [(ngModel)]="current" required autocomplete="current-password" /></div>
            <div class="form-grid">
              <div class="field"><label for="n1">New password</label><input id="n1" class="input" type="password" name="n1" [(ngModel)]="next" required minlength="6" autocomplete="new-password" /></div>
              <div class="field"><label for="n2">Confirm new password</label><input id="n2" class="input" type="password" name="n2" [(ngModel)]="confirm" required autocomplete="new-password" />
                @if (confirm && confirm !== next) { <span class="hint" style="color:var(--bad)">Passwords don't match.</span> }</div>
            </div>
            <div class="row between">
              <button type="button" class="btn btn-ghost" (click)="signOut()"><lh-icon name="logout" class="sm" /> Sign out</button>
              <button class="btn btn-ink" [disabled]="f.invalid || confirm !== next || busy()">Update password</button>
            </div>
          </form>
        </div>
      </div>
    </div>`,
  styles: [`
    .me { display: flex; flex-direction: column; align-items: center; text-align: center; gap: .8rem; }
    .name { font-size: 1.7rem; }
    .stats { display: flex; justify-content: center; gap: 2rem; padding: 1rem 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); width: 100%; }
    .n { font-size: 1.5rem; font-weight: 600; }
    .themes { display: grid; grid-template-columns: 1fr 1fr; gap: .8rem; }
    .theme-opt { display: flex; flex-direction: column; gap: .5rem; padding: .7rem; border-radius: 20px; border: 1px solid var(--line); background: var(--glass-strong); cursor: pointer; text-align: left; transition: box-shadow .25s; }
    .theme-opt.on { box-shadow: 0 0 0 2px var(--violet); }
    .sw { height: 70px; border-radius: 14px; padding: 10px; display: flex; }
    .sw span { width: 40%; border-radius: 8px; }
    .sw.light { background: linear-gradient(135deg, #edeef6, #d9ccff); } .sw.light span { background: #fff; }
    .sw.dark { background: linear-gradient(135deg, #0d0c13, #3a2a80); } .sw.dark span { background: #26243a; }
  `]
})
export class ProfileComponent {
  private api = inject(Api);
  private auth = inject(Auth);
  private router = inject(Router);
  private toasts = inject(Toasts);
  protected theme = inject(Theme);
  protected p = toSignal(this.api.profile());
  protected busy = signal(false);
  protected current = '';
  protected next = '';
  protected confirm = '';

  change() {
    this.busy.set(true);
    this.api.changePassword(this.current, this.next).subscribe({
      next: () => { this.toasts.ok('Password updated.'); this.current = this.next = this.confirm = ''; this.busy.set(false); },
      error: () => this.busy.set(false)
    });
  }

  signOut() { this.auth.logout().subscribe(() => this.router.navigateByUrl('/')); }
}
