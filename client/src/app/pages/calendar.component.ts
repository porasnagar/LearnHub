import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api.service';
import { AssignmentMini } from '../core/models';
import { Auth } from '../core/services';
import { isoDate, isPast, toneStyle } from '../core/util';
import { IconComponent } from '../shared/icon.component';
import { EmptyComponent } from '../shared/ui';
import { GlideDirective } from '../shared/motion';

type View = 'month' | 'list';

@Component({
  selector: 'lh-calendar',
  imports: [DatePipe, RouterLink, IconComponent, EmptyComponent, GlideDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div class="head-text">
          <h1 class="page-title">Calendar</h1>
          <p class="page-sub">Due dates from {{ auth.isStudent() ? 'your enrolled courses' : auth.isAdmin() ? 'every course' : 'the courses you teach' }}.</p>
        </div>
        <div class="row wrap head-actions">
          <div class="seg" lhGlide role="tablist" aria-label="Calendar view">
            <button role="tab" [class.active]="view() === 'month'" [attr.aria-selected]="view() === 'month'" (click)="setView('month')"><lh-icon name="grid" class="sm" /> Month</button>
            <button role="tab" [class.active]="view() === 'list'" [attr.aria-selected]="view() === 'list'" (click)="setView('list')"><lh-icon name="list" class="sm" /> List</button>
          </div>
          <a class="btn btn-glass" href="/api/calendar/export.ics" download title="Download an .ics file for Google Calendar, Apple Calendar or Outlook">
            <lh-icon name="download" class="sm" /> <span class="lbl-full">Add to my calendar</span><span class="lbl-short">Export</span>
          </a>
        </div>
      </div>

      <div class="layout">
        <section class="card card-lg cal-card">
          <div class="cal-head">
            <h2 class="serif month">{{ month() | date: 'MMMM y' }}</h2>
            <span class="small muted strong due-count">{{ monthItems().length }} due</span>
            <div class="row nav">
              <button class="btn btn-ghost btn-icon btn-sm" (click)="shift(-1)" aria-label="Previous month"><lh-icon name="chevron-left" /></button>
              <button class="btn btn-glass btn-sm" (click)="goToday()">Today</button>
              <button class="btn btn-ghost btn-icon btn-sm" (click)="shift(1)" aria-label="Next month"><lh-icon name="chevron-right" /></button>
            </div>
          </div>

          <!-- Re-created per month so the new month slides in from the side it came from. -->
          @for (m of [monthKey()]; track m) {
            @if (view() === 'month') {
              <div class="grid" role="grid" [class.from-right]="dir() > 0" [class.from-left]="dir() < 0" [attr.aria-label]="month() | date: 'MMMM y'">
                @for (d of dow; track d) { <div class="dow" role="columnheader"><span class="full">{{ d }}</span><span class="short">{{ d[0] }}</span></div> }
                @for (cell of cells(); track cell.key) {
                  <div class="day" role="gridcell" tabindex="0" [class.other]="!cell.inMonth" [class.today]="cell.key === todayKey"
                       [class.sel]="cell.key === selected()" [class.has]="cell.items.length > 0"
                       [attr.aria-label]="(cell.date | date: 'EEEE, MMMM d') + ': ' + cell.items.length + ' due'"
                       (click)="selected.set(cell.key)" (keydown.enter)="selected.set(cell.key)" (keydown.space)="$event.preventDefault(); selected.set(cell.key)">
                    <span class="num">{{ cell.date.getDate() }}</span>
                    <div class="dots" aria-hidden="true">
                      @for (a of cell.items.slice(0, 3); track a.id) {
                        <span class="dot" [class.done]="a.submitted" [attr.style]="tone(a.courseId)"></span>
                      }
                      @if (cell.items.length > 3) { <span class="dot-more">+</span> }
                    </div>
                    <div class="evs">
                      @for (a of cell.items.slice(0, 3); track a.id) {
                        <a class="ev" [class.done]="a.submitted" [attr.style]="tone(a.courseId)" [routerLink]="['/courses', a.courseId, 'assignments', a.id]"
                           [title]="a.courseCode + ': ' + a.title" (click)="$event.stopPropagation()">{{ a.title }}</a>
                      }
                      @if (cell.items.length > 3) { <span class="more">+{{ cell.items.length - 3 }} more</span> }
                    </div>
                  </div>
                }
              </div>
            } @else {
              <div class="agenda-list" [class.from-right]="dir() > 0" [class.from-left]="dir() < 0">
                @for (g of monthGroups(); track g.key) {
                  <div class="group" [class.past]="g.key < todayKey">
                    <div class="g-head">
                      <span class="g-day" [class.today]="g.key === todayKey"><span class="g-num">{{ g.date | date: 'd' }}</span><span class="g-dow">{{ g.date | date: 'EEE' }}</span></span>
                      <span class="small muted strong">{{ g.key === todayKey ? 'Today' : (g.date | date: 'EEEE, MMMM d') }}</span>
                    </div>
                    <div class="due-list">
                      @for (a of g.items; track a.id) {
                        <a class="due-row" [routerLink]="['/courses', a.courseId, 'assignments', a.id]" [attr.style]="tone(a.courseId)">
                          <span class="code-chip">{{ a.courseCode }}</span>
                          <span class="grow"><span class="title d-block truncate">{{ a.title }}</span><span class="meta d-block">{{ a.dueDate | date: 'h:mm a' }} · {{ a.maxPoints }} pts</span></span>
                          @if (auth.isStudent()) {
                            <span class="end">
                              @if (a.submitted) { <span class="status submitted">Handed in</span> }
                              @else if (past(a.dueDate)) { <span class="status missing">Missing</span> }
                              @else { <span class="status open">To do</span> }
                            </span>
                          }
                        </a>
                      }
                    </div>
                  </div>
                } @empty {
                  <lh-empty icon="calendar" title="Nothing due this month" text="Use the arrows to look at another month." />
                }
              </div>
            }
          }
          @if (data.isLoading()) { <div class="loading" aria-live="polite"><span></span></div> }
        </section>

        <aside class="side">
          @if (view() === 'month') {
            <section class="card card-lg">
              <div class="card-title">{{ selected() === todayKey ? 'Today' : (selectedDate() | date: 'EEEE, MMM d') }}</div>
              <div class="card-sub">{{ selectedDate() | date: 'EEEE, MMMM d' }}</div>
              @for (k of [selected()]; track k) {
                <div class="due-list mt-2">
                  @for (a of dayItems(); track a.id) {
                    <a class="due-row" [attr.style]="tone(a.courseId)" [routerLink]="['/courses', a.courseId, 'assignments', a.id]">
                      <span class="code-chip">{{ a.courseCode }}</span>
                      <span class="grow"><span class="title d-block">{{ a.title }}</span><span class="meta d-block">{{ a.dueDate | date: 'h:mm a' }} · {{ a.maxPoints }} pts</span></span>
                      @if (auth.isStudent() && a.submitted) { <span class="status submitted">Done</span> }
                    </a>
                  } @empty { <lh-empty icon="calendar" title="Nothing due" text="Pick another day on the calendar." /> }
                </div>
              }
            </section>
          }
          <section class="card">
            <div class="card-title mb-2">Courses</div>
            @for (c of data.value()?.courses ?? []; track c.id) {
              <a class="legend" [routerLink]="['/courses', c.id]" [attr.style]="tone(c.id)"><span class="sw"></span><span class="strong">{{ c.code }}</span><span class="small muted truncate">{{ c.title }}</span></a>
            } @empty { <span class="small muted">No courses yet.</span> }
          </section>
          <section class="card tip">
            <lh-icon name="info" class="sm" />
            <span class="small muted">The export button downloads every due date as an .ics file. Open it with Google Calendar, Apple Calendar or Outlook — each deadline gets a reminder the day before.</span>
          </section>
        </aside>
      </div>
    </div>`,
  styles: [`
    .d-block { display: block; }
    .head-actions { gap: .5rem; }
    .lbl-short { display: none; }
    /* minmax(0, …) everywhere: a plain 1fr track refuses to shrink below its content (long course titles in the legend),
       which pushed the Saturday column off the right edge on phones. */
    .layout { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 1.25rem; align-items: start; min-width: 0; }
    .layout > * { min-width: 0; }
    .side { display: flex; flex-direction: column; gap: 1rem; min-width: 0; }
    @media (max-width: 1100px) { .layout { grid-template-columns: minmax(0, 1fr); } }

    .cal-card { overflow: hidden; }
    .cal-head { display: flex; align-items: center; gap: .75rem; margin-bottom: 1rem; min-width: 0; }
    .month { font-size: 1.6rem; min-width: 0; }
    .due-count { white-space: nowrap; font-size: .84rem; }
    .nav { margin-left: auto; gap: .25rem; flex-shrink: 0; }

    .grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; width: 100%; }
    .from-right { animation: cal-in-r 320ms var(--ease-out) backwards; }
    .from-left { animation: cal-in-l 320ms var(--ease-out) backwards; }
    @keyframes cal-in-r { from { opacity: 0; transform: translateX(18px); } }
    @keyframes cal-in-l { from { opacity: 0; transform: translateX(-18px); } }
    .dow { font-size: .8rem; font-weight: 600; color: var(--muted); text-align: center; padding-bottom: .3rem; min-width: 0; }
    .dow .short { display: none; }
    .day { min-height: 104px; padding: 6px; border-radius: var(--r-sm); background: rgba(255, 255, 255, .45); border: 1px solid transparent; cursor: pointer;
      display: flex; flex-direction: column; gap: 3px; min-width: 0; overflow: hidden;
      transition: border-color var(--dur) var(--ease), background var(--dur) var(--ease), transform 160ms var(--ease-out); }
    .day:hover { border-color: var(--line-strong); }
    .day:active { transform: scale(.97); }
    .day.other { background: transparent; }
    .day.other .num { color: var(--faint); }
    /* Selected day = current selection → violet outline; today = violet filled number. */
    .day.sel { border-color: var(--violet); box-shadow: inset 0 0 0 1px var(--violet), 0 8px 20px -12px rgba(91, 69, 224, .6); background: var(--surface); }
    :host-context([data-theme="dark"]) .day { background: rgba(255, 255, 255, .04); }
    :host-context([data-theme="dark"]) .day.sel { background: rgba(171, 157, 255, .1); }
    .num { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; font-size: .82rem; font-weight: 700; font-variant-numeric: tabular-nums;
      transition: background var(--dur) var(--ease), color var(--dur) var(--ease); }
    .day.today .num { background: var(--nav-grad); color: #fff; box-shadow: 0 6px 14px -4px rgba(91, 69, 224, .65); }
    .dots { display: none; }
    .evs { display: flex; flex-direction: column; gap: 3px; width: 100%; min-width: 0; }
    .ev { display: block; padding: 3px 8px; border-radius: 8px; background: var(--c); color: #16151c; font-size: .72rem; font-weight: 700;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-decoration: none !important; transition: filter var(--dur) var(--ease); }
    .ev:hover { filter: brightness(.95); }
    .ev.done { opacity: .55; text-decoration: line-through !important; }
    .more { font-size: .7rem; color: var(--muted); font-weight: 700; padding-left: 4px; }

    .agenda-list { display: flex; flex-direction: column; gap: 1rem; }
    .group { display: flex; flex-direction: column; gap: .25rem; }
    .group.past { opacity: .78; }
    .g-head { display: flex; align-items: center; gap: .7rem; }
    .g-day { width: 44px; height: 44px; border-radius: 12px; background: var(--surface-2); display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1; flex-shrink: 0; }
    .g-day.today { background: var(--nav-grad); color: #fff; box-shadow: var(--nav-glow); }
    .g-num { font-weight: 800; font-size: 1.05rem; font-variant-numeric: tabular-nums; }
    .g-dow { font-size: .66rem; font-weight: 700; opacity: .7; margin-top: 2px; }
    .group .due-list { padding-left: calc(44px + .7rem); }

    .loading { position: absolute; left: 0; right: 0; top: 0; height: 3px; overflow: hidden; }
    .loading span { position: absolute; inset: 0; width: 40%; background: var(--violet); border-radius: 3px; animation: slide 900ms var(--ease) infinite; }
    @keyframes slide { from { transform: translateX(-100%); } to { transform: translateX(250%); } }

    .legend { display: flex; align-items: center; gap: .6rem; padding: .45rem .3rem; color: inherit; text-decoration: none !important; min-width: 0; border-radius: 8px;
      transition: background var(--dur) var(--ease); }
    .legend:hover { background: var(--surface-2); }
    .sw { width: 14px; height: 14px; border-radius: 5px; background: var(--c); flex-shrink: 0; }
    .tip { display: flex; gap: .6rem; align-items: flex-start; color: var(--muted); }

    @media (max-width: 640px) {
      .head-actions { width: 100%; flex-wrap: nowrap; }
      .head-actions .btn { flex: 1; min-width: 0; }
      .lbl-full { display: none; } .lbl-short { display: inline; }
      .cal-card { padding: .85rem .5rem; }
      .cal-head { gap: .5rem; margin-bottom: .75rem; padding: 0 .25rem; }
      .month { font-size: 1.2rem; }
      .due-count { display: none; }
      .grid { gap: 3px; }
      .dow { font-size: .72rem; padding-bottom: 2px; }
      .dow .full { display: none; } .dow .short { display: inline; }
      .day { min-height: 48px; padding: 4px 0 3px; border-radius: 10px; align-items: center; gap: 3px; }
      .num { width: 24px; height: 24px; font-size: .78rem; }
      .evs { display: none; }
      .dots { display: flex; gap: 2px; align-items: center; justify-content: center; max-width: 100%; }
      .dot { width: 5px; height: 5px; border-radius: 50%; background: var(--c-deep); display: block; flex-shrink: 0; }
      :host-context([data-theme="dark"]) .dot { background: var(--c); }
      .dot.done { opacity: .4; }
      .dot-more { font-size: .65rem; color: var(--muted); font-weight: 700; line-height: 1; }
      .group .due-list { padding-left: 0; }
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
  protected monthKey = computed(() => isoDate(this.month()));
  protected selected = signal(this.todayKey);
  protected dir = signal(0);
  protected view = signal<View>(readView());
  protected tone = toneStyle;
  protected past = isPast;

  startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }

  shift(n: number) {
    const m = this.month();
    this.dir.set(n);
    const next = new Date(m.getFullYear(), m.getMonth() + n, 1);
    this.month.set(next);
    // Keep the selection inside the visible month (today if it's there, else the 1st).
    this.selected.set(next.getMonth() === this.today.getMonth() && next.getFullYear() === this.today.getFullYear() ? this.todayKey : isoDate(next));
  }

  goToday() {
    const target = this.startOfMonth(this.today);
    this.dir.set(Math.sign(target.getTime() - this.month().getTime()));
    this.month.set(target);
    this.selected.set(this.todayKey);
  }

  setView(v: View) {
    this.dir.set(0);
    this.view.set(v);
    try { localStorage.setItem('lh-cal-view', v); } catch { /* storage unavailable */ }
  }

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

  protected monthItems = computed(() => (this.data.value()?.items ?? []).filter(a => {
    const d = new Date(a.dueDate);
    return d.getMonth() === this.month().getMonth() && d.getFullYear() === this.month().getFullYear();
  }));

  /** List view: the month's due dates grouped by day, in order. */
  protected monthGroups = computed(() => {
    const groups = new Map<string, AssignmentMini[]>();
    for (const a of [...this.monthItems()].sort((x, y) => x.dueDate.localeCompare(y.dueDate))) {
      const k = isoDate(new Date(a.dueDate));
      groups.set(k, [...(groups.get(k) ?? []), a]);
    }
    return [...groups].map(([key, items]) => ({ key, date: new Date(key + 'T00:00:00'), items }));
  });

  protected selectedDate = computed(() => new Date(this.selected() + 'T00:00:00'));
  protected dayItems = computed(() => this.byDay().get(this.selected()) ?? []);
}

function readView(): View {
  try { return localStorage.getItem('lh-cal-view') === 'list' ? 'list' : 'month'; } catch { return 'month'; }
}
