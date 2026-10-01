import { ChangeDetectionStrategy, Component, ElementRef, HostListener, Injectable, computed, effect, inject, signal, viewChild } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, map, of, startWith, switchMap } from 'rxjs';
import { Api } from '../core/api.service';
import { SearchResult } from '../core/models';
import { Auth, Theme } from '../core/services';
import { toneStyle } from '../core/util';
import { IconComponent } from '../shared/icon.component';

/** Opens the command palette from anywhere (top bar button, Ctrl/Cmd+K, "/"). */
@Injectable({ providedIn: 'root' })
export class Palette {
  readonly open = signal(false);
  show() { this.open.set(true); }
  hide() { this.open.set(false); }
  toggle() { this.open.update(v => !v); }
}

interface Entry {
  key: string; group: string; title: string; subtitle?: string; icon?: string; code?: string; tone?: string;
  link?: string; run?: () => void;
}

const EMPTY: SearchResult = { courses: [], assignments: [], people: [] };
const head = (s: string) => s.split(' · ')[0];
const rest = (s: string) => s.split(' · ').slice(1).join(' · ');
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Ctrl/Cmd+K palette: jump to a page, a course, an assignment (and, for admins, a person),
 * or run a quick action. Fully keyboard-driven: ↑/↓ move, Enter opens, Esc closes.
 */
