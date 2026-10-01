import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Auth, Theme, Toasts } from '../core/services';
import { AvatarComponent } from '../shared/ui';
import { IconComponent, LogoComponent } from '../shared/icon.component';

interface NavItem { label: string; icon: string; link: string; exact?: boolean; }

/**
 * App frame. Desktop: opaque sidebar docked left + frosted sticky top bar.
 * Phones: frosted top bar + frosted floating tab bar (content scrolls under both).
 * Signed out: a frosted public header.
 */
@Component({
  selector: 'lh-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule, IconComponent, LogoComponent, AvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (auth.user(); as user) {
      <aside class="sidebar" aria-label="Main navigation">
        <a routerLink="/dashboard" class="brand" aria-label="LearnHub dashboard"><lh-logo [size]="32" /></a>
        <nav class="nav">
          @for (item of nav(); track item.link) {
            <a [routerLink]="item.link" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: !!item.exact }" class="nav-link"
               ariaCurrentWhenActive="page">
              <lh-icon [name]="item.icon" /><span>{{ item.label }}</span>
            </a>
          }
        </nav>
        <div class="side-foot">
          <button class="nav-link" (click)="theme.toggle()">
            <lh-icon [name]="theme.mode() === 'dark' ? 'sun' : 'moon'" /><span>{{ theme.mode() === 'dark' ? 'Light theme' : 'Dark theme' }}</span>
          </button>
          <a routerLink="/profile" routerLinkActive="active" class="me">
            <lh-avatar [name]="user.fullName" size="sm" />
            <span class="grow"><span class="truncate strong d-block">{{ user.fullName }}</span><span class="tiny muted">{{ user.role }}</span></span>
          </a>
          <button class="nav-link" (click)="signOut()"><lh-icon name="logout" /><span>Sign out</span></button>
        </div>
      </aside>

      <header class="topbar frost">
        <a routerLink="/dashboard" class="mobile-brand" aria-label="LearnHub dashboard"><lh-logo [size]="30" /></a>
        <form class="search" (ngSubmit)="search()" role="search">
          <lh-icon name="search" class="sm" />
          <input [(ngModel)]="query" name="q" placeholder="Search the course catalog" aria-label="Search the course catalog" />
        </form>
        <div class="row top-actions">
          <button class="btn btn-ghost btn-icon theme-btn" (click)="theme.toggle()" [attr.aria-label]="theme.mode() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'">
            <lh-icon [name]="theme.mode() === 'dark' ? 'sun' : 'moon'" />
          </button>
          <a routerLink="/profile" class="avatar-link" aria-label="Your account"><lh-avatar [name]="user.fullName" size="sm" /></a>
        </div>
      </header>

      <main class="main" id="main"><router-outlet /></main>

      <nav class="tabbar frost" aria-label="Main navigation">
        @for (item of tabs(); track item.link) {
          <a [routerLink]="item.link" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: !!item.exact }" class="tab"
             [attr.aria-label]="item.label" ariaCurrentWhenActive="page">
            <lh-icon [name]="item.icon" /><span>{{ item.label }}</span>
          </a>
        }
      </nav>
    } @else {
      <header class="public frost">
        <a routerLink="/" class="brand-inline" aria-label="LearnHub home"><lh-logo [size]="32" /></a>
        <nav class="row">
          <a routerLink="/catalog" routerLinkActive="active" class="plink">Catalog</a>
          <a routerLink="/login" class="btn btn-ghost btn-sm">Sign in</a>
          <a routerLink="/register" class="btn btn-ink btn-sm">Create account</a>
        </nav>
      </header>
      <main class="main public-main" id="main"><router-outlet /></main>
    }
  `,
  styles: [`
    :host { display: block; min-height: 100vh; --side: 244px; }
    .d-block { display: block; }

    /* Sidebar (desktop): opaque, docked to the left edge. */
    .sidebar { position: fixed; z-index: 30; inset: 0 auto 0 0; width: var(--side); display: flex; flex-direction: column;
      padding: 1.1rem .75rem .9rem; background: var(--surface); border-right: 1px solid var(--line); }
    .brand { padding: .15rem .55rem 1.1rem; text-decoration: none !important; }
    .nav { display: flex; flex-direction: column; gap: 2px; }
    .nav-link { display: flex; align-items: center; gap: .75rem; height: 42px; padding: 0 .75rem; border-radius: var(--r-ctl); border: 0; background: transparent; width: 100%;
      color: var(--ink-2); font-weight: 600; font-size: .95rem; cursor: pointer; text-decoration: none !important;
      transition: background var(--dur) var(--ease), color var(--dur) var(--ease); }
    .nav-link:hover { background: var(--surface-2); color: var(--ink); }
    .nav-link.active { background: var(--btn-bg); color: var(--btn-fg); --duo: .35; }
    .side-foot { margin-top: auto; display: flex; flex-direction: column; gap: 2px; padding-top: .75rem; border-top: 1px solid var(--line); }
    .me { display: flex; align-items: center; gap: .65rem; padding: .5rem .6rem; border-radius: var(--r-ctl); color: var(--ink); text-decoration: none !important; min-width: 0; }
    .me:hover, .me.active { background: var(--surface-2); }

    /* Top bar: frosted, sticky. */
    .topbar { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; gap: 1rem; height: 64px;
      padding: 0 28px 0 calc(var(--side) + 28px); border-bottom: 1px solid var(--line); }
    .mobile-brand { display: none; }
    .search { flex: 1; max-width: 460px; display: flex; align-items: center; gap: .55rem; height: 40px; padding: 0 .85rem;
      border-radius: var(--r-ctl); background: var(--surface); border: 1px solid var(--line); color: var(--muted); }
    .search:focus-within { border-color: var(--violet); box-shadow: 0 0 0 3px var(--violet-soft); }
    .search input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--ink); font: inherit; }
    .search input::placeholder { color: var(--faint); }
    .top-actions { margin-left: auto; }
    .theme-btn { display: none; }
    .avatar-link { display: none; text-decoration: none !important; }

    .main { padding: 24px 28px 56px calc(var(--side) + 28px); max-width: calc(1360px + var(--side)); }

    .tabbar { display: none; }

    @media (max-width: 1023px) {
      .sidebar { display: none; }
      .topbar { height: 58px; padding: 0 12px 0 16px; gap: .6rem; }
      .mobile-brand { display: inline-flex; text-decoration: none !important; }
      .theme-btn, .avatar-link { display: inline-flex; }
      .main { padding: 16px 16px 112px; max-width: 100%; min-width: 0; }

      /* Floating tab bar: frosted, icons only; the active tab expands into an ink pill with its label. */
      .tabbar { position: fixed; z-index: 40; left: 50%; bottom: calc(12px + env(safe-area-inset-bottom)); transform: translateX(-50%);
        display: flex; align-items: center; gap: 4px; padding: 5px; border-radius: 999px;
        border: 1px solid var(--line); box-shadow: var(--shadow-float); max-width: calc(100vw - 24px); }
      .tab { display: flex; align-items: center; justify-content: center; gap: .4rem; height: 46px; min-width: 46px; padding: 0 12px; border-radius: 999px;
        color: var(--ink-2); text-decoration: none !important; font-weight: 700; font-size: .88rem;
        transition: background 200ms var(--ease), color 200ms var(--ease), padding 200ms var(--ease); }
      .tab span { max-width: 0; overflow: hidden; white-space: nowrap; transition: max-width 200ms var(--ease); }
      .tab.active { background: var(--btn-bg); color: var(--btn-fg); padding: 0 16px; --duo: .35; }
      .tab.active span { max-width: 80px; }
    }
    @media (max-width: 560px) { .search { display: none; } }
    @media (max-width: 360px) {
      .tab { min-width: 42px; height: 42px; padding: 0 9px; }
      .tab.active { padding: 0 12px; }
      .tab.active span { max-width: 60px; }
    }

    /* Public header: frosted, full width. */
    .public { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; justify-content: space-between;
      height: 64px; padding: 0 max(16px, calc((100% - 1200px) / 2)); border-bottom: 1px solid var(--line); }
    .brand-inline { text-decoration: none !important; }
    .plink { font-weight: 600; color: var(--ink-2); padding: 0 .6rem; }
    .plink.active { color: var(--ink); text-decoration: underline; text-underline-offset: 6px; }
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
