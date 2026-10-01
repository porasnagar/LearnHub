import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom, tap, catchError, throwError } from 'rxjs';
import { Api } from './api.service';
import { Role, User } from './models';

// ---------- Auth ----------

@Injectable({ providedIn: 'root' })
export class Auth {
  private api = inject(Api);
  readonly user = signal<User | null>(null);
  readonly signedIn = computed(() => this.user() !== null);
  readonly role = computed(() => this.user()?.role ?? null);
  readonly isStudent = computed(() => this.role() === 'Student');
  readonly isStaff = computed(() => this.role() === 'Instructor' || this.role() === 'Admin');
  readonly isAdmin = computed(() => this.role() === 'Admin');

  /** Called once at startup: restores the session from the auth cookie (and gets an XSRF token). */
  async load() {
    try { this.user.set((await firstValueFrom(this.api.me())) ?? null); }
    catch { this.user.set(null); }
  }

  login(email: string, password: string, remember: boolean) {
    return this.api.login(email, password, remember).pipe(tap(u => this.user.set(u)));
  }

  register(body: { fullName: string; email: string; password: string; role: Role }) {
    return this.api.register(body).pipe(tap(u => this.user.set(u)));
  }

  logout() { return this.api.logout().pipe(tap(() => this.user.set(null))); }
}

// ---------- Toasts ----------

export interface Toast { id: number; kind: 'ok' | 'error' | 'info'; text: string; }

@Injectable({ providedIn: 'root' })
export class Toasts {
  readonly items = signal<Toast[]>([]);
  private next = 1;

  show(text: string, kind: Toast['kind'] = 'ok', ms = 4200) {
    const id = this.next++;
    this.items.update(list => [...list, { id, kind, text }]);
    if (ms > 0) setTimeout(() => this.dismiss(id), ms);
  }
  ok(text: string) { this.show(text, 'ok'); }
  error(text: string) { this.show(text, 'error', 7000); }
  dismiss(id: number) { this.items.update(list => list.filter(t => t.id !== id)); }
}

// ---------- Confirm dialog ----------

export interface ConfirmRequest { title: string; message: string; confirmText: string; danger: boolean; resolve: (ok: boolean) => void; }

@Injectable({ providedIn: 'root' })
export class Confirm {
  readonly request = signal<ConfirmRequest | null>(null);

  ask(title: string, message: string, confirmText = 'Confirm', danger = true): Promise<boolean> {
    return new Promise(resolve => this.request.set({ title, message, confirmText, danger, resolve }));
  }
  close(ok: boolean) {
    this.request()?.resolve(ok);
    this.request.set(null);
  }
}

// ---------- Theme: light / dark / auto, plus an accent hue ----------

export type ThemePref = 'light' | 'dark' | 'auto';
export interface Accent { name: string; hue: number; }

/** Preset accents (OKLCH hues). Any hue 0–359 is allowed via the slider. */
export const ACCENTS: Accent[] = [
  { name: 'Violet', hue: 283 }, { name: 'Indigo', hue: 264 }, { name: 'Ocean', hue: 245 }, { name: 'Sky', hue: 225 },
  { name: 'Teal', hue: 190 }, { name: 'Emerald', hue: 155 }, { name: 'Amber', hue: 65 }, { name: 'Coral', hue: 35 },
  { name: 'Rose', hue: 10 }, { name: 'Magenta', hue: 330 },
];
export const DEFAULT_HUE = 283;

function readPref(): ThemePref {
  try { const v = localStorage.getItem('lh-theme'); return v === 'light' || v === 'dark' ? v : 'auto'; } catch { return 'auto'; }
}
function readHue(): number {
  try { const v = Number(localStorage.getItem('lh-hue')); return localStorage.getItem('lh-hue') !== null && Number.isFinite(v) ? v : DEFAULT_HUE; }
  catch { return DEFAULT_HUE; }
}
function save(key: string, value: string) { try { localStorage.setItem(key, value); } catch { /* private mode */ } }

type Transition = { ready: Promise<void>; finished: Promise<void>; updateCallbackDone: Promise<void> };

@Injectable({ providedIn: 'root' })
export class Theme {
  private media = matchMedia('(prefers-color-scheme: dark)');
  /** What the person chose. */
  readonly pref = signal<ThemePref>(readPref());
  /** What is showing right now. */
  readonly mode = signal<'light' | 'dark'>((document.documentElement.dataset['theme'] as 'light' | 'dark') ?? 'light');
  readonly hue = signal<number>(readHue());
  readonly accentName = computed(() => ACCENTS.find(a => a.hue === this.hue())?.name ?? 'Custom');

