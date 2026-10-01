import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../../core/api.service';
import { AssignmentDetail } from '../../core/models';
import { Confirm, Toasts } from '../../core/services';
import { dueText, isPast, letterGrade, score, workStatus } from '../../core/util';
import { IconComponent } from '../../shared/icon.component';
import { AvatarComponent, EmptyComponent, RingComponent } from '../../shared/ui';
import { CourseStore } from './course.routes';

@Component({
  selector: 'lh-assignment',
  imports: [RouterLink, DatePipe, FormsModule, IconComponent, AvatarComponent, EmptyComponent, RingComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (a(); as a) {
      <div class="bento">
        <div class="span-8 stack">
          <section class="card card-lg">
            <div class="row between wrap">
              <a routerLink="../" class="back small strong"><lh-icon name="arrow-left" class="sm" /> Assignments</a>
              @if (a.canManage) {
                <div class="row"><a routerLink="edit" class="btn btn-glass btn-sm"><lh-icon name="pencil" class="sm" /> Edit</a>
                  <button class="btn btn-danger btn-sm btn-icon" (click)="remove()" aria-label="Delete assignment"><lh-icon name="trash" class="sm" /></button></div>
              }
            </div>
            <h1 class="title">{{ a.title }}</h1>
            <div class="facts">
              <div class="fact"><lh-icon name="calendar" class="sm" /><span><b>Due</b> {{ a.dueDate | date: 'EEE, MMM d · h:mm a' }}</span></div>
              <div class="fact"><lh-icon name="award" class="sm" /><span><b>{{ a.maxPoints }}</b> points</span></div>
              <div class="fact"><lh-icon name="upload" class="sm" /><span>Text entry or file upload</span></div>
              <span class="status {{ overdue() && !a.canManage && !a.mySubmission ? 'missing' : 'open' }}">{{ due(a.dueDate) }}</span>
            </div>
            <div class="instructions pre">{{ a.instructions }}</div>
          </section>

          @if (!a.canManage) {
            @if (a.mySubmission; as s) {
              <section class="card card-lg">
                <div class="card-head"><div><div class="card-title">Your submission</div><div class="card-sub">Handed in {{ s.submittedAt | date: 'MMM d, y · h:mm a' }}</div></div>
                  <span class="status {{ s.isLate ? 'late' : 'ok' }}">{{ s.isLate ? 'Late' : 'On time' }}</span></div>
                @if (s.textAnswer) { <div class="doc pre">{{ s.textAnswer }}</div> }
                @if (s.originalFileName) {
                  <a class="file" [href]="'/api/assignments/download/' + s.id" download>
                    <lh-icon name="file" /><span class="grow truncate strong">{{ s.originalFileName }}</span><span class="small">Download</span><lh-icon name="download" class="sm" />
                  </a>
                }
                @if (canSubmit() && !composer()) {
                  <button class="btn btn-glass btn-sm mt-3" (click)="composer.set(true)"><lh-icon name="refresh" class="sm" /> Resubmit</button>
                }
              </section>
            }

            @if (canSubmit() && (composer() || !a.mySubmission)) {
              <section class="card card-lg composer">
                <div class="card-head"><div class="card-title">{{ a.mySubmission ? 'Resubmit your work' : 'Submit your work' }}</div></div>
                @if (overdue()) { <div class="note"><lh-icon name="alert" class="sm" /> The due date has passed — this will be marked late.</div> }
                <textarea class="textarea" rows="7" [(ngModel)]="text" placeholder="Write your answer here, or attach a file below…" maxlength="8000"></textarea>
                <label class="drop" [class.over]="dragging()" (dragover)="$event.preventDefault(); dragging.set(true)" (dragleave)="dragging.set(false)" (drop)="onDrop($event)">
                  <input type="file" (change)="onPick($event)" [accept]="a.allowedExtensions.replaceAll(' ', '')" hidden />
                  <lh-icon name="upload" class="lg" />
                  @if (file(); as f) { <span class="strong">{{ f.name }}</span><span class="tiny muted">{{ (f.size / 1024).toFixed(0) }} KB · click to change</span> }
                  @else { <span class="strong">Drop a file or click to browse</span><span class="tiny muted">Up to {{ a.maxFileSizeMB }} MB · {{ a.allowedExtensions }}</span> }
                </label>
                <div class="row" style="justify-content:flex-end">
                  @if (a.mySubmission) { <button class="btn btn-ghost" (click)="composer.set(false)">Cancel</button> }
                  <button class="btn btn-ink" (click)="submit()" [disabled]="busy() || (!text.trim() && !file() && !a.mySubmission?.originalFileName)">
                    {{ busy() ? 'Uploading…' : 'Submit assignment' }} <lh-icon name="arrow-right" class="sm" /></button>
                </div>
              </section>
            }
          } @else {
            <section class="card card-flush">
              <div class="card-head pad"><div><div class="card-title">Submissions</div><div class="card-sub">{{ submittedCount() }} of {{ enrolledCount() }} students</div></div></div>
              @if (a.rows.length) {
                <div class="table-wrap"><table class="table">
                  <thead><tr><th>Student</th><th>Status</th><th>Submitted</th><th class="num">Score</th><th></th></tr></thead>
                  <tbody>
                    @for (r of a.rows; track r.student.id) {
                      <tr>
                        <td><div class="person"><lh-avatar [name]="r.student.fullName" size="sm" /><div><div class="name">{{ r.student.fullName }}</div>@if (!r.stillEnrolled) {<div class="sub">No longer enrolled</div>}</div></div></td>
                        <td>@if (r.submission && r.submission.score === null) { <span class="status pending">Needs grading</span> }
                            @else { <span class="status {{ st(r.submission).css }}">{{ st(r.submission).label }}</span> }
                            @if (r.submission?.isLate) { <span class="status late ml">Late</span> }</td>
                        <td class="small muted nowrap">{{ r.submission ? (r.submission.submittedAt | date: 'MMM d, h:mm a') : '—' }}</td>
                        <td class="num">@if (r.submission?.score != null) { <span class="serif strong">{{ fmt(r.submission!.score!) }}</span><span class="muted small">/{{ a.maxPoints }}</span> } @else { – }</td>
                        <td class="num">@if (r.submission) { <a class="btn btn-sm" [class.btn-ink]="r.submission.score === null" [class.btn-glass]="r.submission.score !== null" [routerLink]="['/grade', r.submission.id]">{{ r.submission.score === null ? 'Grade' : 'Review' }}</a> }</td>
                      </tr>
                    }
                  </tbody>
                </table></div>
              } @else { <lh-empty icon="people" title="No students enrolled yet" /> }
            </section>
          }
        </div>

        <aside class="span-4 stack">
          @if (!a.canManage) {
            <section class="card card-lg center">
              <div class="row between w100"><div class="card-title">Status</div><span class="status {{ st(a.mySubmission).css }}">{{ st(a.mySubmission).label }}</span></div>
              @if (a.mySubmission?.score != null) {
                <lh-ring class="mt-3" [percent]="pct()" [center]="fmt(a.mySubmission!.score!) + '/' + a.maxPoints" [caption]="'Grade ' + letter(pct())" [size]="160" />
              } @else {
                <p class="small muted mt-3 left">{{ a.mySubmission ? 'Handed in. Your instructor hasn\\'t graded it yet; the score and comments will appear here.' : 'Not handed in yet. Use the form to submit text, a file, or both.' }}</p>
              }
            </section>
            @if (a.mySubmission?.feedback) {
              <section class="card card-lg">
                <h2 class="card-title mb-2">Comments</h2>
                <div class="comment">
                  <lh-avatar [name]="store.course()?.instructor?.fullName ?? 'Instructor'" size="sm" />
                  <div><div class="small strong">{{ store.course()?.instructor?.fullName }} · {{ a.mySubmission!.gradedAt | date: 'MMM d' }}</div>
                    <p class="bubble pre">{{ a.mySubmission!.feedback }}</p></div>
                </div>
              </section>
            }
          } @else {
            <section class="card card-lg">
              <h2 class="card-title">Grading</h2>
              <dl class="stats mt-3">
                <div><dt class="tiny muted">Handed in</dt><dd class="n serif tabnum">{{ submittedCount() }}<span class="of">/{{ enrolledCount() }}</span></dd></div>
                <div><dt class="tiny muted">Graded</dt><dd class="n serif tabnum">{{ gradedCount() }}</dd></div>
                <div><dt class="tiny muted">Average</dt><dd class="n serif tabnum">{{ avg() === null ? '–' : fmt(avg()!) }}</dd></div>
              </dl>
              @if (firstToGrade(); as id) {
                <a class="btn btn-ink btn-block mt-3" [routerLink]="['/grade', id]"><lh-icon name="pencil" class="sm" /> {{ gradedCount() < submittedCount() ? 'Start grading' : 'Review grades' }}</a>
              }
            </section>
          }
        </aside>
      </div>
    } @else {
      <div class="skeleton" style="height: 320px"></div>
    }`,
  styles: [`
    .back { display: inline-flex; align-items: center; gap: .35rem; color: var(--muted); }
    .title { font-size: clamp(1.55rem, 3vw, 2.05rem); margin: .9rem 0 .75rem; }
    .facts { display: flex; flex-wrap: wrap; align-items: center; gap: .6rem 1.2rem; padding-bottom: 1rem; border-bottom: 1px solid var(--line); }
    .fact { display: inline-flex; align-items: center; gap: .4rem; font-size: .92rem; color: var(--ink-2); }
    .instructions { margin-top: 1.1rem; font-size: 1rem; line-height: 1.7; max-width: 70ch; }
    .doc { font-family: var(--serif); font-size: 1.02rem; line-height: 1.75; padding: 1.2rem 1.35rem; border-radius: var(--r-ctl); background: var(--surface-2); border: 1px solid var(--line); }
    .file { display: flex; align-items: center; gap: .7rem; margin-top: .9rem; padding: .65rem .85rem; border-radius: var(--r-ctl); border: 1px solid var(--line);
      background: var(--surface); color: var(--ink); text-decoration: none !important; }
    .file:hover { background: var(--surface-2); }
    .composer { display: flex; flex-direction: column; gap: 1rem; }
    .note { display: flex; align-items: center; gap: .5rem; padding: .6rem .85rem; border-radius: var(--r-ctl); background: var(--warn-soft); color: var(--warn); font-weight: 600; font-size: .9rem; }
    .drop { display: flex; flex-direction: column; align-items: center; gap: .3rem; padding: 1.3rem; border-radius: var(--r-ctl); border: 1.5px dashed var(--line-strong);
      background: var(--surface-2); color: var(--ink-2); cursor: pointer; text-align: center; transition: border-color var(--dur) var(--ease), background var(--dur) var(--ease); }
    .drop:hover, .drop.over { border-color: var(--violet); background: var(--violet-soft); }
    .pad { padding: 1.1rem 1.25rem .3rem; }
    .ml { margin-left: .3rem; }
    .center { display: flex; flex-direction: column; align-items: center; text-align: center; }
    .left { text-align: left; align-self: stretch; }
    .w100 { width: 100%; }
    .comment { display: flex; gap: .7rem; }
    .bubble { margin-top: .35rem; padding: .7rem .85rem; border-radius: 4px var(--r-ctl) var(--r-ctl) var(--r-ctl); background: var(--surface-2); border: 1px solid var(--line); font-size: .95rem; }
    .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: .5rem; margin: 0; }
    .stats dd { margin: .2rem 0 0; }
    .n { font-size: 1.8rem; font-weight: 600; line-height: 1; }
    .of { font-size: 1rem; color: var(--muted); }
  `]
})
export class AssignmentComponent {
  protected store = inject(CourseStore);
  private api = inject(Api);
  private toasts = inject(Toasts);
  private confirm = inject(Confirm);
  private router = inject(Router);
  readonly aid = input.required<string>();

  protected a = signal<AssignmentDetail | null>(null);
  protected composer = signal(false);
  protected file = signal<File | null>(null);
  protected dragging = signal(false);
  protected busy = signal(false);
  protected text = '';
  protected due = dueText;
  protected fmt = score;
  protected letter = letterGrade;

  constructor() { effect(() => this.load(+this.aid())); }

  private load(id: number) {
    this.api.assignment(id).subscribe(a => { this.a.set(a); this.text = a.mySubmission?.textAnswer ?? ''; this.file.set(null); this.composer.set(false); });
  }

  protected overdue = computed(() => !!this.a() && isPast(this.a()!.dueDate));
  protected canSubmit = computed(() => { const a = this.a(); return !!a && !a.canManage && a.mySubmission?.score == null; });
  protected pct = computed(() => { const a = this.a(); return a?.mySubmission?.score != null ? a.mySubmission.score / a.maxPoints * 100 : 0; });
  protected st(s: { score: number | null; isLate: boolean } | null) { return workStatus(this.a()!.dueDate, s); }

  private subs = computed(() => (this.a()?.rows ?? []).filter(r => r.submission).map(r => r.submission!));
  protected submittedCount = computed(() => this.subs().length);
  protected gradedCount = computed(() => this.subs().filter(s => s.score !== null).length);
  protected enrolledCount = computed(() => (this.a()?.rows ?? []).filter(r => r.stillEnrolled).length);
  protected avg = computed(() => { const g = this.subs().filter(s => s.score !== null); return g.length ? g.reduce((t, s) => t + s.score!, 0) / g.length : null; });
  protected firstToGrade = computed(() => (this.subs().find(s => s.score === null) ?? this.subs()[0])?.id ?? null);

  onPick(e: Event) { const f = (e.target as HTMLInputElement).files?.[0]; if (f) this.setFile(f); }
  onDrop(e: DragEvent) { e.preventDefault(); this.dragging.set(false); const f = e.dataTransfer?.files?.[0]; if (f) this.setFile(f); }
  private setFile(f: File) {
    const max = (this.a()?.maxFileSizeMB ?? 10) * 1024 * 1024;
    if (f.size > max) { this.toasts.error(`"${f.name}" is larger than ${this.a()?.maxFileSizeMB} MB.`); return; }
    this.file.set(f);
  }

  submit() {
    this.busy.set(true);
    this.api.submit(this.a()!.id, this.text, this.file()).subscribe({
      next: () => { this.toasts.ok('Submission received — nice work!'); this.busy.set(false); this.load(this.a()!.id); this.store.reload(); },
      error: () => this.busy.set(false)
    });
  }

  async remove() {
    const a = this.a()!;
    if (!await this.confirm.ask('Delete assignment?', `"${a.title}" and all of its submissions and grades will be deleted.`, 'Delete')) return;
    this.api.deleteAssignment(a.id).subscribe(() => { this.toasts.ok('Assignment deleted.'); this.store.reload(); this.router.navigate(['/courses', a.courseId, 'assignments']); });
  }
}
