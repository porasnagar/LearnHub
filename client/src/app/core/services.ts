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

// ---------- Theme ----------

@Injectable({ providedIn: 'root' })
export class Theme {
  readonly mode = signal<'light' | 'dark'>((document.documentElement.dataset['theme'] as 'light' | 'dark') ?? 'light');

  toggle() {
    const next = this.mode() === 'dark' ? 'light' : 'dark';
    const apply = () => {
      document.documentElement.dataset['theme'] = next;
      this.mode.set(next);
      try { localStorage.setItem('lh-theme', next); } catch { /* private mode */ }
    };
    // Cross-fade the whole page when the browser supports view transitions.
    type Transition = { ready: Promise<void>; finished: Promise<void>; updateCallbackDone: Promise<void> };
    const doc = document as Document & { startViewTransition?: (cb: () => void) => Transition };
    if (!doc.startViewTransition) { apply(); return; }
    const t = doc.startViewTransition(apply);
    // A skipped transition (e.g. the tab is hidden) rejects these; the theme still applies.
    t.ready.catch(() => {}); t.finished.catch(() => {}); t.updateCallbackDone.catch(() => {});
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