@Component({
  selector: 'lh-palette',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (palette.open()) {
      <div class="scrim frost" (click)="close()"></div>
      <div class="panel" role="dialog" aria-modal="true" aria-label="Search LearnHub">
        <div class="bar">
          <lh-icon name="search" />
          <input #box class="q" [value]="q()" (input)="onInput($event)" (keydown)="onKey($event)"
                 placeholder="Search courses, assignments and pages" aria-label="Search courses, assignments and pages"
                 role="combobox" aria-expanded="true" aria-controls="lh-pal-list" aria-autocomplete="list"
                 [attr.aria-activedescendant]="entries().length ? 'pal-' + active() : null" autocomplete="off" spellcheck="false" />
          <button type="button" class="esc" (click)="close()" aria-label="Close search">Esc</button>
        </div>
        <div class="results" id="lh-pal-list" role="listbox" aria-label="Results">
          @for (g of groups(); track g.name) {
            <div class="label">{{ g.name }}</div>
            @for (e of g.items; track e.entry.key) {
              <button type="button" class="res" role="option" [id]="'pal-' + e.index" [class.active]="e.index === active()"
                      [attr.aria-selected]="e.index === active()" (mousemove)="active.set(e.index)" (click)="run(e.entry)">
                @if (e.entry.code) {
                  <span class="code-chip" [attr.style]="e.entry.tone">{{ e.entry.code }}</span>
                } @else {
                  <span class="ic"><lh-icon [name]="e.entry.icon ?? 'arrow-right'" class="sm" /></span>
                }
                <span class="grow">
                  <span class="t truncate">{{ e.entry.title }}</span>
                  @if (e.entry.subtitle) { <span class="s truncate">{{ e.entry.subtitle }}</span> }
                </span>
                <lh-icon name="arrow-right" class="sm go" />
              </button>
            }
          } @empty {
            <div class="none">
              <strong>Nothing matches “{{ q() }}”</strong>
              <span class="small muted">Try a course code like CS301, or part of an assignment title.</span>
            </div>
          }
        </div>
        <div class="foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>Enter</kbd> open</span><span><kbd>Esc</kbd> close</span>
          @if (loading()) { <span class="spin" aria-live="polite">Searching…</span> }
        </div>
      </div>
    }
  `,
  styles: [`
    .scrim { position: fixed; inset: 0; z-index: 1800; background: rgba(17, 16, 22, .32); animation: lh-fade 180ms var(--ease-out) backwards; }
    .panel { position: fixed; z-index: 1801; top: 12vh; left: 50%; width: min(640px, calc(100vw - 24px)); margin-left: max(-320px, calc(-50vw + 12px));
      display: flex; flex-direction: column; max-height: min(560px, 76vh);
      background: var(--surface); border: 1px solid var(--line); border-radius: 18px; box-shadow: var(--shadow-float);
      animation: lh-pop 220ms var(--ease-out) backwards; transform-origin: top center; overflow: hidden; }
    .bar { display: flex; align-items: center; gap: .7rem; padding: 0 .75rem 0 1rem; height: 60px; border-bottom: 1px solid var(--line); color: var(--muted); }
    .q { flex: 1; min-width: 0; height: 100%; border: 0; outline: 0; background: transparent; color: var(--ink); font: inherit; font-size: 1.05rem; }
    .q::placeholder { color: var(--faint); }
    .esc { height: 28px; padding: 0 .55rem; border-radius: 8px; border: 1px solid var(--line-strong); background: var(--surface-2); color: var(--muted);
      font-size: .76rem; font-weight: 700; cursor: pointer; }
    .results { overflow-y: auto; overscroll-behavior: contain; padding: .4rem .5rem .6rem; }
    .label { padding: .7rem .6rem .3rem; font-size: .78rem; font-weight: 700; color: var(--muted); }
    .res { display: flex; align-items: center; gap: .75rem; width: 100%; min-height: 50px; padding: .45rem .6rem; border: 0; border-radius: 12px;
      background: transparent; color: var(--ink); text-align: left; cursor: pointer; transition: background 120ms var(--ease); }
    .res.active { background: var(--violet-soft); }
    .ic { width: 32px; height: 32px; border-radius: 10px; display: grid; place-items: center; background: var(--surface-2); color: var(--ink-2); flex-shrink: 0; }
    .res.active .ic { background: var(--surface); color: var(--violet); }
    .code-chip { min-width: 52px; height: 26px; justify-content: center; flex-shrink: 0; }
    .t { display: block; font-weight: 700; line-height: 1.3; }
    .s { display: block; font-size: .82rem; color: var(--muted); }
    .go { color: var(--violet); opacity: 0; transform: translateX(-4px); transition: opacity 150ms var(--ease-out), transform 150ms var(--ease-out); }
    .res.active .go { opacity: 1; transform: none; }
    .none { display: flex; flex-direction: column; gap: .25rem; padding: 1.25rem .75rem; }
    .foot { display: flex; align-items: center; gap: 1rem; padding: .55rem 1rem; border-top: 1px solid var(--line); background: var(--surface-2);
      font-size: .78rem; color: var(--muted); }
    .foot span { display: inline-flex; align-items: center; gap: .25rem; }
    .spin { margin-left: auto; }
    kbd { display: inline-grid; place-items: center; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 6px; font: inherit; font-size: .72rem; font-weight: 700;
      background: var(--surface); border: 1px solid var(--line-strong); color: var(--ink-2); }
    @media (max-width: 640px) {
      .panel { top: calc(10px + env(safe-area-inset-top)); max-height: calc(100dvh - 120px); border-radius: 16px; }
      .foot { display: none; }
    }
  `]
})
export class PaletteComponent {
  protected palette = inject(Palette);
  private api = inject(Api);
  private auth = inject(Auth);
  private theme = inject(Theme);
  private router = inject(Router);
  private box = viewChild<ElementRef<HTMLInputElement>>('box');
  private returnFocus: HTMLElement | null = null;

  protected readonly q = signal('');
  protected readonly active = signal(0);

  private readonly remote = toSignal(toObservable(this.q).pipe(
    map(q => q.trim()),
    debounceTime(140),
    distinctUntilChanged(),
    switchMap(q => q.length < 2
      ? of({ q, result: EMPTY, done: true })
      : this.api.search(q).pipe(
          map(result => ({ q, result, done: true })),
          catchError(() => of({ q, result: EMPTY, done: true })),
          startWith({ q, result: null as SearchResult | null, done: false })))
  ), { initialValue: { q: '', result: EMPTY as SearchResult | null, done: true } });

  protected readonly loading = computed(() => !this.remote().done);

  /** Pages and quick actions, filtered locally so they appear instantly. */
  private readonly local = computed<Entry[]>(() => {
    const items: Entry[] = [
      { key: 'p-dash', group: 'Pages', title: 'Dashboard', icon: 'home', link: '/dashboard' },
      { key: 'p-courses', group: 'Pages', title: 'My courses', icon: 'courses', link: '/courses' },
      { key: 'p-cal', group: 'Pages', title: 'Calendar', subtitle: 'Due dates by month', icon: 'calendar', link: '/calendar' },
    ];
    if (this.auth.isStudent()) items.push({ key: 'p-grades', group: 'Pages', title: 'Grades', subtitle: 'Your scores in every course', icon: 'grades', link: '/grades' });
    items.push({ key: 'p-cat', group: 'Pages', title: 'Course catalog', icon: 'explore', link: '/catalog' });
    if (this.auth.isAdmin()) items.push({ key: 'p-admin', group: 'Pages', title: 'Administration', subtitle: 'Users and roles', icon: 'admin', link: '/admin' });
    items.push({ key: 'p-profile', group: 'Pages', title: 'Account', subtitle: 'Name, password, sign out', icon: 'user', link: '/profile' });

    if (this.auth.isStaff()) items.push({ key: 'a-new', group: 'Actions', title: 'Create a course', icon: 'plus', link: '/courses/new' });
    items.push(
      { key: 'a-theme', group: 'Actions', title: this.theme.mode() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
        icon: this.theme.mode() === 'dark' ? 'sun' : 'moon', run: () => this.theme.toggle() },
      { key: 'a-ics', group: 'Actions', title: 'Add due dates to my calendar', subtitle: 'Download an .ics file for Google, Apple or Outlook',
        icon: 'download', run: () => { window.location.href = '/api/calendar/export.ics'; } },
    );

    const q = this.q().trim().toLowerCase();
    if (!q) return items;
    return items.filter(i => i.title.toLowerCase().includes(q) || (i.subtitle ?? '').toLowerCase().includes(q));
  });

  protected readonly entries = computed<Entry[]>(() => {
    const r = this.remote();
    const q = this.q().trim();
    const res = r.q === q && r.result ? r.result : EMPTY;
    const remote: Entry[] = [
      // Subtitles arrive as "CODE · detail": the code becomes the course-coloured chip.
      ...res.courses.map(c => ({ key: 'c' + c.id, group: 'Courses', title: c.title, subtitle: rest(c.subtitle), code: head(c.subtitle),
        tone: toneStyle(c.id), link: c.link })),
      ...res.assignments.map(a => ({ key: 'a' + a.id, group: 'Assignments', title: a.title, subtitle: cap(rest(a.subtitle)), code: head(a.subtitle),
        tone: a.courseId ? toneStyle(a.courseId) : undefined, link: a.link })),
      ...res.people.map(p => ({ key: 'u' + p.id, group: 'People', title: p.title, subtitle: p.subtitle, icon: 'user', link: p.link })),
    ];
    const list = q ? [...remote, ...this.local()] : this.local();
    if (q.length >= 2) list.push({ key: 'catalog', group: 'Catalog', title: `Search the catalog for “${q}”`, icon: 'explore', link: `/catalog?q=${encodeURIComponent(q)}` });
    return list;
  });

  protected readonly groups = computed(() => {
    const out: { name: string; items: { entry: Entry; index: number }[] }[] = [];
    this.entries().forEach((entry, index) => {
      let g = out.find(x => x.name === entry.group);
      if (!g) out.push(g = { name: entry.group, items: [] });
      g.items.push({ entry, index });
    });
    // Keep the flat index order consistent with the visual order.
    let i = 0;
    for (const g of out) for (const it of g.items) it.index = i++;
    return out;
  });

  private readonly ordered = computed(() => this.groups().flatMap(g => g.items.map(i => i.entry)));

  constructor() {
    // Focus the field on open; give focus back to whatever had it on close.
    effect(() => {
      if (this.palette.open()) {
        this.returnFocus = document.activeElement as HTMLElement | null;
        this.q.set('');
        this.active.set(0);
        queueMicrotask(() => setTimeout(() => this.box()?.nativeElement.focus()));
      } else if (this.returnFocus) {
        this.returnFocus.focus?.();
        this.returnFocus = null;
      }
    });
    // Keep the highlighted row visible while arrowing through a long list.
    effect(() => {
      const i = this.active();
      if (this.palette.open()) queueMicrotask(() => document.getElementById('pal-' + i)?.scrollIntoView({ block: 'nearest' }));
    });
  }

  @HostListener('document:keydown', ['$event'])
  onGlobalKey(e: KeyboardEvent) {
    if (!this.auth.signedIn()) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      this.palette.toggle();
      return;
    }
    const t = e.target as HTMLElement | null;
    const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    if (e.key === '/' && !typing && !this.palette.open()) {
      e.preventDefault();
      this.palette.show();
    }
  }

  protected onInput(e: Event) {
    this.q.set((e.target as HTMLInputElement).value);
    this.active.set(0);
  }

  protected onKey(e: KeyboardEvent) {
    const n = this.ordered().length;
    if (e.key === 'ArrowDown') { e.preventDefault(); if (n) this.active.update(i => (i + 1) % n); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (n) this.active.update(i => (i - 1 + n) % n); }
    else if (e.key === 'Home') { e.preventDefault(); this.active.set(0); }
    else if (e.key === 'End') { e.preventDefault(); this.active.set(Math.max(0, n - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); const entry = this.ordered()[this.active()]; if (entry) this.run(entry); }
    else if (e.key === 'Escape') { e.preventDefault(); this.close(); }
    else if (e.key === 'Tab') { e.preventDefault(); } // focus stays in the dialog
  }

  protected run(entry: Entry) {
    this.close();
    if (entry.run) entry.run();
    else if (entry.link) this.router.navigateByUrl(entry.link);
  }

  protected close() { this.palette.hide(); }
}
