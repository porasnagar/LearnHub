import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Auth, Theme, Toasts } from '../core/services';
import { AvatarComponent } from '../shared/ui';
import { IconComponent, LogoComponent } from '../shared/icon.component';

interface NavItem { label: string; icon: string; link: string; exact?: boolean; }

/** App frame: glass sidebar (desktop), top bar + floating tab bar (mobile), or a public header when signed out. */
@Component({
  selector: 'lh-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule, IconComponent, LogoComponent, AvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (auth.user(); as user) {
      <aside class="sidebar glass" aria-label="Main navigation">
        <a routerLink="/dashboard" class="brand"><lh-logo /></a>
        <nav class="nav">
          <div class="nav-label">Menu</div>
          @for (item of nav(); track item.link) {
            <a [routerLink]="item.link" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: !!item.exact }" class="nav-link">
              <lh-icon [name]="item.icon" /><span>{{ item.label }}</span>
            </a>
          }
        </nav>
        <div class="side-foot">
          <button class="nav-link" (click)="theme.toggle()">
            <lh-icon [name]="theme.mode() === 'dark' ? 'sun' : 'moon'" /><span>{{ theme.mode() === 'dark' ? 'Light mode' : 'Dark mode' }}</span>
          </button>
          <a routerLink="/profile" class="me">
            <lh-avatar [name]="user.fullName" size="sm" />
            <span class="grow"><span class="truncate strong d-block">{{ user.fullName }}</span><span class="tiny muted">{{ user.role }}</span></span>
          </a>
          <button class="nav-link" (click)="signOut()"><lh-icon name="logout" /><span>Sign out</span></button>
        </div>
      </aside>

      <header class="topbar">
        <a routerLink="/dashboard" class="mobile-brand"><lh-logo [size]="32" /></a>
        <form class="search glass" (ngSubmit)="search()" role="search">
          <lh-icon name="search" class="sm" />
          <input [(ngModel)]="query" name="q" placeholder="Search courses, subjects…" aria-label="Search courses" />
          <kbd>↵</kbd>
        </form>
        <div class="row top-actions">
          <button class="btn btn-glass btn-icon" (click)="theme.toggle()" [attr.aria-label]="'Switch theme'">
            <lh-icon [name]="theme.mode() === 'dark' ? 'sun' : 'moon'" />
          </button>
          <a routerLink="/profile" class="avatar-link" aria-label="Account"><lh-avatar [name]="user.fullName" /></a>
        </div>
      </header>

      <main class="main" id="main"><router-outlet /></main>

      <nav class="tabbar glass" aria-label="Main navigation">
        @for (item of tabs(); track item.link) {
          <a [routerLink]="item.link" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: !!item.exact }" class="tab" [attr.aria-label]="item.label">
            <lh-icon [name]="item.icon" /><span>{{ item.label }}</span>
          </a>
        }
      </nav>
    } @else {
      <header class="public glass">
        <a routerLink="/" class="brand-inline"><lh-logo /></a>
        <nav class="row">
          <a routerLink="/catalog" routerLinkActive="active" class="plink">Catalog</a>
          <a routerLink="/login" class="btn btn-glass btn-sm">Sign in</a>
          <a routerLink="/register" class="btn btn-ink btn-sm">Get started</a>
        </nav>
      </header>
      <main class="main public-main" id="main"><router-outlet /></main>
    }
  `,
  styles: [`
    :host { display: block; min-height: 100vh; --side: 264px; }
    .d-block { display: block; }

    /* Sidebar (desktop) */
    .sidebar { position: fixed; z-index: 30; top: 16px; bottom: 16px; left: 16px; width: var(--side); border-radius: var(--r-xl);
      display: flex; flex-direction: column; padding: 1.3rem 1rem 1rem; }
    .brand { padding: 0 .5rem .6rem; text-decoration: none !important; }
    .nav { display: flex; flex-direction: column; gap: 4px; margin-top: 1rem; }
    .nav-label { font-size: .7rem; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--faint); padding: 0 .8rem .4rem; }
    .nav-link { display: flex; align-items: center; gap: .8rem; height: 46px; padding: 0 .9rem; border-radius: 16px; border: 0; background: transparent; width: 100%;
      color: var(--ink-2); font-weight: 700; font-size: .94rem; cursor: pointer; text-decoration: none !important; position: relative;
      transition: background .25s var(--ease), color .25s, transform .2s var(--ease); }
    .nav-link:hover { background: var(--glass-strong); color: var(--ink); transform: translateX(2px); }
    .nav-link.active { background: var(--btn-bg); color: var(--btn-fg); box-shadow: 0 10px 22px -12px rgba(22,21,28,.7); --duo: .35; }
    .nav-link.active::after { content: ""; position: absolute; right: 12px; width: 7px; height: 7px; border-radius: 50%; background: var(--lemon); }
    .side-foot { margin-top: auto; display: flex; flex-direction: column; gap: 4px; }
    .me { display: flex; align-items: center; gap: .7rem; padding: .6rem .7rem; margin: .4rem 0; border-radius: 18px; background: var(--glass-strong);
      border: 1px solid var(--glass-border); color: var(--ink); text-decoration: none !important; min-width: 0; }

    /* Top bar */
    .topbar { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; gap: 1rem; padding: 16px 28px 12px calc(var(--side) + 44px);
      background: linear-gradient(to bottom, color-mix(in srgb, var(--canvas) 78%, transparent) 60%, transparent);
      -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px);
      mask-image: linear-gradient(to bottom, #000 80%, transparent); }
    .mobile-brand { display: none; }
    .search { flex: 1; max-width: 520px; display: flex; align-items: center; gap: .6rem; height: 46px; padding: 0 .6rem 0 1rem; border-radius: 999px; color: var(--muted); }
    .search input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--ink); font: inherit; }
    kbd { font-family: var(--sans); font-size: .72rem; padding: 2px 8px; border-radius: 8px; background: var(--line); color: var(--muted); }
    .top-actions { margin-left: auto; }
    .avatar-link { text-decoration: none !important; }

    .main { padding: 8px 28px 48px calc(var(--side) + 44px); max-width: calc(1400px + var(--side)); }

    /* Mobile tab bar */
    .tabbar { display: none; }

    @media (max-width: 1023px) {
      .sidebar { display: none; }
      .topbar { padding: 12px 16px; gap: .6rem; background: color-mix(in srgb, var(--canvas) 70%, transparent); backdrop-filter: blur(16px); }
      .mobile-brand { display: inline-flex; text-decoration: none !important; }
      .search kbd { display: none; }
      .main { padding: 8px 12px 110px; max-width: 100%; min-width: 0; overflow-x: clip; }
      .tabbar { position: fixed; z-index: 40; left: 50%; bottom: calc(12px + env(safe-area-inset-bottom)); transform: translateX(-50%);
        display: flex; align-items: center; gap: 4px; padding: 4px 6px; border-radius: 999px; background: var(--glass);
        box-shadow: var(--shadow-lg); max-width: calc(100vw - 16px); width: auto; box-sizing: border-box; }
      .tab { display: flex; align-items: center; justify-content: center; gap: .35rem; height: 44px; min-width: 44px; padding: 0 10px; border-radius: 999px;
        color: var(--ink-2); background: var(--glass-strong); border: 1px solid var(--glass-border);
        text-decoration: none !important; font-weight: 700; font-size: .84rem; flex-shrink: 1;
        transition: background .3s var(--ease), color .3s, padding .3s var(--ease), transform .2s var(--ease); }
      .tab:active { transform: scale(.94); }
      .tab span { max-width: 0; overflow: hidden; white-space: nowrap; transition: max-width .3s var(--ease); }
      .tab.active { background: var(--violet); border-color: transparent; color: #fff; padding: 0 14px; flex-shrink: 0;
        box-shadow: 0 10px 22px -10px var(--violet); }
      .tab.active span { max-width: 72px; }
      .top-actions .btn-icon, .avatar-link ::ng-deep .avatar { width: 44px; height: 44px; }
      /* Narrow phones (≤375px): shrink tabs further */
      @media (max-width: 375px) {
        .tabbar { gap: 2px; padding: 3px 4px; max-width: calc(100vw - 10px); }
        .tab { height: 40px; min-width: 38px; padding: 0 7px; font-size: .78rem; }
        .tab.active { padding: 0 10px; }
        .tab.active span { max-width: 52px; }
      }
    }
    @media (max-width: 560px) { .search { display: none; } .top-actions { margin-left: auto; } }

    /* Public header */
    .public { position: sticky; top: 14px; z-index: 20; margin: 14px auto 0; width: min(1200px, calc(100% - 28px)); border-radius: 999px;
      display: flex; align-items: center; justify-content: space-between; padding: 10px 12px 10px 20px; }
    .brand-inline { text-decoration: none !important; }
    .plink { font-weight: 700; color: var(--ink-2); padding: 0 .6rem; }
    .plink.active { color: var(--violet); }
    .public-main { padding: 28px 16px 64px; max-width: 1232px; margin: 0 auto; }
    @media (max-width: 560px) { .plink { display: none; } }
  `]
})
export class ShellComponent {
  protected auth = inject(Auth);
  protected theme = inject(Theme);
  private router = inject(Router);
  private toasts = inject(Toasts);
  protected query = '';

  protected readonly nav = computed<NavItem[]>(() => {
    const items: NavItem[] = [
      { label: 'Dashboard', icon: 'home', link: '/dashboard' },
      { label: 'My courses', icon: 'courses', link: '/courses', exact: true },
      { label: 'Calendar', icon: 'calendar', link: '/calendar' },
    ];
    if (this.auth.isStudent()) items.push({ label: 'Grades', icon: 'grades', link: '/grades' });
    items.push({ label: 'Catalog', icon: 'explore', link: '/catalog' });
    if (this.auth.isAdmin()) items.push({ label: 'Administration', icon: 'admin', link: '/admin' });
    return items;
  });

  protected readonly tabs = computed<NavItem[]>(() => [
    { label: 'Home', icon: 'home', link: '/dashboard' },
    { label: 'Courses', icon: 'courses', link: '/courses', exact: true },
    { label: 'Calendar', icon: 'calendar', link: '/calendar' },
    this.auth.isStudent() ? { label: 'Grades', icon: 'grades', link: '/grades' }
      : this.auth.isAdmin() ? { label: 'Admin', icon: 'admin', link: '/admin' }
      : { label: 'Catalog', icon: 'explore', link: '/catalog' },
    { label: 'Me', icon: 'user', link: '/profile' },
  ]);

  search() {
    this.router.navigate(['/catalog'], { queryParams: { q: this.query || null } });
    this.query = '';
  }

  signOut() {
    this.auth.logout().subscribe(() => {
      this.toasts.show('You have been signed out.', 'info');
      this.router.navigateByUrl('/');
    });
  }
}
