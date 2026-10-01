import { DatePipe } from '@angular/common';
import {
  AfterViewInit, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, inject, input, signal, viewChild
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CourseCard } from '../core/models';
import { Auth, Confirm, Toasts } from '../core/services';
import { ArtKind, artFor, avatarTone, initials, toneStyle } from '../core/util';
import { IconComponent } from './icon.component';

// ---------- Avatar ----------

@Component({
  selector: 'lh-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="avatar {{ size() }} {{ tone() }}" [attr.title]="name()">{{ letters() }}</span>`,
  styles: [`:host { display: inline-flex; }`]
})
export class AvatarComponent {
  readonly name = input.required<string>();
  readonly size = input<'' | 'sm' | 'lg'>('');
  readonly letters = computed(() => initials(this.name()));
  readonly tone = computed(() => avatarTone(this.name()));
}

// ---------- Course illustration (flat, sticker-style SVG per subject) ----------

@Component({
  selector: 'lh-course-art',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 160 120" aria-hidden="true">
      <circle cx="112" cy="58" r="46" class="halo" />
      @switch (kind()) {
        @case ('web') {
          <rect x="44" y="24" width="96" height="70" rx="12" class="w" />
          <path d="M44 42h96" class="s" />
          <circle cx="56" cy="33" r="3" class="deep" /><circle cx="66" cy="33" r="3" class="ink" /><circle cx="76" cy="33" r="3" class="w-s" />
          <path d="M80 58l-10 10 10 10M106 58l10 10-10 10M97 54l-8 28" class="s" />
          <rect x="24" y="68" width="38" height="28" rx="9" class="deep s" /><path d="M33 82h20" class="s-w" />
        }
        @case ('data') {
          <path d="M72 80v14c0 5.5 13 10 30 10s30-4.5 30-10V80" class="w s" />
          <path d="M72 58v22c0 5.5 13 10 30 10s30-4.5 30-10V58" class="deep s" />
          <path d="M72 36v22c0 5.5 13 10 30 10s30-4.5 30-10V36" class="w s" />
          <ellipse cx="102" cy="36" rx="30" ry="10" class="w s" />
          <rect x="26" y="62" width="34" height="22" rx="11" class="ink" /><circle cx="37" cy="73" r="5" class="lemon" />
        }
        @case ('flow') {
          <path d="M64 44h26M110 58v16M86 86h20" class="s" />
          <rect x="34" y="30" width="30" height="28" rx="9" class="w s" />
          <rect x="90" y="30" width="42" height="28" rx="14" class="deep s" />
          <rect x="56" y="72" width="30" height="28" rx="9" class="w s" />
          <circle cx="118" cy="86" r="14" class="w s" /><path d="M112 86l4 4 8-8" class="s" />
        }
        @case ('code') {
          <rect x="44" y="24" width="98" height="70" rx="12" class="ink" />
          <path d="M66 46l-10 13 10 13M120 46l10 13-10 13" class="s-c" />
          <rect x="80" y="52" width="24" height="5" rx="2.5" class="pastel" /><rect x="80" y="62" width="14" height="5" rx="2.5" class="deep" />
          <rect x="24" y="70" width="40" height="30" rx="9" class="w s" /><path d="M33 80h22M33 89h14" class="s" />
        }
        @case ('design') {
          <circle cx="68" cy="72" r="24" class="w s" />
          <rect x="86" y="26" width="46" height="46" rx="12" class="deep s" />
          <path d="M98 100l18-30 18 30z" class="lemon s" />
          <circle cx="68" cy="72" r="6" class="ink" />
        }
        @case ('math') {
          <rect x="46" y="28" width="46" height="46" rx="12" class="w s" />
          <path d="M60 40h18M60 40l10 11-10 11h18" class="s" />
          <rect x="96" y="50" width="42" height="42" rx="12" class="deep s" />
          <path d="M117 62v18M108 71h18" class="s-w" />
          <circle cx="40" cy="92" r="10" class="lemon s" />
        }
        @default {
          <path d="M40 38c14-6 28-6 42 4v54c-14-10-28-10-42-4z" class="w s" />
          <path d="M124 38c-14-6-28-6-42 4v54c14-10 28-10 42-4z" class="deep s" />
          <path d="M50 54h20M50 64h16M94 54h20" class="s" />
        }
      }
    </svg>`,
  styles: [`
    :host { display: block; }
    svg { width: 100%; height: 100%; overflow: visible; }
    .halo { fill: #fff; opacity: .3; }
    .w { fill: #fff; } .w-s { fill: #fff; stroke: #16151c; stroke-width: 2; }
    .ink { fill: #16151c; } .lemon { fill: #e9e58e; } .pastel { fill: var(--c); }
    .deep { fill: var(--c-deep); }
    .s { stroke: #16151c; stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round; }
    path.s:not(.w):not(.deep):not(.lemon) { fill: none; }
    .s-w { stroke: #fff; stroke-width: 3; stroke-linecap: round; fill: none; }
    .s-c { stroke: var(--c); stroke-width: 4; stroke-linecap: round; stroke-linejoin: round; fill: none; }
  `]
})
export class CourseArtComponent {
  readonly kind = input<ArtKind>('book');
}

// ---------- Donut ring ----------

let ringIds = 0;

@Component({
  selector: 'lh-ring',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ring" [style.width.px]="size()" [style.height.px]="size()">
      <svg viewBox="0 0 120 120">
        <defs>
          <linearGradient [attr.id]="gid" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#a48dff" /><stop offset=".55" stop-color="#6e52f3" /><stop offset="1" stop-color="#4b31cf" />
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r="50" class="track" />
        <circle cx="60" cy="60" r="50" class="bar" [style.stroke]="color() ?? 'url(#' + gid + ')'"
                [attr.stroke-dasharray]="len" [attr.stroke-dashoffset]="offset()" [style.--len]="len" />
      </svg>
      <div class="center">
        <div class="big serif">{{ center() }}</div>
        @if (caption()) { <div class="cap">{{ caption() }}</div> }
      </div>
    </div>`,
  styles: [`
    .ring { position: relative; }
    svg { width: 100%; height: 100%; transform: rotate(-90deg); }
    circle { fill: none; stroke-width: 10; }
    .track { stroke: var(--surface-2); }
    .bar { stroke-linecap: round; transition: stroke-dashoffset 500ms var(--ease-out); filter: drop-shadow(0 4px 8px rgba(91, 69, 224, .35));
      animation: ring-draw 1000ms var(--ease-out) 150ms backwards; }
    @keyframes ring-draw { from { stroke-dashoffset: calc(var(--len) * 1px); } }
    .center { animation: lh-fade 400ms var(--ease-out) 250ms backwards; }
    .center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
    .big { font-size: 1.8rem; font-weight: 600; line-height: 1; font-variant-numeric: tabular-nums; }
    .cap { font-size: .8rem; color: var(--muted); margin-top: .3rem; font-weight: 600; }
  `]
})
export class RingComponent {
  readonly percent = input(0);
  readonly center = input('');
  readonly caption = input<string | null>(null);
  readonly size = input(140);
  /** Defaults to the purple gradient; pass a colour to override. */
  readonly color = input<string | null>(null);
  protected readonly gid = `lh-ring-${++ringIds}`;
  readonly len = 2 * Math.PI * 50;
  readonly offset = computed(() => this.len * (1 - Math.max(0, Math.min(100, this.percent())) / 100));
}

// ---------- Bar chart ----------

export interface Bar { label: string; value: number; highlight?: boolean; }

@Component({
  selector: 'lh-bars',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bars" [style.height.px]="height()">
      @for (b of bars(); track b.label; let i = $index) {
        <div class="col" [attr.title]="b.label + ': ' + b.value">
          <span class="val">{{ b.value }}</span>
          <div class="track">
            <div class="fill" [class.hl]="b.highlight" [style.height.%]="pct(b.value)" [style.--i]="i"></div>
          </div>
          <span class="lbl" [class.hl]="b.highlight">{{ b.label }}</span>
        </div>
      }
    </div>`,
  styles: [`
    .bars { display: flex; align-items: stretch; gap: 8px; }
    .col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 0; }
    .track { flex: 1; width: 100%; display: flex; align-items: flex-end; border-radius: 8px; background: var(--surface-2); overflow: hidden; }
    .fill { width: 100%; min-height: 3px; border-radius: 8px; background: var(--line-strong);
      transform-origin: bottom; animation: lh-grow-y 700ms var(--ease-out) backwards; animation-delay: calc(var(--i, 0) * 55ms + 100ms);
      transition: height 400ms var(--ease-out); }
    /* Today is the current selection → violet; other days stay neutral. */
    .fill.hl { background: var(--nav-grad); box-shadow: 0 6px 16px -6px rgba(91, 69, 224, .7); }
    .lbl { font-size: .78rem; font-weight: 600; color: var(--muted); }
    .lbl.hl { color: var(--ink); font-weight: 700; }
    .val { font-size: .78rem; font-weight: 700; color: var(--ink-2); font-variant-numeric: tabular-nums; }
  `]
})
export class BarsComponent {
  readonly bars = input<Bar[]>([]);
  readonly height = input(170);
  private readonly max = computed(() => Math.max(1, ...this.bars().map(b => b.value)));
  pct(v: number) { return (v / this.max()) * 100; }
}

// ---------- Date tile (mini calendar leaf, tinted with the course colour) ----------

@Component({
  selector: 'lh-date-tile',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="m">{{ date() | date: 'MMM' }}</span><span class="d">{{ date() | date: 'd' }}</span>`,
  styles: [`
    :host { width: 46px; height: 50px; flex-shrink: 0; border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: var(--c, var(--surface-2)); color: #17161d; line-height: 1; }
    .m { font-size: .72rem; font-weight: 600; opacity: .72; }
    .d { font-size: 1.25rem; font-weight: 700; margin-top: 3px; font-variant-numeric: tabular-nums; }
  `]
})
export class DateTileComponent {
  readonly date = input.required<string>();
}

// ---------- Course card ----------

@Component({
  selector: 'lh-course-card',
  imports: [RouterLink, CourseArtComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="cc card card-flush link-card" [routerLink]="['/courses', c().id]" [attr.style]="style()">
      <div class="banner">
        <div class="tags">
          <span class="code">{{ c().code }}</span>
          @if (!c().isPublished) { <span class="code ghost">Draft</span> }
          @if (c().isEnrolled && !mine()) { <span class="code ghost"><lh-icon name="check" class="sm" /> Enrolled</span> }
        </div>
        <lh-course-art class="art" [kind]="kind()" />
      </div>
      <div class="body">
        <h3 class="title">{{ c().title }}</h3>
        <div class="sub">{{ c().instructorName }} · {{ c().category }}</div>
        @if (auth.isStudent() && mine()) {
          <div class="prog">
            <div class="meter grow" [style.--fill]="'var(--c-deep)'"><span [style.width.%]="pct()"></span></div>
            <span class="small strong tabnum">{{ c().mySubmitted }}/{{ c().assignmentCount }}</span>
          </div>
          <div class="tiny muted">assignments handed in</div>
        } @else {
          <div class="meta">
            <span><lh-icon name="people" class="sm" /> {{ c().studentCount }}</span>
            <span><lh-icon name="assignment" class="sm" /> {{ c().assignmentCount }}</span>
            <span><lh-icon name="cap" class="sm" /> {{ c().credits }} cr</span>
            @if (mine() && c().toGrade > 0) { <span class="status pending">{{ c().toGrade }} to grade</span> }
          </div>
        }
      </div>
    </a>`,
  styles: [`
    .cc { display: flex; flex-direction: column; height: 100%; color: inherit; text-decoration: none !important; }
    .banner { position: relative; height: 112px; background: var(--c); overflow: hidden; }
    .tags { position: absolute; top: 12px; left: 12px; display: flex; gap: 6px; z-index: 2; }
    .code { display: inline-flex; align-items: center; gap: 4px; height: 24px; padding: 0 9px; border-radius: 7px; background: #17161d; color: #fff; font-size: .76rem; font-weight: 700; }
    .code.ghost { background: rgba(255,255,255,.78); color: #17161d; }
    .art { position: absolute; right: -6px; bottom: -14px; width: 160px; height: 120px; transition: transform 500ms var(--spring); }
    @media (hover: hover) { .cc:hover .art { transform: translate(-6px, -8px) rotate(-4deg) scale(1.04); } }
    .banner::after { content: ""; position: absolute; inset: 0; pointer-events: none;
      background: radial-gradient(120% 90% at 0% 0%, rgba(255,255,255,.45), transparent 55%); }
    .body { padding: .9rem 1rem 1rem; display: flex; flex-direction: column; gap: .25rem; flex: 1; }
    .title { font-size: 1.05rem; font-weight: 700; line-height: 1.3; }
    .sub { font-size: .86rem; color: var(--muted); }
    .prog { display: flex; align-items: center; gap: .6rem; margin-top: auto; padding-top: .7rem; }
    .meta { display: flex; flex-wrap: wrap; align-items: center; gap: .4rem .9rem; margin-top: auto; padding-top: .7rem; font-size: .86rem; color: var(--muted); }
    .meta span { display: inline-flex; align-items: center; gap: .3rem; font-variant-numeric: tabular-nums; }
  `]
})
export class CourseCardComponent {
  protected auth = inject(Auth);
  readonly c = input.required<CourseCard>();
  /** True on "my courses" views (shows progress / grading counts). */
  readonly mine = input(false);
  readonly style = computed(() => toneStyle(this.c().id));
  readonly kind = computed(() => artFor(this.c().category));
  readonly pct = computed(() => this.c().assignmentCount ? Math.round(this.c().mySubmitted * 100 / this.c().assignmentCount) : 0);
}

// ---------- Horizontal scroller with arrow buttons (chip rows) ----------

/**
 * Wraps a row of chips. Shows ‹ › buttons and edge fades only when the row overflows,
 * so it works for any number of items.
 */
@Component({
  selector: 'lh-scroller',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (canLeft()) {
      <button type="button" class="arrow left glass" (click)="scrollBy(-1)" aria-label="Scroll left"><lh-icon name="chevron-left" class="sm" /></button>
    }
    <div #track class="track" [class.fade-l]="canLeft()" [class.fade-r]="canRight()" (scroll)="update()">
      <ng-content />
    </div>
    @if (canRight()) {
      <button type="button" class="arrow right glass" (click)="scrollBy(1)" aria-label="Scroll right"><lh-icon name="chevron-right" class="sm" /></button>
    }`,
  styles: [`
    :host { position: relative; display: block; min-width: 0; max-width: 100%; }
    .track { display: flex; gap: .5rem; overflow-x: auto; scroll-behavior: smooth; scrollbar-width: none; padding: 2px 0; }
    .track::-webkit-scrollbar { display: none; }
    .track.fade-r { mask-image: linear-gradient(to right, #000 calc(100% - 64px), transparent); }
    .track.fade-l { mask-image: linear-gradient(to left, #000 calc(100% - 64px), transparent); }
    .track.fade-l.fade-r { mask-image: linear-gradient(to right, transparent, #000 64px, #000 calc(100% - 64px), transparent); }
    .arrow { position: absolute; top: 50%; z-index: 2; width: 34px; height: 34px; margin-top: -17px; border-radius: 50%;
      display: grid; place-items: center; cursor: pointer; color: var(--ink); background: var(--surface);
      border: 1px solid var(--line-strong); box-shadow: var(--shadow-float); }
    .arrow:hover { background: var(--surface-2); }
    .left { left: -2px; } .right { right: -2px; }
  `]
})
export class ScrollerComponent implements AfterViewInit {
  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');
  protected readonly canLeft = signal(false);
  protected readonly canRight = signal(false);
  private readonly destroyRef = inject(DestroyRef);

  ngAfterViewInit() {
    const el = this.track().nativeElement;
    // Re-check when the row resizes or its chips change (e.g. data arrives).
    const ro = new ResizeObserver(() => this.update());
    ro.observe(el);
    const mo = new MutationObserver(() => this.update());
    mo.observe(el, { childList: true, subtree: true });
    this.destroyRef.onDestroy(() => { ro.disconnect(); mo.disconnect(); });
    this.update();
  }

  update() {
    const el = this.track().nativeElement;
    this.canLeft.set(el.scrollLeft > 4);
    this.canRight.set(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  scrollBy(dir: 1 | -1) {
    const el = this.track().nativeElement;
    el.scrollBy({ left: dir * el.clientWidth * 0.7 });
  }
}

// ---------- Empty state ----------

@Component({
  selector: 'lh-empty',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="empty"><lh-icon [name]="icon()" /><strong>{{ title() }}</strong>@if (text()) {<span class="small">{{ text() }}</span>}<ng-content /></div>`
})
export class EmptyComponent {
  readonly icon = input('info');
  readonly title = input.required<string>();
  readonly text = input<string | null>(null);
}

// ---------- Toasts & confirm dialog (rendered once in the root) ----------

@Component({
  selector: 'lh-overlays',
  imports: [IconComponent],
  template: `
    <div class="toasts" aria-live="polite">
      @for (t of toasts.items(); track t.id) {
        <div class="toast glass-panel" [class]="t.kind" role="status">
          <lh-icon class="dot" [name]="t.kind === 'error' ? 'alert' : t.kind === 'info' ? 'info' : 'check-circle'" />
          <span class="grow">{{ t.text }}</span>
          <button class="btn btn-ghost btn-icon btn-sm" (click)="toasts.dismiss(t.id)" aria-label="Dismiss"><lh-icon name="x" class="sm" /></button>
        </div>
      }
    </div>
    @if (confirm.request(); as r) {
      <div class="scrim frost" (click)="confirm.close(false)">
        <div class="dialog card card-lg glass-panel" role="alertdialog" aria-modal="true" [attr.aria-label]="r.title" (click)="$event.stopPropagation()">
          <h2 class="row" [class.danger]="r.danger"><lh-icon [name]="r.danger ? 'alert' : 'info'" />{{ r.title }}</h2>
          <p class="muted mt-1">{{ r.message }}</p>
          <div class="row mt-3" style="justify-content:flex-end">
            <button class="btn btn-glass" (click)="confirm.close(false)">Cancel</button>
            <button class="btn" [class.btn-danger]="r.danger" [class.btn-ink]="!r.danger" (click)="confirm.close(true)" cdkFocusInitial>{{ r.confirmText }}</button>
          </div>
        </div>
      </div>
    }`,
  styles: [`
    .toasts { position: fixed; z-index: 2000; top: 16px; right: 16px; display: flex; flex-direction: column; gap: 8px; width: min(380px, calc(100vw - 32px)); }
    @media (max-width: 640px) { .toasts { right: 16px; left: 16px; width: auto; top: calc(10px + env(safe-area-inset-top)); } }
    .toast { display: flex; align-items: center; gap: .65rem; padding: .55rem .4rem .55rem .85rem; border-radius: var(--r-ctl);
      font-weight: 600; font-size: .92rem;
      animation: in 280ms var(--ease-out) backwards; }
    @keyframes in { from { opacity: 0; transform: translateY(-10px) scale(.98); } }
    .dot { color: var(--ok); }
    .error .dot { color: var(--bad); }
    .info .dot { color: var(--info); }
    .scrim { position: fixed; inset: 0; z-index: 1900; display: grid; place-items: center; padding: 1rem; background: rgba(17, 16, 22, .4); animation: fade 200ms var(--ease-out) backwards; }
    @keyframes fade { from { opacity: 0; } }
    .dialog { width: min(440px, 100%); box-shadow: var(--shadow-float); animation: lh-sheet 260ms var(--ease-out) backwards; }
    .dialog h2 { font-size: 1.2rem; gap: .55rem; }
    .dialog h2.danger lh-icon { color: var(--bad); }
  `]
})
export class OverlaysComponent {
  protected toasts = inject(Toasts);
  protected confirm = inject(Confirm);
}