  constructor() {
    // Auto follows the device setting live, e.g. when the phone switches to dark at sunset.
    this.media.addEventListener('change', () => {
      if (this.pref() === 'auto') this.applyMode(this.media.matches ? 'dark' : 'light', null);
    });
    queueMicrotask(() => this.syncBrowserBar());
  }

  /** The sun/moon button: flips between light and dark. */
  toggle(origin?: Event) { this.setPref(this.mode() === 'dark' ? 'light' : 'dark', origin); }

  setPref(pref: ThemePref, origin?: Event | null) {
    this.pref.set(pref);
    save('lh-theme', pref);
    this.applyMode(pref === 'auto' ? (this.media.matches ? 'dark' : 'light') : pref, origin);
  }

  /** Pick an accent. `animate: false` is for dragging the slider (instant, no reveal). */
  setHue(hue: number, origin?: Event | null, animate = true) {
    const h = ((Math.round(hue) % 360) + 360) % 360;
    if (h === this.hue()) return;
    save('lh-hue', String(h));
    this.reveal(() => {
      document.documentElement.style.setProperty('--hue', String(h));
      this.hue.set(h);
    }, origin, animate);
  }

  private applyMode(next: 'light' | 'dark', origin?: Event | null) {
    if (next === this.mode()) return;
    this.reveal(() => {
      document.documentElement.dataset['theme'] = next;
      this.mode.set(next);
    }, origin, true);
  }

  /**
   * Apply a change of look. When possible the new look spreads in a circle from where the person
   * clicked (or the centre of the screen), led by a glowing ring.
   */
  private reveal(apply: () => void, origin: Event | null | undefined, animate: boolean) {
    const done = () => { apply(); this.syncBrowserBar(); };
    const doc = document as Document & { startViewTransition?: (cb: () => void) => Transition };
    if (!animate || !doc.startViewTransition || document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      done();
      return;
    }

    const root = document.documentElement;
    const target = origin?.currentTarget instanceof Element ? origin.currentTarget.getBoundingClientRect() : null;
    const pe = origin as PointerEvent | null | undefined;
    const x = pe?.clientX ? pe.clientX : target ? target.left + target.width / 2 : innerWidth / 2;
    const y = pe?.clientY ? pe.clientY : target ? target.top + target.height / 2 : innerHeight / 2;
    const r = Math.ceil(Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)));
    root.style.setProperty('--vt-x', `${x}px`);
    root.style.setProperty('--vt-y', `${y}px`);
    root.style.setProperty('--vt-r', `${r}px`);
    root.classList.add('theme-vt');

    const ring = document.createElement('div');
    ring.className = 'vt-ring';
    ring.setAttribute('aria-hidden', 'true');

    const t = doc.startViewTransition(() => { done(); document.body.appendChild(ring); });
    // A skipped transition (e.g. the tab is hidden) rejects these; the change still applies.
    t.ready.catch(() => {});
    t.updateCallbackDone.catch(() => {});
    t.finished.catch(() => {}).finally(() => { root.classList.remove('theme-vt'); ring.remove(); });
  }

  /** Phones tint the browser's own bar with theme-color; keep it matching the canvas. */
  private syncBrowserBar() {
    try {
      const c = document.createElement('canvas');
      c.width = c.height = 1;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = getComputedStyle(document.body).backgroundColor;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
      document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', hex));
    } catch { /* not important */ }
  }
}

// ---------- HTTP: turn API errors into toasts ----------

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toasts = inject(Toasts);
  const router = inject(Router);
  const auth = inject(Auth);
  return next(req).pipe(catchError((err: HttpErrorResponse) => {
    if (err.status === 401) {
      // Only a session that expired while signed in should bounce to the login page;
      // requests fired during an intentional sign-out are simply dropped.
      if (auth.user() !== null && !req.url.endsWith('/api/auth/me')) {
        auth.user.set(null);
        toasts.show('Your session has ended. Please sign in again.', 'info');
        router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
      }
    } else if (err.status === 403) {
      toasts.error("You don't have permission to do that.");
    } else if (err.status === 400 && err.error?.message) {
      toasts.error(err.error.message);
    } else if (err.status >= 500 || err.status === 0) {
      toasts.error('Something went wrong. Please try again.');
    }
    return throwError(() => err);
  }));
};

// ---------- Guards ----------

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(Auth);
  return auth.signedIn() ? true : inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

export const guestGuard: CanActivateFn = () =>
  inject(Auth).signedIn() ? inject(Router).createUrlTree(['/dashboard']) : true;

export const roleGuard = (...roles: Role[]): CanActivateFn => () => {
  const auth = inject(Auth);
  if (!auth.signedIn()) return inject(Router).createUrlTree(['/login']);
  return roles.includes(auth.role()!) ? true : inject(Router).createUrlTree(['/dashboard']);
};
