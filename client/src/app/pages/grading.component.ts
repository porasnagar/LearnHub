import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../core/api.service';
import { Grading } from '../core/models';
import { Toasts } from '../core/services';
import { letterGrade } from '../core/util';
import { IconComponent } from '../shared/icon.component';
import { AvatarComponent } from '../shared/ui';

/** SpeedGrader-style screen: submission as a document, student switcher, score + comment. */
@Component({
  selector: 'lh-grading',
  imports: [DatePipe, FormsModule, RouterLink, IconComponent, AvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (g(); as g) {
      <div class="page">
        <header class="bar card">
          <div class="grow">
            <nav class="crumbs"><a [routerLink]="['/courses', g.courseId]">{{ g.courseCode }}</a><span>/</span>
              <a [routerLink]="['/courses', g.courseId, 'assignments', g.assignmentId]">{{ g.assignmentTitle }}</a><span>/</span><span>Grading</span></nav>
            <h1 class="h">{{ g.assignmentTitle }}</h1>
          </div>
          <div class="switch-row">
            <a class="btn btn-glass btn-icon" [class.disabled]="!prev()" [routerLink]="prev() ? ['/grade', prev()] : null" aria-label="Previous student"><lh-icon name="chevron-left" /></a>
            <select class="select sm picker" [ngModel]="g.submission.id" (ngModelChange)="go($event)" aria-label="Choose student">
              @for (q of g.queue; track q.submissionId) { <option [ngValue]="q.submissionId">{{ q.studentName }} {{ q.isGraded ? '✓' : '• needs grading' }}</option> }
            </select>
            <a class="btn btn-glass btn-icon" [class.disabled]="!next()" [routerLink]="next() ? ['/grade', next()] : null" aria-label="Next student"><lh-icon name="chevron-right" /></a>
            <span class="small muted nowrap tabnum">{{ position() }} of {{ g.queue.length }}</span>
          </div>
          <p class="keys tiny muted">Keyboard: <kbd>K</kbd> previous · <kbd>J</kbd> next · <kbd>Ctrl</kbd>+<kbd>Enter</kbd> save &amp; next</p>
        </header>

        <div class="layout">
          <section class="viewer card card-lg">
            <div class="row between wrap">
              <div class="row"><lh-avatar [name]="g.submission.student.fullName" />
                <div><div class="strong">{{ g.submission.student.fullName }}</div><div class="tiny muted">Submitted {{ g.submission.submittedAt | date: 'EEE, MMM d · h:mm a' }}</div></div></div>
              <span class="status {{ g.submission.isLate ? 'late' : 'ok' }}">{{ g.submission.isLate ? 'Late' : 'On time' }}</span>
            </div>
            <article class="paper pre" [class.empty]="!g.submission.textAnswer">{{ g.submission.textAnswer || 'No text entry — see the attached file.' }}</article>
            @if (g.submission.originalFileName) {
              <a class="file" [href]="'/api/assignments/download/' + g.submission.id" download>
                <lh-icon name="file" /><span class="grow truncate strong">{{ g.submission.originalFileName }}</span>
                <span class="btn btn-secondary btn-sm"><lh-icon name="download" class="sm" /> Download</span>
              </a>
            }
          </section>

          <form class="card card-lg assess" (ngSubmit)="save(false)" #f="ngForm">
            <div class="row between"><div class="card-title">Assessment</div>
              <span class="status {{ g.submission.score === null ? 'pending' : 'graded' }}">{{ g.submission.score === null ? 'Needs grading' : 'Graded' }}</span></div>
            <div class="score-row">
              <div class="score-box">
                <input class="score-input serif" type="number" name="score" [ngModel]="scoreValue()" (ngModelChange)="scoreValue.set($event)" required min="0" [max]="g.maxPoints" step="0.5" aria-label="Score" />
                <span class="of">/ {{ g.maxPoints }}</span>
              </div>
              <div class="letter-badge serif" aria-live="polite" [attr.aria-label]="'Letter grade ' + letter()">{{ letter() }}</div>
            </div>
            <input type="range" class="range" name="slider" [ngModel]="scoreValue() ?? 0" (ngModelChange)="scoreValue.set(+$event)" min="0" [max]="g.maxPoints" step="0.5" aria-label="Score slider" />
            <div class="quick">@for (p of [100, 90, 80, 70]; track p) { <button type="button" class="chip" (click)="scoreValue.set(g.maxPoints * p / 100)">{{ p }}%</button> }</div>
            <div class="field"><label for="fb">Comment for the student</label>
              <textarea id="fb" class="textarea" rows="7" name="feedback" [(ngModel)]="feedback" maxlength="2000" placeholder="What went well, and what to improve next time"></textarea></div>
            <div class="row">
              <button class="btn btn-glass grow" type="submit" [disabled]="f.invalid || busy()">Save</button>
              <button class="btn btn-ink grow" type="button" (click)="save(true)" [disabled]="f.invalid || busy()">Save & next <lh-icon name="arrow-right" class="sm" /></button>
            </div>
          </form>
        </div>
      </div>
    } @else {
      <div class="skeleton" style="height: 420px"></div>
    }`,
  styles: [`
    .bar { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem 1rem; }
    .h { font-size: 1.4rem; }
    .switch-row { display: flex; align-items: center; gap: .5rem; }
    .picker { min-width: 240px; }
    .keys { width: 100%; margin-top: -.2rem; }
    kbd { font-family: var(--sans); font-size: .76rem; font-weight: 700; padding: 1px 6px; border-radius: 5px; border: 1px solid var(--line-strong); background: var(--surface-2); color: var(--ink-2); }
    .disabled { opacity: .4; pointer-events: none; }
    .layout { display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 1rem; align-items: start; }
    .viewer { display: flex; flex-direction: column; gap: 1rem; min-height: 460px; background: var(--surface-2); }
    /* The submission reads like a page of paper. */
    .paper { font-family: var(--serif); font-size: 1.06rem; line-height: 1.8; padding: 2.2rem 2.4rem; border-radius: var(--r-ctl);
      background: var(--surface); border: 1px solid var(--line); min-height: 280px; max-width: 72ch; }
    .paper.empty { color: var(--muted); font-style: italic; font-family: var(--sans); }
    .file { display: flex; align-items: center; gap: .7rem; padding: .55rem .6rem .55rem .85rem; border-radius: var(--r-ctl); border: 1px solid var(--line);
      background: var(--surface); color: var(--ink); text-decoration: none !important; }
    .assess { position: sticky; top: 84px; display: flex; flex-direction: column; gap: 1rem; }
    .score-row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
    .score-box { display: flex; align-items: baseline; gap: .4rem; border-bottom: 2px solid var(--line-strong); }
    .score-box:focus-within { border-color: var(--violet); }
    .score-input { width: 120px; border: 0; background: transparent; font-size: 3rem; font-weight: 600; color: var(--ink); outline: 0; padding: 0; font-variant-numeric: tabular-nums; }
    .of { font-size: 1.2rem; color: var(--muted); font-weight: 600; }
    .letter-badge { width: 64px; height: 64px; border-radius: var(--r-ctl); display: grid; place-items: center; font-size: 1.7rem; font-weight: 700;
      background: var(--surface-2); border: 1px solid var(--line); color: var(--ink); }
    .range { width: 100%; accent-color: var(--violet); }
    .quick { display: flex; gap: .4rem; flex-wrap: wrap; }
    @media (max-width: 1100px) { .layout { grid-template-columns: 1fr; } .assess { position: static; } .paper { padding: 1.4rem; } }
    @media (max-width: 560px) { .picker { min-width: 0; flex: 1; } .switch-row { width: 100%; } }
  `]
})
export class GradingComponent {
  private api = inject(Api);
  private router = inject(Router);
  private toasts = inject(Toasts);
  readonly submissionId = input.required<string>();
  protected g = signal<Grading | null>(null);
  protected busy = signal(false);
  protected scoreValue = signal<number | null>(null);
  protected feedback = '';

  constructor() {
    effect(() => this.api.grading(+this.submissionId()).subscribe(g => {
      this.g.set(g); this.scoreValue.set(g.submission.score); this.feedback = g.submission.feedback ?? ''; this.busy.set(false);
    }));
  }

  private index = computed(() => { const g = this.g(); return g ? g.queue.findIndex(q => q.submissionId === g.submission.id) : -1; });
  protected position = computed(() => this.index() + 1);
  protected prev = computed(() => { const g = this.g(), i = this.index(); return g && i > 0 ? g.queue[i - 1].submissionId : null; });
  protected next = computed(() => { const g = this.g(), i = this.index(); return g && i >= 0 && i < g.queue.length - 1 ? g.queue[i + 1].submissionId : null; });
  protected letter = computed(() => {
    const g = this.g();
    const s = this.scoreValue();
    return g && s !== null && `${s}` !== '' && s >= 0 && s <= g.maxPoints ? letterGrade(s / g.maxPoints * 100) : '–';
  });

  go(id: number) { this.router.navigate(['/grade', id]); }

  /** Grading-session shortcuts: J/K move between students (outside text fields); Ctrl/Cmd+Enter saves and moves on. */
  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    const g = this.g();
    if (!g || this.busy()) return;
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      const s = this.scoreValue();
      if (s !== null && `${s}` !== '' && s >= 0 && s <= g.maxPoints) { e.preventDefault(); this.save(true); }
      return;
    }
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'j' && this.next()) { e.preventDefault(); this.go(this.next()!); }
    if (e.key === 'k' && this.prev()) { e.preventDefault(); this.go(this.prev()!); }
  }

  save(andNext: boolean) {
    const g = this.g()!;
    this.busy.set(true);
    this.api.grade(g.submission.id, Number(this.scoreValue()), this.feedback).subscribe({
      next: r => {
        if (andNext && r.nextSubmissionId) { this.toasts.ok('Grade saved — here is the next one.'); this.router.navigate(['/grade', r.nextSubmissionId]); }
        else {
          this.toasts.ok(andNext ? 'Grade saved. Every submission is graded!' : 'Grade saved.');
          if (andNext) this.router.navigate(['/courses', g.courseId, 'assignments', g.assignmentId]);
          else this.api.grading(g.submission.id).subscribe(x => { this.g.set(x); this.busy.set(false); });
        }
      },
      error: () => this.busy.set(false)
    });
  }
}
