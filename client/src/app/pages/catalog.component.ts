import { ChangeDetectionStrategy, Component, inject, input, signal, effect } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../core/api.service';
import { Auth } from '../core/services';
import { IconComponent } from '../shared/icon.component';
import { CourseCardComponent, EmptyComponent, ScrollerComponent } from '../shared/ui';

@Component({
  selector: 'lh-catalog',
  imports: [FormsModule, RouterLink, IconComponent, CourseCardComponent, EmptyComponent, ScrollerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1 class="page-title">Course catalog</h1>
          <p class="page-sub">{{ data.value()?.totalPublished ?? '…' }} courses open for enrollment{{ auth.signedIn() ? '' : '. Sign in with a student account to enroll' }}.</p>
        </div>
      </div>
      <form class="search" (ngSubmit)="apply()" role="search">
        <lh-icon name="search" />
        <input [(ngModel)]="text" name="q" placeholder="Search by title, code or subject" aria-label="Search courses" />
        @if (text) { <button type="button" class="btn btn-ghost btn-icon btn-sm" (click)="text = ''; apply()" aria-label="Clear search"><lh-icon name="x" class="sm" /></button> }
        <button class="btn btn-ink" type="submit">Search</button>
      </form>

      <lh-scroller aria-label="Subjects">
        <a class="chip" [class.active]="!category()" [routerLink]="[]" [queryParams]="{ category: null }" queryParamsHandling="merge">All subjects</a>
        @for (s of data.value()?.subjects ?? []; track s.name) {
          <a class="chip" [class.active]="category() === s.name" [routerLink]="[]" [queryParams]="{ category: s.name }" queryParamsHandling="merge">
            {{ s.name }} <span class="count">{{ s.count }}</span>
          </a>
        }
      </lh-scroller>

      @if (data.isLoading() && !data.value()) {
        <div class="cards-grid">@for (i of [1,2,3,4,5,6]; track i) { <div class="skeleton" style="height:300px"></div> }</div>
      } @else if (data.value()) {
        @let cat = data.value()!;
        <div class="row between"><span class="small strong muted">{{ cat.courses.length }} result{{ cat.courses.length === 1 ? '' : 's' }}{{ q() ? ' for “' + q() + '”' : '' }}</span></div>
        @if (cat.courses.length) {
          <div class="cards-grid stagger">@for (c of cat.courses; track c.id) { <lh-course-card [c]="c" /> }</div>
        } @else {
          <div class="card"><lh-empty icon="search" title="No courses match" text="Try another word, or clear the filters.">
            <a class="btn btn-glass btn-sm" routerLink="/catalog">Clear filters</a></lh-empty></div>
        }
      }
    </div>`,
  styles: [`
    .search { display: flex; align-items: center; gap: .6rem; max-width: 640px; padding: 5px 5px 5px 14px; border-radius: var(--r-ctl);
      background: var(--surface); border: 1px solid var(--line-strong); color: var(--muted); }
    .search:focus-within { border-color: var(--violet); box-shadow: 0 0 0 3px var(--violet-soft); }
    .search input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; font: inherit; color: var(--ink); }
    .search input::placeholder { color: var(--faint); }
  `]
})
export class CatalogComponent {
  private api = inject(Api);
  private router = inject(Router);
  protected auth = inject(Auth);
  readonly q = input<string>();
  readonly category = input<string>();
  protected text = '';

  protected data = rxResource({
    request: () => ({ q: this.q() ?? null, category: this.category() ?? null }),
    loader: ({ request }) => this.api.catalog(request.q, request.category)
  });

  constructor() { effect(() => { this.text = this.q() ?? ''; }); }

  apply() { this.router.navigate([], { queryParams: { q: this.text || null }, queryParamsHandling: 'merge' }); }
}
