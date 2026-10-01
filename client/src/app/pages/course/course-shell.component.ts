import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Api } from '../../core/api.service';
import { Auth, Toasts } from '../../core/services';
import { artFor, toneStyle } from '../../core/util';
import { IconComponent } from '../../shared/icon.component';
import { AvatarComponent, CourseArtComponent, EmptyComponent } from '../../shared/ui';
import { CourseStore } from './course.routes';

@Component({
  selector: 'lh-course-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent, AvatarComponent, CourseArtComponent, EmptyComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.notFound()) {
      <div class="card card-lg"><lh-empty icon="explore" title="Course not found" text="It may have been removed or isn't published yet.">
        <a routerLink="/catalog" class="btn btn-ink btn-sm">Back to catalog</a></lh-empty></div>
    } @else if (store.course()) {
      @let c = store.course()!;
      <div class="page" [attr.style]="style()">
        <nav class="crumbs">
          <a [routerLink]="store.canSeeContent() ? '/courses' : '/catalog'">{{ store.canSeeContent() ? 'My courses' : 'Catalog' }}</a><span>/</span><span>{{ c.code }}</span>
        </nav>

        <header class="banner pastel">
          <div class="copy">
            <div class="row wrap">
              <span class="code">{{ c.code }}</span><span class="pill">{{ c.category }}</span><span class="pill">{{ c.credits }} credits</span>
              @if (!c.isPublished) { <span class="pill dark">Unpublished</span> }
            </div>
            <h1>{{ c.title }}</h1>
            <div class="meta">
              <span class="row"><lh-avatar [name]="c.instructor.fullName" size="sm" /> {{ c.instructor.fullName }}</span>
              <span class="row"><lh-icon name="people" class="sm" /> {{ c.studentCount }} students</span>
              <span class="row"><lh-icon name="assignment" class="sm" /> {{ c.assignmentCount }} assignments</span>
            </div>
            <div class="actions">
              @if (c.isEnrolled) {
                <span class="enrolled"><lh-icon name="check-circle" /> You're enrolled</span>
              } @else if (c.isStudent && c.isPublished) {
                <button class="btn btn-ink btn-lg" (click)="enroll()" [disabled]="busy()">Enroll in this course <lh-icon name="arrow-right" class="sm" /></button>
              } @else if (!auth.signedIn()) {
                <a class="btn btn-ink btn-lg" routerLink="/login" [queryParams]="{ returnUrl: '/courses/' + c.id }">Sign in to enroll</a>
              } @else if (c.canManage) {
                <a class="btn btn-ink" [routerLink]="['assignments', 'new']"><lh-icon name="plus" /> New assignment</a>
              }
            </div>
          </div>
          <lh-course-art class="art" [kind]="kind()" />
        </header>

        @if (store.canSeeContent()) {
          <nav class="seg tabs" aria-label="Course">
            <a routerLink="." routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }"><lh-icon name="home" class="sm" /> Home</a>
            <a routerLink="assignments" routerLinkActive="active"><lh-icon name="assignment" class="sm" /> Assignments</a>
            <a routerLink="grades" routerLinkActive="active"><lh-icon name="grades" class="sm" /> {{ c.canManage ? 'Gradebook' : 'Grades' }}</a>
            @if (c.canManage) {
              <a routerLink="people" routerLinkActive="active"><lh-icon name="people" class="sm" /> People</a>
              <a routerLink="settings" routerLinkActive="active"><lh-icon name="settings" class="sm" /> Settings</a>
            }
          </nav>
        }
        <router-outlet />
      </div>
    } @else {
      <div class="skeleton" style="height: 280px"></div>
    }`,
  styles: [`
    /* Flat course pastel: the colour says which course. Text is dark ink in both themes. */
    .banner { position: relative; display: flex; justify-content: space-between; gap: 1rem; min-height: 210px; padding: 1.6rem 1.75rem;
      border-radius: var(--r-card); background: var(--c); color: #17161d; overflow: hidden; }
    .copy { position: relative; z-index: 1; display: flex; flex-direction: column; gap: .75rem; max-width: 640px; min-width: 0; }
    .code { height: 26px; padding: 0 9px; border-radius: 7px; background: #17161d; color: #fff; font-weight: 700; font-size: .8rem; display: inline-flex; align-items: center; }
    .pill { height: 26px; padding: 0 9px; border-radius: 7px; background: rgba(255,255,255,.7); font-weight: 600; font-size: .82rem; display: inline-flex; align-items: center; }
    .pill.dark { background: #17161d; color: #fff; }
    h1 { font-size: clamp(1.7rem, 3.2vw, 2.4rem); color: #17161d; }
    .meta { display: flex; flex-wrap: wrap; gap: .5rem 1.3rem; font-weight: 600; font-size: .92rem; }
    .actions { margin-top: .2rem; }
    .enrolled { display: inline-flex; align-items: center; gap: .45rem; height: 40px; padding: 0 .9rem; border-radius: var(--r-ctl); background: rgba(255,255,255,.72); font-weight: 700; }
    .art { position: relative; z-index: 1; width: 300px; height: 220px; align-self: flex-end; margin: 0 -18px -42px 0; flex-shrink: 0; }
    .tabs { align-self: flex-start; }
    @media (max-width: 860px) {
      .banner { flex-direction: column; padding: 1.25rem; min-height: 0; }
      .art { width: 190px; height: 140px; margin: -24px -16px -36px auto; }
    }
  `]
})
export class CourseShellComponent {
  protected store = inject(CourseStore);
  protected auth = inject(Auth);
  private api = inject(Api);
  private toasts = inject(Toasts);
  readonly id = input.required<string>();
  protected busy = signal(false);

  protected style = computed(() => toneStyle(this.store.course()?.id ?? 1));
  protected kind = computed(() => artFor(this.store.course()?.category ?? ''));

  constructor() { effect(() => this.store.load(+this.id())); }

  enroll() {
    this.busy.set(true);
    this.api.enroll(this.store.course()!.id).subscribe({
      next: () => { this.toasts.ok("You're enrolled — welcome to the course!"); this.store.reload(); this.busy.set(false); },
      error: () => this.busy.set(false)
    });
  }
}
