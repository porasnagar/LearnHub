import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api.service';
import { AssignmentMini } from '../core/models';
import { Auth } from '../core/services';
import { isoDate, toneStyle } from '../core/util';
import { IconComponent } from '../shared/icon.component';
import { EmptyComponent } from '../shared/ui';

@Component({
  selector: 'lh-calendar',
  imports: [DatePipe, RouterLink, IconComponent, EmptyComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head fade-in">
        <div><h1 class="page-title">Calendar</h1><p class="page-sub">Due dates from {{ auth.isStudent() ? 'your enrolled courses' : auth.isAdmin() ? 'every course' : 'the courses you teach' }}.</p></div>
        <div class="row">
          <button class="btn btn-glass btn-icon" (click)="shift(-1)" aria-label="Previous month"><lh-icon name="chevron-left" /></button>
          <button class="btn btn-glass" (click)="month.set(startOfMonth(today))">Today</button>
          <button class="btn btn-glass btn-icon" (click)="shift(1)" aria-label="Next month"><lh-icon name="chevron-right" /></button>
        </div>
      </div>

      <div class="layout">
        <section class="card card-lg cal-card">
          <div class="row between mb-3"><h2 class="serif month">{{ month() | date: 'MMMM y' }}</h2>
            <span class="small muted strong">{{ monthItems().length }} due this month</span></div>

          <div class="grid-wrap"><div class="grid" role="grid">
            @for (d of dow; track d) { <div class="dow">{{ d }}</div> }
            @for (cell of cells(); track cell.key) {
              <div class="day" [class.other]="!cell.inMonth" [class.today]="cell.key === todayKey" [class.sel]="cell.key === selected()" (click)="selected.set(cell.key)">
                <span class="num">{{ cell.date.getDate() }}</span>
                @for (a of cell.items.slice(0, 3); track a.id) {
                  <a class="ev" [class.done]="a.submitted" [attr.style]="tone(a.courseId)" [routerLink]="['/courses', a.courseId, 'assignments', a.id]" [title]="a.courseCode + ': ' + a.title">
                    {{ a.title }}
                  </a>
                }
                @if (cell.items.length > 3) { <span class="more">+{{ cell.items.length - 3 }} more</span> }
              </div>
            }
          </div></div>
        </section>

        <aside class="stack">
          <section class="card card-lg">
            <div class="card-title">{{ selectedDate() | date: 'EEEE, MMM d' }}</div>
            <div class="list mt-2">
              @for (a of dayItems(); track a.id) {
                <a class="agenda" [attr.style]="tone(a.courseId)" [routerLink]="['/courses', a.courseId, 'assignments', a.id]">
                  <span class="accent"></span>
                  <div class="grow"><div class="strong">{{ a.title }}</div><div class="tiny muted">{{ a.courseCode }} · {{ a.dueDate | date: 'h:mm a' }} · {{ a.maxPoints }} pts</div></div>
                  @if (a.submitted) { <span class="status submitted">Done</span> }
                </a>
              } @empty { <lh-empty icon="calendar" title="Nothing due" text="Pick another day on the calendar." /> }
            </div>
          </section>
          <section class="card">
            <div class="card-title mb-2">Courses</div>
            @for (c of data.value()?.courses ?? []; track c.id) {
              <a class="legend" [routerLink]="['/courses', c.id]" [attr.style]="tone(c.id)"><span class="sw"></span><span class="strong">{{ c.code }}</span><span class="small muted truncate">{{ c.title }}</span></a>
            }
          </section>
        </aside>
      </div>
    </div>`,
  styles: [`
    .layout { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 1.25rem; align-items: start; }
    .month { font-size: 1.6rem; }
    .grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; }
    .dow { font-size: .72rem; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); text-align: center; padding-bottom: .3rem; }
    .day { min-height: 108px; padding: 6px; border-radius: 16px; background: var(--glass-strong); border: 1px solid transparent; cursor: pointer;
      display: flex; flex-direction: column; gap: 3px; transition: border-color .2s, transform .2s var(--ease); min-width: 0; }
    .day:hover { transform: translateY(-2px); border-color: var(--line); }
    .day.other { background: transparent; opacity: .55; }
    .day.sel { border-color: var(--violet); }
    .num { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; font-size: .8rem; font-weight: 800; }
    .day.today .num { background: var(--violet); color: #fff; }
    .ev { display: block; padding: 3px 8px; border-radius: 8px; background: var(--c); color: #16151c; font-size: .72rem; font-weight: 700;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-decoration: none !important; }
    .ev.done { opacity: .55; text-decoration: line-through !important; }
    .more { font-size: .7rem; color: var(--muted); font-weight: 700; padding-left: 4px; }
    .list { display: flex; flex-direction: column; gap: .3rem; }
    .agenda { display: flex; align-items: center; gap: .8rem; padding: .7rem .5rem; border-radius: 16px; color: inherit; text-decoration: none !important; }
    .agenda:hover { background: var(--glass-strong); }
    .accent { width: 6px; align-self: stretch; border-radius: 4px; background: var(--c-deep); }
    .legend { display: flex; align-items: center; gap: .6rem; padding: .45rem .3rem; color: inherit; text-decoration: none !important; min-width: 0; }
    .sw { width: 14px; height: 14px; border-radius: 5px; background: var(--c); flex-shrink: 0; }
    @media (max-width: 1100px) { .layout { grid-template-columns: 1fr; } }
    .cal-card { min-width: 0; overflow: hidden; }
    @media (max-width: 640px) {
      /* Seven columns must fit viewport: slim card padding, gaps and cells. */
      .cal-card { padding: .85rem .4rem; border-radius: var(--r-lg); }
      .cal-card > .row { flex-wrap: nowrap; gap: .15rem; padding: 0 .2rem; overflow: hidden; }
      .month { font-size: 1.05rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
      .cal-card > .row > span { display: none; } /* hide the "N due" count so the row doesn't wrap */
      /* grid-wrap fills card width; inner grid sets a safe minimum */
      .grid-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; padding-bottom: 2px; width: 100%; }
      .grid { gap: 2px; min-width: 266px; /* 7 × 38px */ width: 100%; }
      .dow { font-size: .58rem; letter-spacing: 0; }
      .day { min-height: 40px; min-width: 0; width: 100%; padding: 3px 1px; border-radius: 8px; align-items: center; gap: 2px; }
      .num { width: 20px; height: 20px; font-size: .68rem; }
      .ev { width: 5px; height: 5px; padding: 0; border-radius: 50%; font-size: 0; background: var(--c-deep); }
      .more { display: none; }
    }
    /* Phones wider than 380 but still tight — restore the count label */
    @media (min-width: 420px) and (max-width: 640px) {
      .cal-card { padding: 1rem .5rem; }
      .cal-card > .row > span { display: inline; }
      .month { font-size: 1.15rem; }
      .grid { min-width: 280px; }
      .day { min-height: 44px; }
      .num { width: 22px; height: 22px; font-size: .72rem; }
    }
  `]
})
export class CalendarComponent {
  private api = inject(Api);
  protected auth = inject(Auth);
  protected today = new Date();
  protected todayKey = isoDate(this.today);
  protected dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  protected month = signal(this.startOfMonth(this.today));
  protected selected = signal(this.todayKey);
  protected tone = toneStyle;

  startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
  shift(n: number) { const m = this.month(); this.month.set(new Date(m.getFullYear(), m.getMonth() + n, 1)); }

  private range = computed(() => {
    const first = this.month();
    const start = new Date(first); start.setDate(1 - first.getDay());
    const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const weeks = Math.ceil((first.getDay() + days) / 7);
    const end = new Date(start); end.setDate(start.getDate() + weeks * 7);
    return { start, end, weeks };
  });

  protected data = rxResource({
    request: () => this.range(),
    loader: ({ request }) => this.api.calendar(isoDate(request.start), isoDate(request.end))
  });

  private byDay = computed(() => {
    const map = new Map<string, AssignmentMini[]>();
    for (const a of this.data.value()?.items ?? []) {
      const k = isoDate(new Date(a.dueDate));
      map.set(k, [...(map.get(k) ?? []), a]);
    }
    return map;
  });

  protected cells = computed(() => {
    const { start, weeks } = this.range();
    const m = this.month().getMonth();
    return Array.from({ length: weeks * 7 }, (_, i) => {
      const date = new Date(start); date.setDate(start.getDate() + i);
      const key = isoDate(date);
      return { key, date, inMonth: date.getMonth() === m, items: this.byDay().get(key) ?? [] };
    });
  });

  protected monthItems = computed(() => (this.data.value()?.items ?? []).filter(a => new Date(a.dueDate).getMonth() === this.month().getMonth()));
  protected selectedDate = computed(() => new Date(this.selected() + 'T00:00:00'));
  protected dayItems = computed(() => this.byDay().get(this.selected()) ?? []);
}
