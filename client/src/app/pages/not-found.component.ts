import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Auth } from '../core/services';
import { IconComponent } from '../shared/icon.component';

@Component({
  selector: 'lh-not-found',
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card card-lg wrap fade-in">
      <div class="code serif">404</div>
      <h1>Page not found</h1>
      <p class="muted">There's nothing at this address. If you followed a link to a course or assignment, it may have been deleted or unpublished.</p>
      <div class="row mt-3">
        <a class="btn btn-ink" [routerLink]="auth.signedIn() ? '/dashboard' : '/'"><lh-icon name="home" class="sm" /> Go home</a>
        <a class="btn btn-glass" routerLink="/catalog">Browse catalog</a>
      </div>
    </section>`,
  styles: [`
    .wrap { max-width: 560px; margin: 3rem auto; text-align: center; display: flex; flex-direction: column; align-items: center; gap: .5rem; }
    .code { font-size: 5rem; font-weight: 600; line-height: 1; color: var(--faint); font-family: var(--serif); }
    h1 { font-size: 1.8rem; }
  `]
})
export class NotFoundComponent { protected auth = inject(Auth); }
