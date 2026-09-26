import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api.service';
import { letterGrade, score, toneStyle } from '../core/util';
import { IconComponent } from '../shared/icon.component';
import { EmptyComponent, RingComponent } from '../shared/ui';

@Component({
  selector: 'lh-grades',
  imports: [RouterLink, IconComponent, EmptyComponent, RingComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head fade-in"><div><h1 class="page-title">Grades</h1><p class="page-sub">Your current grade in each course, from the work graded so far.</p></div></div>
      @if (!rows()) {
        <div class="cards-grid">@for (i of [1,2,3]; track i) { <div class="skeleton" style="height:250px"></div> }</div>
      } @else if (rows()!.length) {
        <section class="card card-lg summary fade-in">
          <lh-ring [percent]="overall() ?? 0" [center]="overall() === null ? '–' : overall()!.toFixed(1) + '%'" [caption]="overall() === null ? 'No grades yet' : 'Overall · ' + letter(overall()!)" [size]="150" />
          <div class="grow">
            <div class="card-title">Term overview</div>
            <p class="muted small mt-1">{{ gradedTotal() }} graded assignments across {{ rows()!.length }} courses.</p>
            <div class="mini mt-3">
              @for (r of rows(); track r.courseId) {
                <div class="mini-row" [attr.style]="tone(r.courseId)">
                  <span class="code">{{ r.code }}</span>
                  <div class="meter grow" [style.--fill]="'var(--c-deep)'"><span [style.width.%]="pct(r) ?? 0"></span></div>
                  <span class="strong small nowrap">{{ pct(r) === null ? '–' : pct(r)!.toFixed(0) + '%' }}</span>
                </div>
              }
            </div>
          </div>
        </section>
        <div class="cards-grid stagger">
          @for (r of rows(); track r.courseId) {
            <a class="card card-lg gcard link-card" [routerLink]="['/courses', r.courseId, 'grades']" [attr.style]="tone(r.courseId)">
              <div class="row between"><span class="code">{{ r.code }}</span><lh-icon name="arrow-right" class="sm" /></div>
              <div class="strong title">{{ r.title }}</div>
              <div class="tiny muted">{{ r.instructorName }}</div>
              <div class="row between mt-3">
                <div class="big serif">{{ pct(r) === null ? '–' : pct(r)!.toFixed(0) }}<small>{{ pct(r) === null ? '' : '%' }}</small></div>
                @if (pct(r) !== null) { <span class="letter serif">{{ letter(pct(r)!) }}</span> }
              </div>
              <div class="tiny muted">{{ fmt(r.earned) }} / {{ r.possible }} pts · {{ r.gradedCount }} of {{ r.assignmentCount }} graded</div>
            </a>
          }
        </div>
      } @else {
        <div class="card"><lh-empty icon="grades" title="No courses yet" text="Enroll in a course to start earning grades."><a routerLink="/catalog" class="btn btn-ink btn-sm">Browse catalog</a></lh-empty></div>
      }
    </div>`,
  styles: [`
    .summary { display: flex; align-items: center; gap: 2rem; flex-wrap: wrap; }
    .mini { display: flex; flex-direction: column; gap: .6rem; }
    .mini-row { display: flex; align-items: center; gap: .8rem; }
    .code { font-size: .72rem; font-weight: 800; padding: 3px 10px; border-radius: 999px; background: var(--c); color: #16151c; min-width: 62px; text-align: center; }
    .gcard { display: flex; flex-direction: column; gap: .25rem; color: inherit; text-decoration: none !important; }
    .title { font-size: 1.08rem; margin-top: .8rem; }
    .big { font-size: 3rem; font-weight: 600; line-height: 1; } .big small { font-size: 1.2rem; color: var(--muted); }
    .letter { width: 56px; height: 56px; border-radius: 18px; background: var(--c); color: #16151c; display: grid; place-items: center; font-size: 1.4rem; font-weight: 700; }
  `]
})
export class GradesComponent {
  private api = inject(Api);
  protected rows = toSignal(this.api.grades());
  protected tone = toneStyle;
  protected letter = letterGrade;
  protected fmt = score;
  protected pct(r: { earned: number; possible: number }) { return r.possible ? r.earned / r.possible * 100 : null; }
  protected gradedTotal = computed(() => (this.rows() ?? []).reduce((s, r) => s + r.gradedCount, 0));
  protected overall = computed(() => {
    const rs = this.rows() ?? [];
    const possible = rs.reduce((s, r) => s + r.possible, 0);
    return possible ? rs.reduce((s, r) => s + r.earned, 0) / possible * 100 : null;
  });
}
