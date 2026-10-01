import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api.service';
import { AppNotification, NotificationKind } from '../core/models';
import { Auth } from '../core/services';
import { ago } from '../core/util';
import { IconComponent } from '../shared/icon.component';

const ICON: Record<NotificationKind, string> = {
  grade: 'award', due: 'clock', missing: 'alert', announcement: 'megaphone', submission: 'inbox'
};

/**
 * The bell in the top bar. Items are derived on the server from grades, deadlines,
 * announcements and new hand-ins; which ones were read is remembered in this browser.
 */
@Component({
  selector: 'lh-bell',
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="btn btn-ghost btn-icon trigger" (click)="toggle()" [class.on]="open()"
            aria-haspopup="dialog" [attr.aria-expanded]="open()"
            [attr.aria-label]="unread() ? unread() + ' unread notifications' : 'Notifications'">
      <lh-icon name="bell" [class.ring]="unread() > 0" />
      @if (unread() > 0) { <span class="badge" aria-hidden="true">{{ unread() > 9 ? '9+' : unread() }}</span> }
    </button>
    @if (open()) {
      <div class="panel glass-panel pop" role="dialog" aria-label="Notifications">
        <div class="head">
          <strong>Notifications</strong>
          <button type="button" class="btn btn-ghost btn-sm" (click)="markAll()" [disabled]="!unread()">Mark all as read</button>
        </div>
        <div class="list">
          @if (data.isLoading() && !items().length) {
            <div class="skeleton" style="height:56px"></div><div class="skeleton" style="height:56px;margin-top:6px"></div>
          } @else {
            @for (n of items(); track n.key) {
              <a class="item" [class.unread]="!seen().has(n.key)" [routerLink]="n.link" (click)="openItem(n)">
                <span class="kind" [class]="n.kind"><lh-icon [name]="icon(n.kind)" class="sm" /></span>
                <span class="grow">
                  <span class="t">{{ n.title }}</span>
                  <span class="d">{{ n.detail }}@if (n.kind !== 'due') { · {{ ago(n.at) }} }</span>
                </span>
                @if (!seen().has(n.key)) { <span class="dot" aria-label="Unread"></span> }
              </a>
            } @empty {
              <div class="none">
                <lh-icon name="check-circle" />
                <strong>You're all caught up</strong>
                <span class="small muted">New grades, deadlines and announcements will show up here.</span>
              </div>
            }
          }
        </div>
      </div>
    }
  `,
  styles: [`
    :host { position: relative; display: inline-flex; }
    .trigger { position: relative; }
    .trigger.on { background: var(--surface-2); color: var(--ink); }
    .ring { transform-origin: 50% 15%; animation: bell-ring 1.1s var(--ease-out) 600ms 1 backwards; }
    @keyframes bell-ring { 0%, 100% { transform: rotate(0); } 15% { transform: rotate(14deg); } 30% { transform: rotate(-11deg); }
      45% { transform: rotate(7deg); } 60% { transform: rotate(-4deg); } 75% { transform: rotate(2deg); } }
    .badge { position: absolute; top: 4px; right: 3px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px;
      display: grid; place-items: center; background: var(--nav-grad); color: #fff; font-size: .68rem; font-weight: 800;
      box-shadow: 0 0 0 2px var(--surface); font-variant-numeric: tabular-nums; animation: lh-pop 240ms var(--ease-out) backwards; }

    .panel { position: absolute; z-index: 60; top: calc(100% + 10px); right: -6px; width: 380px; max-height: min(520px, 72vh);
      display: flex; flex-direction: column; border-radius: 16px; overflow: hidden; }
    .head { display: flex; align-items: center; justify-content: space-between; gap: .5rem; padding: .7rem .6rem .6rem 1rem; border-bottom: 1px solid var(--glass-line); }
    .list { overflow-y: auto; overscroll-behavior: contain; padding: .4rem; }
    .item { display: flex; align-items: flex-start; gap: .7rem; padding: .65rem .6rem; border-radius: 12px; color: inherit; text-decoration: none !important;
      transition: background 120ms var(--ease); }
    .item:hover { background: var(--violet-soft); }
    .item + .item { margin-top: 2px; }
    .kind { width: 32px; height: 32px; border-radius: 10px; display: grid; place-items: center; flex-shrink: 0; background: var(--surface-2); color: var(--ink-2); }
    .kind.grade { background: var(--ok-soft); color: var(--ok); }
    .kind.missing { background: var(--bad-soft); color: var(--bad); }
    .kind.submission { background: var(--warn-soft); color: var(--warn); }
    .t { display: block; font-weight: 600; line-height: 1.3; color: var(--ink-2); }
    .item.unread .t { font-weight: 700; color: var(--ink); }
    .d { display: block; font-size: .8rem; color: var(--muted); margin-top: 2px; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--violet); margin-top: 6px; flex-shrink: 0; }
    .none { display: flex; flex-direction: column; align-items: flex-start; gap: .3rem; padding: 1rem .6rem; color: var(--ok); }
    .none strong { color: var(--ink); }

    @media (max-width: 640px) {
      .panel { position: fixed; top: calc(64px + env(safe-area-inset-top)); left: 12px; right: 12px; width: auto; max-height: calc(100dvh - 180px); }
    }
  `]
})
export class BellComponent {
  private api = inject(Api);
  private auth = inject(Auth);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly open = signal(false);
  protected readonly data = rxResource({ loader: () => this.api.notifications() });
  protected readonly items = computed(() => this.data.value() ?? []);
  private readonly storeKey = computed(() => `lh-seen-${this.auth.user()?.id ?? 0}`);
  protected readonly seen = signal<Set<string>>(new Set());
  protected readonly unread = computed(() => this.items().filter(n => !this.seen().has(n.key)).length);
  protected readonly ago = ago;

  constructor() {
    this.seen.set(this.loadSeen());
    // Pick up new grades and hand-ins while the app stays open.
    const timer = setInterval(() => { if (!document.hidden) this.data.reload(); }, 120_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  protected icon(kind: NotificationKind) { return ICON[kind] ?? 'info'; }

  toggle() {
    this.open.update(v => !v);
    if (this.open()) this.data.reload();
  }

  protected openItem(n: AppNotification) {
    this.markSeen([n.key]);
    this.open.set(false);
  }

  protected markAll() { this.markSeen(this.items().map(n => n.key)); }

  private markSeen(keys: string[]) {
    const next = new Set(this.seen());
    keys.forEach(k => next.add(k));
    this.seen.set(next);
    try { localStorage.setItem(this.storeKey(), JSON.stringify([...next].slice(-400))); } catch { /* storage unavailable */ }
  }

  private loadSeen(): Set<string> {
    try { return new Set(JSON.parse(localStorage.getItem(this.storeKey()) ?? '[]') as string[]); }
    catch { return new Set(); }
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent) {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.open.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape() { this.open.set(false); }
}
