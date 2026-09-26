import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Api } from '../core/api.service';
import { Role, UserRow } from '../core/models';
import { Auth, Confirm, Toasts } from '../core/services';
import { IconComponent } from '../shared/icon.component';
import { AvatarComponent, CountUpDirective, CourseCardComponent, EmptyComponent } from '../shared/ui';

@Component({
  selector: 'lh-admin',
  imports: [DatePipe, FormsModule, IconComponent, AvatarComponent, CountUpDirective, CourseCardComponent, EmptyComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head fade-in">
        <div><h1 class="page-title">Administration</h1><p class="page-sub">Accounts, roles and every course on LearnHub.</p></div>
        <div class="seg">
          <button [class.active]="tab() === 'users'" (click)="tab.set('users')"><lh-icon name="people" class="sm" /> Users</button>
          <button [class.active]="tab() === 'courses'" (click)="tab.set('courses')"><lh-icon name="courses" class="sm" /> Courses</button>
        </div>
      </div>

      @if (tab() === 'users') {
        <div class="figs stagger">
          @for (f of figs; track f.key) {
            <button class="card fig" [class.tone]="role() === f.key" [style.--tone]="f.tone" (click)="role.set(role() === f.key ? '' : f.key)">
              <span class="strong small">{{ f.label }}</span>
              <span class="n serif" [lhCountUp]="count(f.key)"></span>
            </button>
          }
        </div>

        <section class="card card-flush fade-in">
          <div class="toolbar">
            <div class="input-wrap grow"><lh-icon name="search" class="sm" />
              <input class="input sm" [ngModel]="q()" (ngModelChange)="q.set($event)" placeholder="Search name or email" aria-label="Search users" /></div>
            <span class="small muted">{{ users.value()?.users?.length ?? 0 }} shown</span>
          </div>
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>Name</th><th>Role</th><th>Activity</th><th>Joined</th><th class="num">Actions</th></tr></thead>
              <tbody>
                @for (r of users.value()?.users ?? []; track r.user.id) {
                  <tr>
                    <td><div class="person"><lh-avatar [name]="r.user.fullName" size="sm" /><div><div class="name">{{ r.user.fullName }} @if (me(r)) { <span class="faint small">(you)</span> }</div><div class="sub">{{ r.user.email }}</div></div></div></td>
                    <td><span class="role {{ r.user.role }}">{{ r.user.role }}</span></td>
                    <td class="small muted">{{ r.user.role === 'Instructor' ? 'Teaches ' + r.coursesTaught : r.user.role === 'Student' ? 'Enrolled in ' + r.enrollments : 'Platform admin' }}</td>
                    <td class="small muted nowrap">{{ r.user.createdAt | date: 'MMM d, y' }}</td>
                    <td class="num">
                      @if (!me(r)) {
                        <div class="actions">
                          <select class="select sm" [ngModel]="r.user.role" (ngModelChange)="changeRole(r, $event)" [attr.aria-label]="'Role for ' + r.user.fullName">
                            @for (x of roles; track x) { <option [value]="x">{{ x }}</option> }
                          </select>
                          <button class="btn btn-danger btn-sm btn-icon" (click)="remove(r)" [attr.aria-label]="'Delete ' + r.user.fullName"><lh-icon name="trash" class="sm" /></button>
                        </div>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (users.value()?.users?.length === 0) { <lh-empty icon="search" title="No accounts match" /> }
        </section>
      } @else {
        <div class="cards-grid stagger">@for (c of courses() ?? []; track c.id) { <lh-course-card [c]="c" [mine]="true" /> }</div>
      }
    </div>`,
  styles: [`
    .figs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
    .fig { display: flex; flex-direction: column; align-items: flex-start; gap: .4rem; text-align: left; cursor: pointer; font: inherit; color: inherit; transition: transform .2s var(--ease); }
    .fig:hover { transform: translateY(-2px); }
    .n { font-size: 2.4rem; font-weight: 600; line-height: 1; }
    .toolbar { display: flex; align-items: center; gap: 1rem; padding: 1rem 1.2rem; }
    .toolbar .input-wrap { max-width: 360px; }
    .actions { display: inline-flex; gap: .4rem; }
    .actions .select { width: 130px; }
    @media (max-width: 800px) { .figs { grid-template-columns: repeat(2, 1fr); } }
  `]
})
export class AdminComponent {
  private api = inject(Api);
  private auth = inject(Auth);
  private toasts = inject(Toasts);
  private confirm = inject(Confirm);
  protected tab = signal<'users' | 'courses'>('users');
  protected q = signal('');
  protected role = signal<string>('');
  protected roles: Role[] = ['Student', 'Instructor', 'Admin'];
  protected figs = [
    { key: '', label: 'All accounts', tone: 'var(--lilac)' },
    { key: 'Student', label: 'Students', tone: 'var(--mint)' },
    { key: 'Instructor', label: 'Instructors', tone: 'var(--lilac)' },
    { key: 'Admin', label: 'Admins', tone: 'var(--lemon)' },
  ];

  protected users = rxResource({
    request: () => ({ q: this.q(), role: this.role() }),
    loader: ({ request }) => this.api.adminUsers(request.q, request.role)
  });
  protected courses = toSignal(this.api.myCourses());

  protected count(key: string) {
    const c = this.users.value()?.counts ?? {};
    return key ? c[key] ?? 0 : Object.values(c).reduce((a, b) => a + b, 0);
  }
  protected me(r: UserRow) { return r.user.id === this.auth.user()?.id; }

  changeRole(r: UserRow, role: Role) {
    this.api.changeRole(r.user.id, role).subscribe({
      next: () => { this.toasts.ok(`${r.user.fullName} is now ${role === 'Admin' ? 'an' : 'a'} ${role}.`); this.users.reload(); },
      error: () => this.users.reload()
    });
  }

  async remove(r: UserRow) {
    if (!await this.confirm.ask(`Delete ${r.user.fullName}?`, 'Their enrollments and submissions will be removed. This cannot be undone.', 'Delete account')) return;
    this.api.deleteUser(r.user.id).subscribe(() => { this.toasts.ok('Account deleted.'); this.users.reload(); });
  }
}
