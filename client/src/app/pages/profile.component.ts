import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
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
          @if (p.value(); as p) {
            <lh-avatar [name]="p.user.fullName" size="lg" />
            @if (editing()) {
              <form class="name-form" (ngSubmit)="saveName()">
                <label class="sr-only" for="fullName">Full name</label>
                <input id="fullName" class="input" name="fullName" [(ngModel)]="nameDraft" required minlength="2" maxlength="100"
                       autocomplete="name" (keydown.escape)="editing.set(false)" />
                <div class="row" style="justify-content:center">
                  <button type="button" class="btn btn-ghost btn-sm" (click)="editing.set(false)">Cancel</button>
                  <button class="btn btn-ink btn-sm" [disabled]="nameBusy() || nameDraft.trim().length < 2 || nameDraft.trim() === p.user.fullName">Save name</button>
                </div>
              </form>
            } @else {
              <h2 class="serif name">{{ p.user.fullName }}</h2>
              <button type="button" class="btn btn-ghost btn-sm edit" (click)="startEdit(p.user.fullName)"><lh-icon name="pencil" class="sm" /> Edit name</button>
            }
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
    .name { font-size: 1.7rem; animation: lh-fade 260ms var(--ease-out) backwards; }
    .edit { margin-top: -.5rem; }
    .name-form { display: flex; flex-direction: column; gap: .6rem; width: min(320px, 100%); animation: lh-pop 200ms var(--ease-out) backwards; }
    .name-form .input { text-align: center; font-weight: 700; }
    .stats { display: flex; justify-content: center; gap: 2rem; padding: 1rem 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); width: 100%; }
    .n { font-size: 1.5rem; font-weight: 600; }
    .themes { display: grid; grid-template-columns: 1fr 1fr; gap: .8rem; }
    .theme-opt { display: flex; flex-direction: column; gap: .5rem; padding: .6rem; border-radius: var(--r-ctl); border: 1px solid var(--line-strong); background: var(--surface); cursor: pointer; text-align: left; }
    .theme-opt.on { border-color: var(--violet); box-shadow: 0 0 0 1px var(--violet); }
    .sw { height: 64px; border-radius: 9px; padding: 9px; display: flex; }
    .sw span { width: 40%; border-radius: 6px; }
    /* Swatches show the real canvas + surface colours of each theme. */
    .sw.light { background: #f3f2f7; border: 1px solid #e6e4ed; } .sw.light span { background: #fff; border: 1px solid #e6e4ed; }
    .sw.dark { background: #111016; } .sw.dark span { background: #1a1921; border: 1px solid #2d2c36; }
  `]
})
export class ProfileComponent {
  private api = inject(Api);
  private auth = inject(Auth);
  private router = inject(Router);
  private toasts = inject(Toasts);
  protected theme = inject(Theme);
  protected p = rxResource({ loader: () => this.api.profile() });
  protected editing = signal(false);
  protected nameBusy = signal(false);
  protected nameDraft = '';
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

  startEdit(current: string) {
    this.nameDraft = current;
    this.editing.set(true);
    setTimeout(() => (document.getElementById('fullName') as HTMLInputElement | null)?.select());
  }

  saveName() {
    this.nameBusy.set(true);
    this.api.updateProfile(this.nameDraft.trim()).subscribe({
      next: user => {
        this.auth.user.set(user);
        this.p.value.update(p => p ? { ...p, user } : p);
        this.editing.set(false);
        this.nameBusy.set(false);
        this.toasts.ok('Name updated.');
      },
      error: () => this.nameBusy.set(false)
    });
  }

  signOut() { this.auth.logout().subscribe(() => this.router.navigateByUrl('/')); }
}
