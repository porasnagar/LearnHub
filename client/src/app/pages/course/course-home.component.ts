import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../../core/api.service';
import { AssignmentRow } from '../../core/models';
import { Confirm, Toasts } from '../../core/services';
import { dueText, isPast, letterGrade, workStatus } from '../../core/util';
import { IconComponent } from '../../shared/icon.component';
import { AvatarComponent, DateTileComponent, EmptyComponent, RingComponent } from '../../shared/ui';
import { CourseStore } from './course.routes';

@Component({
  selector: 'lh-course-home',
  imports: [RouterLink, DatePipe, IconComponent, AvatarComponent, DateTileComponent, EmptyComponent, RingComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.course(); as c) {
      <div class="bento">
        <div class="span-8 stack">
          @if (store.canSeeContent()) {
            <section class="card" aria-labelledby="up-title">
              <div class="card-head">
                <div><h2 id="up-title" class="card-title">Upcoming</h2><p class="card-sub">{{ upcoming().length ? upcoming().length + ' not yet due' : 'Nothing due soon' }}</p></div>
                <a routerLink="assignments" class="btn btn-ghost btn-sm">All assignments</a>
              </div>
              <div class="due-list">
                @for (a of upcoming(); track a.id) {
                  <a class="due-row" [routerLink]="['assignments', a.id]">
                    <lh-date-tile [date]="a.dueDate" />
                    <div class="grow"><div class="title truncate">{{ a.title }}</div><div class="meta">{{ due(a.dueDate) }} · {{ a.maxPoints }} pts</div></div>
                    <div class="end">
                      @if (c.canManage) { <span class="small muted nowrap tabnum">{{ a.submissionCount }}/{{ c.studentCount }} handed in</span> }
                      @else { <span class="status {{ status(a).css }}">{{ status(a).label }}</span> }
                    </div>
                  </a>
                } @empty { <lh-empty icon="calendar" title="Nothing due soon" text="New assignments for this course will appear here." /> }
              </div>
            </section>
          }

          <section class="card card-lg" aria-labelledby="about-title">
            <h2 id="about-title" class="card-title mb-2">About this course</h2>
            <p class="pre desc">{{ c.description }}</p>
          </section>
        </div>

        <aside class="span-4 stack">
          @if (c.isEnrolled) {
            <section class="card card-lg center">
              <div class="card-title">Your progress</div>
              <lh-ring class="mt-2" [percent]="grade() ?? 0" [center]="grade() === null ? '–' : grade()!.toFixed(0) + '%'"
                       [caption]="grade() === null ? 'No grades yet' : 'Grade ' + letter(grade()!)" [size]="160" />
              <div class="w100 mt-3">
                <div class="row between small"><span class="muted">Submitted</span><span class="strong">{{ submitted() }} / {{ rows().length }}</span></div>
                <div class="meter mt-1" [style.--fill]="'var(--c-deep)'"><span [style.width.%]="rows().length ? submitted() * 100 / rows().length : 0"></span></div>
              </div>
              <div class="row mt-3 w100">
                <a routerLink="grades" class="btn btn-ink btn-sm grow">View grades</a>
                <button class="btn btn-ghost btn-sm" (click)="leave()">Leave</button>
              </div>
            </section>
          } @else if (c.canManage) {
            <section class="card card-lg">
              <div class="row between"><h2 class="card-title">Course status</h2><span class="status {{ c.isPublished ? 'published' : 'draft' }}">{{ c.isPublished ? 'Published' : 'Draft' }}</span></div>
              <dl class="stats mt-3">
                <div><dt class="tiny muted">Students</dt><dd class="n serif tabnum">{{ c.studentCount }}</dd></div>
                <div><dt class="tiny muted">Assignments</dt><dd class="n serif tabnum">{{ c.assignmentCount }}</dd></div>
                <div><dt class="tiny muted">To grade</dt><dd class="n serif tabnum" [class.warn]="toGrade() > 0">{{ toGrade() }}</dd></div>
              </dl>
              <div class="row mt-3"><a routerLink="grades" class="btn btn-ink btn-sm grow">Open gradebook</a><a routerLink="settings" class="btn btn-secondary btn-sm">Settings</a></div>
            </section>
          } @else {
            <section class="card card-lg">
              <h2 class="card-title row"><lh-icon name="lock" class="sm" /> {{ c.assignmentCount }} assignments</h2>
              <p class="small muted mt-1">Enroll to see the coursework, hand in your work and get feedback from {{ c.instructor.fullName }}.</p>
            </section>
          }

          <section class="card">
            <div class="card-title mb-2">Instructor</div>
            <div class="row"><lh-avatar [name]="c.instructor.fullName" />
              <div class="grow"><div class="strong">{{ c.instructor.fullName }}</div>
                @if (store.canSeeContent()) { <a class="small" [href]="'mailto:' + c.instructor.email">{{ c.instructor.email }}</a> }</div></div>
          </section>

          <section class="card">
            <div class="card-title mb-2">Details</div>
            <dl class="facts">
              <dt>Code</dt><dd>{{ c.code }}</dd><dt>Subject</dt><dd>{{ c.category }}</dd>
              <dt>Credits</dt><dd>{{ c.credits }}</dd><dt>Created</dt><dd>{{ c.createdAt | date: 'MMM d, y' }}</dd>
            </dl>
          </section>
        </aside>
      </div>
    }`,
  styles: [`
    .desc { font-size: 1rem; line-height: 1.7; color: var(--ink-2); max-width: 68ch; }
    .center { display: flex; flex-direction: column; align-items: center; text-align: center; }
    .w100 { width: 100%; }
    .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: .5rem; margin: 0; }
    .stats dd { margin: .2rem 0 0; }
    .n { font-size: 1.8rem; font-weight: 600; line-height: 1; }
    .n.warn { color: var(--warn); }
    .facts { display: grid; grid-template-columns: auto 1fr; gap: .45rem 1rem; margin: 0; font-size: .92rem; }
    .facts dt { color: var(--muted); font-weight: 600; } .facts dd { margin: 0; font-weight: 600; }
  `]
})
export class CourseHomeComponent {
  protected store = inject(CourseStore);
  private api = inject(Api);
  private confirm = inject(Confirm);
  private toasts = inject(Toasts);
  private router = inject(Router);
  protected rows = signal<AssignmentRow[]>([]);
  protected due = dueText;
  protected letter = letterGrade;

  constructor() {
    effect(() => {
      const c = this.store.course();
      if (c && this.store.canSeeContent()) this.api.courseAssignments(c.id).subscribe(r => this.rows.set(r));
    });
  }

  protected upcoming = computed(() => this.rows().filter(r => !isPast(r.dueDate)).slice(0, 5));
  protected submitted = computed(() => this.rows().filter(r => r.mySubmission).length);
  protected toGrade = computed(() => this.rows().reduce((s, r) => s + r.ungradedCount, 0));
  protected grade = computed(() => {
    const graded = this.rows().filter(r => r.mySubmission?.score != null);
    const possible = graded.reduce((s, r) => s + r.maxPoints, 0);
    return possible ? graded.reduce((s, r) => s + r.mySubmission!.score!, 0) / possible * 100 : null;
  });
  protected status(a: AssignmentRow) { return workStatus(a.dueDate, a.mySubmission); }

  async leave() {
    const c = this.store.course()!;
    if (!await this.confirm.ask(`Leave ${c.code}?`, 'You can enroll again later. Your submissions are kept.', 'Leave course')) return;
    this.api.unenroll(c.id).subscribe(() => { this.toasts.show('You have left the course.', 'info'); this.store.reload(); this.rows.set([]); });
  }
}
