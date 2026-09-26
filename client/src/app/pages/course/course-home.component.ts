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
      <div class="bento stagger">
        <div class="span-8 stack">
          <section class="card card-lg">
            <div class="card-head"><div class="card-title">About this course</div></div>
            <p class="pre desc">{{ c.description }}</p>
          </section>

          @if (store.canSeeContent()) {
            <section class="card card-lg">
              <div class="card-head">
                <div><div class="card-title">Upcoming</div><div class="card-sub">{{ upcoming().length }} due soon</div></div>
                <a routerLink="assignments" class="btn btn-glass btn-sm">All assignments</a>
              </div>
              @for (a of upcoming(); track a.id) {
                <a class="row-link" [routerLink]="['assignments', a.id]">
                  <lh-date-tile [date]="a.dueDate" />
                  <div class="grow"><div class="strong">{{ a.title }}</div><div class="tiny muted">{{ due(a.dueDate) }} · {{ a.maxPoints }} pts</div></div>
                  @if (c.canManage) { <span class="small muted nowrap">{{ a.submissionCount }}/{{ c.studentCount }} in</span> }
                  @else { <span class="status {{ status(a).css }}">{{ status(a).label }}</span> }
                </a>
              } @empty { <lh-empty icon="calendar" title="Nothing due soon" /> }
            </section>
          }
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
            <section class="card card-lg tone" style="--tone: var(--lemon)">
              <div class="row between"><div class="card-title">Course status</div><span class="status {{ c.isPublished ? 'published' : 'draft' }}">{{ c.isPublished ? 'Published' : 'Draft' }}</span></div>
              <div class="stats mt-3">
                <div><div class="n serif">{{ c.studentCount }}</div><div class="tiny">Students</div></div>
                <div><div class="n serif">{{ c.assignmentCount }}</div><div class="tiny">Assignments</div></div>
                <div><div class="n serif">{{ toGrade() }}</div><div class="tiny">To grade</div></div>
              </div>
              <div class="row mt-3"><a routerLink="grades" class="btn btn-ink btn-sm grow">Open gradebook</a><a routerLink="settings" class="btn btn-glass btn-sm">Edit</a></div>
            </section>
          } @else {
            <section class="card card-lg tone" style="--tone: var(--lilac)">
              <div class="lock"><lh-icon name="lock" class="lg" /></div>
              <div class="card-title mt-2">{{ c.assignmentCount }} assignments inside</div>
              <p class="small mt-1">Enroll to see the coursework, hand in your work and get feedback from {{ c.instructor.fullName }}.</p>
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
    .desc { font-size: 1.02rem; line-height: 1.75; color: var(--ink-2); }
    .row-link { display: flex; align-items: center; gap: .9rem; padding: .7rem .5rem; border-radius: 16px; color: inherit; text-decoration: none !important; transition: background .2s; }
    .row-link:hover { background: var(--glass-strong); }
    .center { display: flex; flex-direction: column; align-items: center; text-align: center; }
    .w100 { width: 100%; }
    .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: .5rem; }
    .n { font-size: 1.9rem; font-weight: 600; line-height: 1; }
    .lock { width: 52px; height: 52px; border-radius: 16px; background: #16151c; color: #e9e58e; display: grid; place-items: center; }
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
