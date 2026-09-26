import { ChangeDetectionStrategy, Component, inject, input, signal, effect } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../core/api.service';
import { Auth } from '../core/services';
import { IconComponent } from '../shared/icon.component';
import { CourseCardComponent, EmptyComponent } from '../shared/ui';

@Component({
  selector: 'lh-catalog',
  imports: [FormsModule, RouterLink, IconComponent, CourseCardComponent, EmptyComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <section class="hero card card-lg fade-in">
        <div class="hero-copy">
          <div class="kicker">Course catalog</div>
          <h1 class="page-title">Find your next course</h1>
          <p class="page-sub">{{ data.value()?.totalPublished ?? '…' }} courses open for enrollment{{ auth.signedIn() ? '' : ' — sign in as a student to enroll' }}.</p>
          <form class="search glass" (ngSubmit)="apply()" role="search">
            <lh-icon name="search" />
            <input [(ngModel)]="text" name="q" placeholder="Search by title, code or topic" aria-label="Search courses" />
            @if (text) { <button type="button" class="btn btn-ghost btn-icon btn-sm" (click)="text = ''; apply()" aria-label="Clear search"><lh-icon name="x" class="sm" /></button> }
            <button class="btn btn-ink" type="submit">Search</button>
          </form>
        </div>
      </section>

      <div class="chips" role="tablist" aria-label="Subjects">
        <a class="chip" [class.active]="!category()" [routerLink]="[]" [queryParams]="{ category: null }" queryParamsHandling="merge">All subjects</a>
        @for (s of data.value()?.subjects ?? []; track s.name) {
          <a class="chip" [class.active]="category() === s.name" [routerLink]="[]" [queryParams]="{ category: s.name }" queryParamsHandling="merge">
            {{ s.name }} <span class="count">{{ s.count }}</span>
          </a>
        }
      </div>

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
    .hero { overflow: hidden; background: linear-gradient(120deg, color-mix(in srgb, var(--lilac) 70%, transparent), color-mix(in srgb, var(--sky) 55%, transparent)); }
    .hero-copy { max-width: 640px; }
    .kicker { font-size: .78rem; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--violet); }
    .search { display: flex; align-items: center; gap: .6rem; margin-top: 1.3rem; padding: 6px 6px 6px 16px; border-radius: 999px; color: var(--muted); }
    .search input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; font: inherit; color: var(--ink); }
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
