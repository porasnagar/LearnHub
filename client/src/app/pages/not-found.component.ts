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
      <h1>This page wandered off</h1>
      <p class="muted">The page you're looking for doesn't exist or has moved.</p>
      <div class="row mt-3">
        <a class="btn btn-ink" [routerLink]="auth.signedIn() ? '/dashboard' : '/'"><lh-icon name="home" class="sm" /> Go home</a>
        <a class="btn btn-glass" routerLink="/catalog">Browse catalog</a>
      </div>
    </section>`,
  styles: [`
    .wrap { max-width: 560px; margin: 3rem auto; text-align: center; display: flex; flex-direction: column; align-items: center; gap: .5rem; }
    .code { font-size: 6rem; font-weight: 700; line-height: 1; background: linear-gradient(135deg, var(--violet), #e0569b); -webkit-background-clip: text; background-clip: text; color: transparent; }
    h1 { font-size: 1.8rem; }
  `]
})
export class NotFoundComponent { protected auth = inject(Auth); }
