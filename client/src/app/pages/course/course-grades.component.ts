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
        <div class="span-4 stack">
          <aside class="card card-lg center">
            <div class="card-title">Current grade</div>
            <lh-ring class="mt-2" [percent]="pct() ?? 0" [center]="pct() === null ? '–' : pct()!.toFixed(1) + '%'" [caption]="pct() === null ? 'No grades yet' : 'Letter ' + letter(pct()!)" [size]="180" />
            <p class="small muted mt-3">{{ fmt(earned()) }} of {{ possible() }} points from {{ gradedCount() }} graded assignment{{ gradedCount() === 1 ? '' : 's' }}. Ungraded work isn't counted yet.</p>
          </aside>

          <!-- What-if: try scores for ungraded work and see where the course grade would land. -->
          <section class="card card-lg" aria-labelledby="wi-title">
            <h2 id="wi-title" class="card-title row"><lh-icon name="calculator" class="sm" /> What if…</h2>
            <p class="card-sub mt-1">Try scores for work that isn't graded yet. Nothing is saved.</p>
            @if (pending().length) {
              <div class="wi-result mt-2">
                <div>
                  <div class="wi-big serif tabnum">{{ projected() === null ? '–' : projected()!.toFixed(1) + '%' }}</div>
                  <div class="small muted">{{ projected() === null ? 'Move a slider to project' : 'Projected · ' + letter(projected()!) }}</div>
                </div>
                @if (delta() !== null && tried()) {
                  <span class="delta" [class.up]="delta()! >= 0" [class.down]="delta()! < 0">{{ delta()! >= 0 ? '+' : '' }}{{ delta()!.toFixed(1) }}</span>
                }
              </div>
              <div class="quick">
                <span class="tiny muted strong">Fill all with</span>
                @for (q of quick; track q) { <button class="chip" type="button" (click)="fillAll(q)">{{ q }}%</button> }
                @if (tried()) { <button class="chip" type="button" (click)="whatIf.set({})">Clear</button> }
              </div>
              <div class="wi-list">
                @for (a of pending(); track a.id) {
                  @let v = whatIf()[a.id];
                  <div class="wi-row" [class.unset]="v === undefined">
                    <div class="row between small"><span class="strong truncate">{{ a.title }}</span>
                      <span class="tabnum nowrap"><b>{{ v ?? '–' }}</b><span class="muted"> / {{ a.maxPoints }}</span></span></div>
                    <input type="range" min="0" [max]="a.maxPoints" step="1" [value]="v ?? 0" (input)="set(a.id, $event)"
                           [attr.aria-label]="'What-if score for ' + a.title" [style.--p]="((v ?? 0) / a.maxPoints * 100) + '%'" />
                  </div>
                }
              </div>
              <div class="goal">
                <label for="goal" class="small strong">Goal for this course</label>
                <select id="goal" class="select sm mt-1" (change)="goal.set(+$any($event.target).value)">
                  @for (g of goals; track g.pct) { <option [value]="g.pct" [selected]="g.pct === goal()">{{ g.label }} ({{ g.pct }}% or more)</option> }
                </select>
                <p class="small mt-2 need" [class.bad]="(needed() ?? 0) > 100" [class.ok]="(needed() ?? 1) <= 0">{{ neededText() }}</p>
              </div>
            } @else {
              <lh-empty icon="check-circle" title="Everything is graded" text="There's no ungraded work left to project." />
            }
          </section>
        </div>
      </div>
    }`,
  styles: [`
    .pad { padding: 1.1rem 1.25rem 0; }
    .center { display: flex; flex-direction: column; align-items: center; text-align: center; }
    .gb th.c, .gb td.c { text-align: center; min-width: 120px; }
    .gb th { text-transform: none; letter-spacing: 0; font-size: .8rem; vertical-align: bottom; }
    .th-link { display: block; color: var(--ink-2); max-width: 150px; margin: 0 auto; white-space: normal; line-height: 1.3; }
    .pts { display: block; font-weight: 600; color: var(--faint); font-size: .72rem; }
    .sticky { position: sticky; left: 0; z-index: 1; background: var(--surface); box-shadow: 1px 0 0 var(--line); }
    tbody tr:hover .sticky { background: var(--surface-2); }
    .cell { display: inline-flex; align-items: center; justify-content: center; gap: 4px; min-width: 56px; height: 32px; padding: 0 10px; border-radius: 999px; font-weight: 700; text-decoration: none !important; }
    .cell.graded { background: var(--ok-soft); color: var(--ok); font-size: 1rem; }
    .cell.todo { background: var(--warn-soft); color: var(--warn); font-size: .8rem; }
    .cell.missing { background: var(--bad-soft); color: var(--bad); font-size: .78rem; }
    .wi-result { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: .9rem 1rem; border-radius: var(--r-ctl); background: var(--surface-2); }
    .wi-big { font-size: 2rem; font-weight: 600; line-height: 1; }
    .delta { height: 28px; padding: 0 .65rem; border-radius: 999px; display: inline-grid; place-items: center; font-weight: 800; font-size: .86rem;
      font-variant-numeric: tabular-nums; animation: lh-pop 200ms var(--ease-out) backwards; }
    .delta.up { background: var(--ok-soft); color: var(--ok); }
    .delta.down { background: var(--bad-soft); color: var(--bad); }
    .quick { display: flex; flex-wrap: wrap; align-items: center; gap: .4rem; margin: .9rem 0 .4rem; }
    .quick .chip { height: 30px; padding: 0 .7rem; }
    .wi-list { display: flex; flex-direction: column; gap: .2rem; }
    .wi-row { padding: .55rem 0; transition: opacity 200ms var(--ease-out); }
    .wi-row + .wi-row { border-top: 1px solid var(--line); }
    .wi-row.unset { opacity: .62; }
    .wi-row .row { gap: .5rem; }
    input[type=range] { width: 100%; height: 22px; margin: .35rem 0 0; background: transparent; appearance: none; -webkit-appearance: none; cursor: pointer; }
    input[type=range]::-webkit-slider-runnable-track { height: 6px; border-radius: 999px;
      background: linear-gradient(to right, var(--violet) var(--p, 0%), var(--surface-2) var(--p, 0%)); box-shadow: inset 0 0 0 1px var(--line); }
    input[type=range]::-moz-range-track { height: 6px; border-radius: 999px; background: var(--surface-2); box-shadow: inset 0 0 0 1px var(--line); }
    input[type=range]::-moz-range-progress { height: 6px; border-radius: 999px; background: var(--violet); }
    input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; margin-top: -6px; border-radius: 50%;
      background: #fff; border: 2px solid var(--violet); box-shadow: 0 1px 3px rgba(0,0,0,.2); transition: transform 120ms var(--ease-out); }
    input[type=range]:active::-webkit-slider-thumb { transform: scale(1.15); }
    input[type=range]::-moz-range-thumb { width: 16px; height: 16px; border-radius: 50%; background: #fff; border: 2px solid var(--violet); }
    .goal { margin-top: .9rem; padding-top: .9rem; border-top: 1px solid var(--line); }
    .need { color: var(--ink-2); }
    .need.bad { color: var(--bad); }
    .need.ok { color: var(--ok); }
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

  // ---------- What-if calculator (students) ----------
  protected readonly quick = [70, 85, 100];
  protected readonly goals = [
    { label: 'A', pct: 93 }, { label: 'A-', pct: 90 }, { label: 'B+', pct: 87 }, { label: 'B', pct: 83 },
    { label: 'B-', pct: 80 }, { label: 'C', pct: 73 }, { label: 'D', pct: 60 },
  ];
  protected readonly whatIf = signal<Record<number, number>>({});
  protected readonly goal = signal(83);
  protected readonly pending = computed(() => this.rows().filter(r => r.mySubmission?.score == null));
  protected readonly tried = computed(() => Object.keys(this.whatIf()).length > 0);
  protected readonly projected = computed(() => {
    let earned = this.earned(), possible = this.possible();
    for (const r of this.pending()) {
      const v = this.whatIf()[r.id];
      if (v !== undefined) { earned += v; possible += r.maxPoints; }
    }
    return possible ? earned / possible * 100 : null;
  });
  protected readonly delta = computed(() => {
    const p = this.projected(), c = this.pct();
    return p === null ? null : p - (c ?? 0);
  });
  private readonly remainingMax = computed(() => this.pending().reduce((s, r) => s + r.maxPoints, 0));
  /** Average % needed on all ungraded work to finish at the goal. */
  protected readonly needed = computed(() => {
    const rest = this.remainingMax();
    if (!rest) return null;
    return (this.goal() / 100 * (this.possible() + rest) - this.earned()) / rest * 100;
  });
  protected readonly neededText = computed(() => {
    const n = this.needed();
    const label = this.goals.find(g => g.pct === this.goal())?.label ?? '';
    const k = this.pending().length;
    if (n === null) return '';
    if (n <= 0) return `You've already secured a ${label}, whatever happens on the rest.`;
    if (n > 100) return `A ${label} is out of reach: it would take ${n.toFixed(0)}% on the remaining work.`;
    return `You need an average of ${n.toFixed(0)}% on the remaining ${k} assignment${k === 1 ? '' : 's'} to finish with a ${label}.`;
  });

  protected set(id: number, e: Event) {
    const v = +(e.target as HTMLInputElement).value;
    this.whatIf.update(m => ({ ...m, [id]: v }));
  }

  protected fillAll(pct: number) {
    const next: Record<number, number> = {};
    for (const r of this.pending()) next[r.id] = Math.round(r.maxPoints * pct / 100);
    this.whatIf.set(next);
  }
}
