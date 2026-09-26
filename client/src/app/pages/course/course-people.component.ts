import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { Api } from '../../core/api.service';
import { RosterRow } from '../../core/models';
import { Confirm, Toasts } from '../../core/services';
import { IconComponent } from '../../shared/icon.component';
import { AvatarComponent, EmptyComponent } from '../../shared/ui';
import { CourseStore } from './course.routes';

@Component({
  selector: 'lh-course-people',
  imports: [DatePipe, IconComponent, AvatarComponent, EmptyComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.course(); as c) {
      <section class="card card-flush fade-in">
        <div class="head">
          <div><div class="card-title">People</div><div class="card-sub">{{ rows().length }} students · 1 instructor</div></div>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Name</th><th>Role</th><th>Enrolled</th><th>Progress</th><th></th></tr></thead>
            <tbody>
              <tr>
                <td><div class="person"><lh-avatar [name]="c.instructor.fullName" size="sm" /><div><div class="name">{{ c.instructor.fullName }}</div><div class="sub">{{ c.instructor.email }}</div></div></div></td>
                <td><span class="role Instructor">Instructor</span></td><td class="muted">—</td><td class="muted">—</td><td></td>
              </tr>
              @for (r of rows(); track r.student.id) {
                <tr>
                  <td><div class="person"><lh-avatar [name]="r.student.fullName" size="sm" /><div><div class="name">{{ r.student.fullName }}</div><div class="sub">{{ r.student.email }}</div></div></div></td>
                  <td><span class="role Student">Student</span></td>
                  <td class="small muted nowrap">{{ r.enrolledAt | date: 'MMM d, y' }}</td>
                  <td style="min-width:170px">
                    <div class="meter" [style.--fill]="'var(--c-deep)'"><span [style.width.%]="c.assignmentCount ? r.submitted * 100 / c.assignmentCount : 0"></span></div>
                    <div class="tiny muted mt-1">{{ r.submitted }}/{{ c.assignmentCount }} submitted · {{ r.graded }} graded</div>
                  </td>
                  <td class="num"><button class="btn btn-danger btn-sm" (click)="remove(r)"><lh-icon name="trash" class="sm" /> Remove</button></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (!rows().length) { <lh-empty icon="people" title="No students yet" text="Students join from the course catalog." /> }
      </section>
    }`,
  styles: [`.head { padding: 1.1rem 1.25rem .4rem; }`]
})
export class CoursePeopleComponent {
  protected store = inject(CourseStore);
  private api = inject(Api);
  private confirm = inject(Confirm);
  private toasts = inject(Toasts);
  protected rows = signal<RosterRow[]>([]);

  constructor() { effect(() => { const c = this.store.course(); if (c) this.load(c.id); }); }
  private load(id: number) { this.api.roster(id).subscribe(r => this.rows.set(r)); }

  async remove(r: RosterRow) {
    const c = this.store.course()!;
    if (!await this.confirm.ask(`Remove ${r.student.fullName}?`, `They will no longer have access to ${c.code}. Their submissions are kept.`, 'Remove student')) return;
    this.api.removeStudent(c.id, r.student.id).subscribe(() => { this.toasts.ok('Student removed.'); this.store.reload(); this.load(c.id); });
  }
}
