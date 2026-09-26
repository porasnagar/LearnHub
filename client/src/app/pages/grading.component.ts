import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
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
        <header class="bar card fade-in">
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
            <span class="small muted nowrap">{{ position() }} of {{ g.queue.length }}</span>
          </div>
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
              <a class="file glass" [href]="'/api/assignments/download/' + g.submission.id" download>
                <span class="fi"><lh-icon name="file" /></span><span class="grow truncate strong">{{ g.submission.originalFileName }}</span>
                <span class="btn btn-ink btn-sm"><lh-icon name="download" class="sm" /> Download</span>
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
              <div class="letter-badge serif" [class.pop]="letter() !== '–'">{{ letter() }}</div>
            </div>
            <input type="range" class="range" name="slider" [ngModel]="scoreValue()" (ngModelChange)="scoreValue.set(+$event)" min="0" [max]="g.maxPoints" step="0.5" aria-label="Score slider" />
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
    .bar { display: flex; flex-wrap: wrap; align-items: center; gap: 1rem; }
    .h { font-size: 1.5rem; }
    .switch-row { display: flex; align-items: center; gap: .5rem; }
    .picker { min-width: 240px; }
    .disabled { opacity: .4; pointer-events: none; }
    .layout { display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 1.25rem; align-items: start; }
    .viewer { display: flex; flex-direction: column; gap: 1.2rem; min-height: 460px; }
    .paper { font-family: var(--serif); font-size: 1.06rem; line-height: 1.85; padding: 2.4rem 2.6rem; border-radius: 20px; background: var(--glass-strong); box-shadow: inset 0 0 0 1px var(--line); min-height: 280px; }
    .paper.empty { color: var(--muted); font-style: italic; font-family: var(--sans); }
    .file { display: flex; align-items: center; gap: .8rem; padding: .7rem .8rem; border-radius: 18px; color: var(--ink); text-decoration: none !important; }
    .fi { width: 40px; height: 40px; border-radius: 12px; background: var(--violet-soft); color: var(--violet); display: grid; place-items: center; }
    .assess { position: sticky; top: 90px; display: flex; flex-direction: column; gap: 1rem; }
    .score-row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
    .score-box { display: flex; align-items: baseline; gap: .4rem; }
    .score-input { width: 120px; border: 0; background: transparent; font-size: 3.2rem; font-weight: 600; color: var(--ink); outline: 0; padding: 0; }
    .of { font-size: 1.2rem; color: var(--muted); font-weight: 600; }
    .letter-badge { width: 72px; height: 72px; border-radius: 22px; display: grid; place-items: center; font-size: 1.8rem; font-weight: 700; background: var(--lemon); color: #16151c; transition: transform .3s var(--ease); }
    .letter-badge.pop { animation: pop .4s var(--ease); }
    @keyframes pop { 50% { transform: scale(1.1) rotate(-4deg); } }
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
