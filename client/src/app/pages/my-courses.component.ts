import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api.service';
import { Auth } from '../core/services';
import { IconComponent } from '../shared/icon.component';
import { GlideDirective } from '../shared/motion';
import { CourseCardComponent, EmptyComponent } from '../shared/ui';

type Filter = 'all' | 'active' | 'done' | 'published' | 'draft';

@Component({
  selector: 'lh-my-courses',
  imports: [GlideDirective, RouterLink, IconComponent, CourseCardComponent, EmptyComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head fade-in">
        <div>
          <h1 class="page-title">{{ auth.isAdmin() ? 'All courses' : 'My courses' }}</h1>
          <p class="page-sub">{{ auth.isStudent() ? 'Courses you are enrolled in.' : auth.isAdmin() ? 'Every course on the platform.' : 'Courses you teach, including drafts.' }}</p>
        </div>
        @if (auth.isStudent()) {
          <a routerLink="/catalog" class="btn btn-glass"><lh-icon name="explore" /> Browse catalog</a>
        } @else {
          <a routerLink="/courses/new" class="btn btn-ink"><lh-icon name="plus" /> New course</a>
        }
      </div>

      <div class="seg" lhGlide role="tablist">
        @for (f of filters(); track f.key) {
          <button [class.active]="filter() === f.key" (click)="filter.set(f.key)" role="tab" [attr.aria-selected]="filter() === f.key">
            {{ f.label }} <span class="faint">{{ count(f.key) }}</span>
          </button>
        }
      </div>

      @if (!courses()) {
        <div class="cards-grid">@for (i of [1,2,3]; track i) { <div class="skeleton" style="height:300px"></div> }</div>
      } @else if (shown().length) {
        <div class="cards-grid stagger">@for (c of shown(); track c.id) { <lh-course-card [c]="c" [mine]="true" /> }</div>
      } @else {
        <div class="card"><lh-empty icon="courses" [title]="courses()!.length ? 'Nothing in this view' : 'No courses yet'"
          [text]="auth.isStudent() ? 'Find a course in the catalog and enroll.' : 'Create your first course to get started.'">
          <a class="btn btn-ink btn-sm" [routerLink]="auth.isStudent() ? '/catalog' : '/courses/new'">{{ auth.isStudent() ? 'Browse catalog' : 'Create a course' }}</a>
        </lh-empty></div>
      }
    </div>`
})
export class MyCoursesComponent {
  private api = inject(Api);
  protected auth = inject(Auth);
  protected courses = toSignal(this.api.myCourses());
  protected filter = signal<Filter>('all');

  protected filters = computed<{ key: Filter; label: string }[]>(() => this.auth.isStudent()
    ? [{ key: 'all', label: 'All' }, { key: 'active', label: 'In progress' }, { key: 'done', label: 'All work in' }]
    : [{ key: 'all', label: 'All' }, { key: 'published', label: 'Published' }, { key: 'draft', label: 'Drafts' }]);

  private match(key: Filter) {
    return (c: { mySubmitted: number; assignmentCount: number; isPublished: boolean }) =>
      key === 'active' ? c.mySubmitted < c.assignmentCount
        : key === 'done' ? c.assignmentCount > 0 && c.mySubmitted >= c.assignmentCount
        : key === 'published' ? c.isPublished
        : key === 'draft' ? !c.isPublished : true;
  }
  protected count(key: Filter) { return (this.courses() ?? []).filter(this.match(key)).length; }
  protected shown = computed(() => (this.courses() ?? []).filter(this.match(this.filter())));
}
