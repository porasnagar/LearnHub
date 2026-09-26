import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../../core/api.service';
import { AssignmentRow } from '../../core/models';
import { dueText, isPast, score, workStatus } from '../../core/util';
import { IconComponent } from '../../shared/icon.component';
import { DateTileComponent, EmptyComponent } from '../../shared/ui';
import { CourseStore } from './course.routes';

@Component({
  selector: 'lh-course-assignments',
  imports: [RouterLink, DatePipe, IconComponent, DateTileComponent, EmptyComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row between wrap">
      <div class="seg">
        @for (t of tabs; track t.key) { <button [class.active]="tab() === t.key" (click)="tab.set(t.key)">{{ t.label }} <span class="faint">{{ count(t.key) }}</span></button> }
      </div>
      @if (store.course()?.canManage) { <a routerLink="new" class="btn btn-ink btn-sm"><lh-icon name="plus" class="sm" /> Assignment</a> }
    </div>

    @if (!loaded()) {
      <div class="stack">@for (i of [1,2,3]; track i) { <div class="skeleton" style="height:84px"></div> }</div>
    } @else {
      <div class="list stagger">
        @for (a of shown(); track a.id) {
          <a class="card item link-card" [routerLink]="[a.id]">
            <lh-date-tile [date]="a.dueDate" />
            <div class="grow">
              <div class="strong title">{{ a.title }}</div>
              <div class="small muted">Due {{ a.dueDate | date: 'EEE, MMM d · h:mm a' }} · {{ a.maxPoints }} pts · {{ due(a.dueDate) }}</div>
            </div>
            <div class="side">
              @if (store.course()?.canManage) {
                <div class="mini-meter"><div class="meter" [style.--fill]="'var(--c-deep)'"><span [style.width.%]="pct(a)"></span></div>
                  <span class="tiny muted">{{ a.submissionCount }}/{{ store.course()!.studentCount }} submitted</span></div>
                @if (a.ungradedCount) { <span class="status pending">{{ a.ungradedCount }} to grade</span> }
              } @else {
                @if (a.mySubmission?.score != null) { <span class="score serif">{{ fmt(a.mySubmission!.score!) }}<small>/{{ a.maxPoints }}</small></span> }
                <span class="status {{ st(a).css }}">{{ st(a).label }}</span>
              }
              <lh-icon name="chevron-right" class="sm muted" />
            </div>
          </a>
        } @empty {
          <div class="card"><lh-empty icon="assignment" [title]="tab() === 'upcoming' ? 'Nothing upcoming' : 'No assignments here'" /></div>
        }
      </div>
    }`,
  styles: [`
    :host { display: flex; flex-direction: column; gap: 1rem; }
    .list { display: flex; flex-direction: column; gap: .75rem; }
    .item { display: flex; align-items: center; gap: 1rem; padding: 1rem 1.1rem; color: inherit; text-decoration: none !important; }
    .title { font-size: 1.02rem; }
    .side { display: flex; align-items: center; gap: .8rem; flex-shrink: 0; }
    .mini-meter { width: 150px; display: flex; flex-direction: column; gap: 4px; }
    .score { font-size: 1.25rem; font-weight: 700; } .score small { font-size: .8rem; color: var(--muted); }
    @media (max-width: 640px) { .item { flex-wrap: wrap; } .side { width: 100%; justify-content: flex-end; } }
  `]
})
export class CourseAssignmentsComponent {
  protected store = inject(CourseStore);
  private api = inject(Api);
  protected rows = signal<AssignmentRow[]>([]);
  protected loaded = signal(false);
  protected tab = signal<'upcoming' | 'past' | 'all'>('upcoming');
  protected tabs = [{ key: 'upcoming' as const, label: 'Upcoming' }, { key: 'past' as const, label: 'Past' }, { key: 'all' as const, label: 'All' }];
  protected due = dueText;
  protected fmt = score;

  constructor() {
    effect(() => {
      const c = this.store.course();
      if (c) this.api.courseAssignments(c.id).subscribe(r => { this.rows.set(r); this.loaded.set(true); });
    });
  }

  private filterFor(key: string) {
    return (a: AssignmentRow) => key === 'all' ? true : key === 'past' ? isPast(a.dueDate) : !isPast(a.dueDate);
  }
  protected count(key: string) { return this.rows().filter(this.filterFor(key)).length; }
  protected shown = computed(() => {
    const list = this.rows().filter(this.filterFor(this.tab()));
    return this.tab() === 'past' ? [...list].reverse() : list;
  });
  protected st(a: AssignmentRow) { return workStatus(a.dueDate, a.mySubmission); }
  protected pct(a: AssignmentRow) { const n = this.store.course()?.studentCount ?? 0; return n ? a.submissionCount * 100 / n : 0; }
}
