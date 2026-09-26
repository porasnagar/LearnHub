import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../../core/api.service';
import { AssignmentRow, Gradebook } from '../../core/models';
import { Auth } from '../../core/services';
import { isPast, letterGrade, score, workStatus } from '../../core/util';
import { IconComponent } from '../../shared/icon.component';
import { AvatarComponent, EmptyComponent, RingComponent } from '../../shared/ui';
import { CourseStore } from './course.routes';

@Component({
  selector: 'lh-course-grades',
  imports: [RouterLink, DatePipe, IconComponent, AvatarComponent, EmptyComponent, RingComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.course()?.canManage) {
      <!-- Gradebook: students × assignments -->
      <section class="card card-flush fade-in">
        <div class="card-head pad">
          <div><div class="card-title">Gradebook</div><div class="card-sub">{{ book()?.rows?.length ?? 0 }} students · class average {{ classAvg() === null ? '–' : classAvg()!.toFixed(1) + '%' }}</div></div>
          <a class="btn btn-glass btn-sm" [href]="'/api/courses/' + store.course()!.id + '/gradebook.csv'" download><lh-icon name="download" class="sm" /> Export CSV</a>
        </div>
        @if (book(); as b) {
          @if (b.rows.length && b.assignments.length) {
            <div class="table-wrap">
              <table class="table gb">
                <thead><tr>
                  <th class="sticky">Student</th>
                  @for (a of b.assignments; track a.id) { <th class="c"><a [routerLink]="['../assignments', a.id]" class="th-link" [title]="a.title">{{ a.title }}</a><span class="pts">/ {{ a.maxPoints }}</span></th> }
                  <th class="c">Total</th>
                </tr></thead>
                <tbody>
                  @for (r of b.rows; track r.student.id) {
                    <tr>
                      <td class="sticky"><div class="person"><lh-avatar [name]="r.student.fullName" size="sm" /><div><div class="name">{{ r.student.fullName }}</div><div class="sub">{{ r.student.email }}</div></div></div></td>
                      @for (a of b.assignments; track a.id) {
                        <td class="c">
                          @if (r.cells[a.id]; as cell) {
                            @if (cell.score !== null) { <a class="cell graded serif" [routerLink]="['/grade', cell.submissionId]">{{ fmt(cell.score) }}</a> }
                            @else { <a class="cell todo" [routerLink]="['/grade', cell.submissionId]"><lh-icon name="pencil" class="sm" /> Grade</a> }
                          } @else if (past(a.dueDate)) { <span class="cell missing">Missing</span> }
                          @else { <span class="faint">–</span> }
                        </td>
                      }
                      <td class="c">@if (r.possible) { <span class="strong">{{ (r.earned / r.possible * 100).toFixed(0) }}%</span> <span class="letter">{{ letter(r.earned / r.possible * 100) }}</span> } @else { <span class="faint">–</span> }</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else { <lh-empty icon="grades" [title]="b.rows.length ? 'No assignments yet' : 'No students enrolled yet'" /> }
        } @else { <div class="skeleton" style="height:240px;margin:1rem"></div> }
      </section>
    } @else {
      <!-- Student: own grades -->
      <div class="bento stagger">
        <section class="card card-flush span-8">
          <div class="card-head pad"><div class="card-title">Assignments</div></div>
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>Assignment</th><th>Due</th><th>Status</th><th class="num">Score</th></tr></thead>
              <tbody>
                @for (a of rows(); track a.id) {
                  <tr>
                    <td><a [routerLink]="['../assignments', a.id]" class="strong">{{ a.title }}</a>
                      @if (a.mySubmission?.hasFeedback) { <div class="tiny muted row"><lh-icon name="chat" class="sm" /> Feedback available</div> }</td>
                    <td class="small muted nowrap">{{ a.dueDate | date: 'MMM d' }}</td>
                    <td><span class="status {{ st(a).css }}">{{ st(a).label }}</span></td>
                    <td class="num nowrap">@if (a.mySubmission?.score != null) { <span class="serif strong">{{ fmt(a.mySubmission!.score!) }}</span> } @else { – } <span class="muted small">/ {{ a.maxPoints }}</span></td>
                  </tr>
                } @empty { <tr><td colspan="4"><lh-empty icon="assignment" title="No assignments yet" /></td></tr> }
              </tbody>
            </table>
          </div>
        </section>
        <aside class="card card-lg span-4 center">
          <div class="card-title">Current grade</div>
          <lh-ring class="mt-2" [percent]="pct() ?? 0" [center]="pct() === null ? '–' : pct()!.toFixed(1) + '%'" [caption]="pct() === null ? 'No grades yet' : 'Letter ' + letter(pct()!)" [size]="180" />
          <p class="small muted mt-3">{{ fmt(earned()) }} of {{ possible() }} points from {{ gradedCount() }} graded assignment{{ gradedCount() === 1 ? '' : 's' }}. Ungraded work isn't counted yet.</p>
        </aside>
      </div>
    }`,
  styles: [`
    .pad { padding: 1.1rem 1.25rem 0; }
    .center { display: flex; flex-direction: column; align-items: center; text-align: center; }
    .gb th.c, .gb td.c { text-align: center; min-width: 120px; }
    .gb th { text-transform: none; letter-spacing: 0; font-size: .8rem; vertical-align: bottom; }
    .th-link { display: block; color: var(--ink-2); max-width: 150px; margin: 0 auto; white-space: normal; line-height: 1.3; }
    .pts { display: block; font-weight: 600; color: var(--faint); font-size: .72rem; }
    .sticky { position: sticky; left: 0; z-index: 1; background: var(--glass-strong); backdrop-filter: blur(12px); }
    .cell { display: inline-flex; align-items: center; justify-content: center; gap: 4px; min-width: 56px; height: 32px; padding: 0 10px; border-radius: 999px; font-weight: 700; text-decoration: none !important; }
    .cell.graded { background: var(--ok-soft); color: var(--ok); font-size: 1rem; }
    .cell.todo { background: var(--warn-soft); color: var(--warn); font-size: .8rem; }
    .cell.missing { background: var(--bad-soft); color: var(--bad); font-size: .78rem; }
    .letter { display: inline-grid; place-items: center; min-width: 30px; height: 24px; margin-left: 4px; border-radius: 8px; background: var(--btn-bg); color: var(--btn-fg); font-size: .75rem; font-weight: 800; }
  `]
})
export class CourseGradesComponent {
  protected store = inject(CourseStore);
  protected auth = inject(Auth);
  private api = inject(Api);
  protected rows = signal<AssignmentRow[]>([]);
  protected book = signal<Gradebook | null>(null);
  protected fmt = score;
  protected letter = letterGrade;
  protected past = isPast;

  constructor() {
    effect(() => {
      const c = this.store.course();
      if (!c) return;
      if (c.canManage) this.api.gradebook(c.id).subscribe(b => this.book.set(b));
      else this.api.courseAssignments(c.id).subscribe(r => this.rows.set(r));
    });
  }

  private graded = computed(() => this.rows().filter(r => r.mySubmission?.score != null));
  protected earned = computed(() => this.graded().reduce((s, r) => s + r.mySubmission!.score!, 0));
  protected possible = computed(() => this.graded().reduce((s, r) => s + r.maxPoints, 0));
  protected gradedCount = computed(() => this.graded().length);
  protected pct = computed(() => this.possible() ? this.earned() / this.possible() * 100 : null);
  protected classAvg = computed(() => {
    const totals = (this.book()?.rows ?? []).filter(r => r.possible).map(r => r.earned / r.possible * 100);
    return totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : null;
  });
  protected st(a: AssignmentRow) { return workStatus(a.dueDate, a.mySubmission); }
}
