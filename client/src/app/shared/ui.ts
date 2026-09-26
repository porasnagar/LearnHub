import { DatePipe } from '@angular/common';
import {
  AfterViewInit, ChangeDetectionStrategy, Component, DestroyRef, Directive, ElementRef, computed, inject, input, signal, viewChild
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
    .halo { fill: #fff; opacity: .35; }
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

@Component({
  selector: 'lh-ring',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ring" [style.width.px]="size()" [style.height.px]="size()">
      <svg viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="50" class="track" />
        <circle cx="60" cy="60" r="50" class="bar" [style.stroke]="color()"
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
    circle { fill: none; stroke-width: 11; }
    .track { stroke: var(--line); }
    .bar { stroke-linecap: round; animation: draw 1.3s cubic-bezier(.2,.8,.2,1) both .15s; }
    @keyframes draw { from { stroke-dashoffset: var(--len); } }
    .center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
    .big { font-size: 1.9rem; font-weight: 600; line-height: 1; }
    .cap { font-size: .74rem; color: var(--muted); margin-top: .3rem; font-weight: 600; }
  `]
})
export class RingComponent {
  readonly percent = input(0);
  readonly center = input('');
  readonly caption = input<string | null>(null);
  readonly size = input(140);
  readonly color = input('var(--violet)');
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
            <div class="fill" [class.hl]="b.highlight" [style.height.%]="pct(b.value)" [style.animation-delay.ms]="150 + i * 70"></div>
          </div>
          <span class="lbl">{{ b.label }}</span>
        </div>
      }
    </div>`,
  styles: [`
    .bars { display: flex; align-items: stretch; gap: 10px; }
    .col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 0; }
    .track { flex: 1; width: 100%; display: flex; align-items: flex-end; border-radius: 14px; background: var(--line); overflow: hidden; }
    .fill { width: 100%; min-height: 6px; border-radius: 14px; background: var(--lemon); transform-origin: bottom; animation: grow 1s cubic-bezier(.2,.8,.2,1) both; }
    .fill.hl { background: var(--violet); }
    @keyframes grow { from { transform: scaleY(0); } }
    .lbl { font-size: .72rem; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
    .val { font-size: .75rem; font-weight: 700; color: var(--ink-2); }
  `]
})
export class BarsComponent {
  readonly bars = input<Bar[]>([]);
  readonly height = input(170);
  private readonly max = computed(() => Math.max(1, ...this.bars().map(b => b.value)));
  pct(v: number) { return (v / this.max()) * 100; }
}

// ---------- Count-up number ----------

@Directive({ selector: '[lhCountUp]' })
export class CountUpDirective implements AfterViewInit {
  readonly lhCountUp = input.required<number>();
  readonly decimals = input(0);
  private el = inject(ElementRef<HTMLElement>);

  ngAfterViewInit() {
    const target = this.lhCountUp();
    const el = this.el.nativeElement;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || target === 0) { el.textContent = target.toFixed(this.decimals()); return; }
    const start = performance.now(), dur = 1100;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / dur), eased = 1 - Math.pow(1 - p, 3);
      el.textContent = (target * eased).toFixed(this.decimals());
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}

// ---------- Date tile (mini calendar leaf) ----------

@Component({
  selector: 'lh-date-tile',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="m">{{ date() | date: 'MMM' }}</span><span class="d serif">{{ date() | date: 'd' }}</span>`,
  styles: [`
    :host { width: 50px; height: 54px; flex-shrink: 0; border-radius: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: var(--c, var(--lilac)); color: #16151c; line-height: 1; }
    .m { font-size: .62rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; opacity: .7; }
    .d { font-size: 1.35rem; font-weight: 700; margin-top: 3px; }
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
        <div class="cat">{{ c().category }}</div>
        <h3 class="title">{{ c().title }}</h3>
        <div class="sub">{{ c().instructorName }}</div>
        @if (auth.isStudent() && mine()) {
          <div class="prog">
            <div class="meter grow" [style.--fill]="'var(--c-deep)'"><span [style.width.%]="pct()"></span></div>
            <span class="small strong">{{ pct() }}%</span>
          </div>
          <div class="tiny muted">{{ c().mySubmitted }} of {{ c().assignmentCount }} assignments submitted</div>
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
    .banner { position: relative; height: 128px; background: var(--c); overflow: hidden; }
    .banner::after { content: ""; position: absolute; inset: 0; background: radial-gradient(circle at 15% 0%, rgba(255,255,255,.55), transparent 55%); }
    .tags { position: absolute; top: 14px; left: 14px; display: flex; gap: 6px; z-index: 2; }
    .code { display: inline-flex; align-items: center; gap: 4px; height: 26px; padding: 0 10px; border-radius: 999px; background: #16151c; color: #fff; font-size: .74rem; font-weight: 800; letter-spacing: .04em; }
    .code.ghost { background: rgba(255,255,255,.7); color: #16151c; }
    .art { position: absolute; right: -6px; bottom: -14px; width: 170px; height: 128px; transition: transform .5s cubic-bezier(.2,.8,.2,1); }
    .cc:hover .art { transform: translate(-6px, -6px) rotate(-3deg) scale(1.04); }
    .body { padding: 1rem 1.15rem 1.2rem; display: flex; flex-direction: column; gap: .3rem; flex: 1; }
    .cat { font-size: .72rem; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); }
    .title { font-size: 1.12rem; font-weight: 700; line-height: 1.3; letter-spacing: -.01em; }
    .sub { font-size: .86rem; color: var(--muted); }
    .prog { display: flex; align-items: center; gap: .6rem; margin-top: auto; padding-top: .6rem; }
    .meta { display: flex; flex-wrap: wrap; align-items: center; gap: .4rem .9rem; margin-top: auto; padding-top: .6rem; font-size: .84rem; color: var(--muted); }
    .meta span { display: inline-flex; align-items: center; gap: .3rem; }
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
      display: grid; place-items: center; cursor: pointer; color: var(--ink); background: var(--glass-strong);
      box-shadow: var(--shadow); animation: pop-in .25s var(--ease) both; }
    .arrow:hover { transform: scale(1.08); }
    .left { left: -4px; } .right { right: -4px; }
    @keyframes pop-in { from { opacity: 0; transform: scale(.8); } }
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
        <div class="toast glass" [class]="t.kind" role="status">
          <span class="dot"><lh-icon [name]="t.kind === 'error' ? 'alert' : t.kind === 'info' ? 'info' : 'check-circle'" /></span>
          <span class="grow">{{ t.text }}</span>
          <button class="btn btn-ghost btn-icon btn-sm" (click)="toasts.dismiss(t.id)" aria-label="Dismiss"><lh-icon name="x" class="sm" /></button>
        </div>
      }
    </div>
    @if (confirm.request(); as r) {
      <div class="scrim" (click)="confirm.close(false)">
        <div class="dialog card card-lg" role="alertdialog" aria-modal="true" [attr.aria-label]="r.title" (click)="$event.stopPropagation()">
          <div class="dicon" [class.danger]="r.danger"><lh-icon [name]="r.danger ? 'alert' : 'info'" class="lg" /></div>
          <h2 class="serif">{{ r.title }}</h2>
          <p class="muted mt-1">{{ r.message }}</p>
          <div class="row mt-3" style="justify-content:flex-end">
            <button class="btn btn-glass" (click)="confirm.close(false)">Cancel</button>
            <button class="btn" [class.btn-danger]="r.danger" [class.btn-ink]="!r.danger" (click)="confirm.close(true)" cdkFocusInitial>{{ r.confirmText }}</button>
          </div>
        </div>
      </div>
    }`,
  styles: [`
    .toasts { position: fixed; z-index: 2000; top: 18px; right: 18px; display: flex; flex-direction: column; gap: 10px; width: min(380px, calc(100vw - 36px)); }
    .toast { display: flex; align-items: center; gap: .7rem; padding: .7rem .6rem .7rem .8rem; border-radius: 18px; background: var(--glass-strong); font-weight: 600; font-size: .92rem;
      animation: in .45s cubic-bezier(.2,.8,.2,1) both; }
    @keyframes in { from { opacity: 0; transform: translateY(-10px) scale(.96); } }
    .dot { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; background: var(--ok-soft); color: var(--ok); flex-shrink: 0; }
    .error .dot { background: var(--bad-soft); color: var(--bad); }
    .info .dot { background: var(--info-soft); color: var(--info); }
    .scrim { position: fixed; inset: 0; z-index: 1900; display: grid; place-items: center; padding: 1rem; background: rgba(14, 12, 24, .35); backdrop-filter: blur(6px); animation: fade .25s both; }
    @keyframes fade { from { opacity: 0; } }
    .dialog { width: min(440px, 100%); background: var(--glass-strong); animation: pop .4s cubic-bezier(.2,.8,.2,1) both; }
    @keyframes pop { from { opacity: 0; transform: translateY(12px) scale(.96); } }
    .dialog h2 { font-size: 1.4rem; margin-top: .9rem; }
    .dicon { width: 52px; height: 52px; border-radius: 16px; display: grid; place-items: center; background: var(--violet-soft); color: var(--violet); }
    .dicon.danger { background: var(--bad-soft); color: var(--bad); }
  `]
})
export class OverlaysComponent {
  protected toasts = inject(Toasts);
  protected confirm = inject(Confirm);
}
