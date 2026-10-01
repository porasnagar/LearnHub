import { AfterViewInit, Directive, ElementRef, Injectable, NgZone, OnDestroy, effect, inject, input } from '@angular/core';

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * One highlight that glides to whichever direct child has `.active` — used by the sidebar,
 * the phone tab bar and segmented controls. Children keep their own `.active` styles until
 * the indicator is ready, so nothing breaks without it.
 */
@Directive({ selector: '[lhGlide]', host: { class: 'glide' } })
export class GlideDirective implements AfterViewInit, OnDestroy {
  private host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private zone = inject(NgZone);
  private ind = document.createElement('span');
  private mo?: MutationObserver;
  private ro?: ResizeObserver;
  private raf = 0;
  private shown = false;

  ngAfterViewInit() {
    this.zone.runOutsideAngular(() => {
      if (getComputedStyle(this.host).position === 'static') this.host.style.position = 'relative';
      this.ind.className = 'glide-ind';
      this.ind.setAttribute('aria-hidden', 'true');
      this.host.prepend(this.ind);
      this.place(false);
      requestAnimationFrame(() => this.host.classList.add('glide-ready'));
      // Route changes toggle `.active`; items can also change size (the tab bar's label expands).
      this.mo = new MutationObserver(() => this.follow());
      this.mo.observe(this.host, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
      this.ro = new ResizeObserver(() => this.place(false));
      this.ro.observe(this.host);
    });
  }

  ngOnDestroy() {
    this.mo?.disconnect();
    this.ro?.disconnect();
    cancelAnimationFrame(this.raf);
    this.ind.remove();
  }

  /** Track the active item for a moment, so it lands correctly while widths are still animating. */
  private follow() {
    cancelAnimationFrame(this.raf);
    this.place(true); // right away, so it's correct even if animation frames are paused (background tab)
    const end = performance.now() + 480;
    const tick = () => {
      this.place(true);
      if (performance.now() < end) this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private place(animate: boolean) {
    const a = this.host.querySelector<HTMLElement>(':scope > .active');
    if (!a) {
      this.ind.style.opacity = '0';
      this.shown = false;
      return;
    }
    const h = this.host.getBoundingClientRect();
    const r = a.getBoundingClientRect();
    const x = r.left - h.left - this.host.clientLeft + this.host.scrollLeft;
    const y = r.top - h.top - this.host.clientTop + this.host.scrollTop;
    const s = this.ind.style;
    const jump = !animate || !this.shown || reducedMotion();
    if (jump) s.transition = 'none';
    s.width = `${r.width}px`;
    s.height = `${r.height}px`;
    s.transform = `translate(${x}px, ${y}px)`;
    s.borderRadius = getComputedStyle(a).borderRadius;
    s.opacity = '1';
    if (jump) {
      void this.ind.offsetWidth; // commit the jump before transitions come back
      s.transition = '';
    }
    this.shown = true;
  }
}

/** Counts a number up to its value (and between values when it changes). */
@Directive({ selector: '[lhCountUp]' })
export class CountUpDirective implements OnDestroy {
  readonly value = input<number | null | undefined>(null, { alias: 'lhCountUp' });
  readonly decimals = input(0);
  readonly suffix = input('');
  readonly empty = input('–');

  private el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private zone = inject(NgZone);
  private current: number | null = null;
  private raf = 0;

  constructor() {
    effect(() => this.run(this.value()));
  }

  ngOnDestroy() { cancelAnimationFrame(this.raf); }

  private text(v: number) { return v.toFixed(this.decimals()) + this.suffix(); }

  private run(to: number | null | undefined) {
    cancelAnimationFrame(this.raf);
    if (to === null || to === undefined || Number.isNaN(to)) {
      this.el.textContent = this.empty();
      this.current = null;
      return;
    }
    if (reducedMotion()) {
      this.el.textContent = this.text(to);
      this.current = to;
      return;
    }
    const from = this.current ?? 0;
    const start = performance.now();
    const duration = 900;
    this.zone.runOutsideAngular(() => {
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        this.el.textContent = this.text(from + (to - from) * eased);
        if (t < 1) this.raf = requestAnimationFrame(tick);
        else this.current = to;
      };
      this.raf = requestAnimationFrame(tick);
    });
  }
}

/** Elements that answer a press with a ripple. They get position:relative + overflow:hidden in styles.scss. */
const RIPPLE = '.btn, .tab, .nav-link, .chip, .seg > a, .seg > button, a.due-row, button.due-row, .mini-day, .day, .res, .item, .demo-row, .theme-opt, .legend, .me';

/**
 * App-wide pointer effects, attached once: a soft ripple where you press, and on desktop
 * a light that follows the cursor across glass cards.
 */
@Injectable({ providedIn: 'root' })
export class Interactions {
  private zone = inject(NgZone);
  private started = false;
  private pending = false;

  start() {
    if (this.started) return;
    this.started = true;
    this.zone.runOutsideAngular(() => {
      document.addEventListener('pointerdown', this.ripple, { passive: true });
      if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
        document.addEventListener('pointermove', this.spot, { passive: true });
      }
    });
  }

  private ripple = (e: PointerEvent) => {
    if (e.button !== 0 || reducedMotion()) return;
    const host = (e.target as Element | null)?.closest?.<HTMLElement>(RIPPLE);
    if (!host || host.matches(':disabled')) return;
    const r = host.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2.2;
    const dot = document.createElement('span');
    dot.className = 'ripple';
    dot.setAttribute('aria-hidden', 'true');
    dot.style.width = dot.style.height = `${size}px`;
    dot.style.left = `${e.clientX - r.left - size / 2}px`;
    dot.style.top = `${e.clientY - r.top - size / 2}px`;
    host.appendChild(dot);
    dot.addEventListener('animationend', () => dot.remove(), { once: true });
    setTimeout(() => dot.remove(), 1200); // in case the animation never runs
  };

  private spot = (e: PointerEvent) => {
    if (this.pending) return;
    this.pending = true;
    requestAnimationFrame(() => {
      this.pending = false;
      const card = (e.target as Element | null)?.closest?.<HTMLElement>('.card') ?? null;
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${Math.round(e.clientX - r.left)}px`);
      card.style.setProperty('--my', `${Math.round(e.clientY - r.top)}px`);
    });
  };
}

/**
 * A short burst of confetti in the accent colour (plus the course pastels), fired from an element.
 * Drawn on a throwaway canvas outside Angular; skipped entirely under reduced motion.
 */
@Injectable({ providedIn: 'root' })
export class Celebrate {
  private zone = inject(NgZone);

  burst(from?: Element | null) {
    if (reducedMotion()) return;
    this.zone.runOutsideAngular(() => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const canvas = document.createElement('canvas');
      canvas.setAttribute('aria-hidden', 'true');
      canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:3000';
      canvas.width = innerWidth * dpr;
      canvas.height = innerHeight * dpr;
      document.body.appendChild(canvas);
      const ctx = canvas.getContext('2d');
      if (!ctx) { canvas.remove(); return; }
      ctx.scale(dpr, dpr);

      const root = getComputedStyle(document.documentElement);
      const hue = parseFloat(root.getPropertyValue('--hue')) || 283;
      const colors = [
        `oklch(0.62 0.21 ${hue})`, `oklch(0.75 0.15 ${hue})`, `oklch(0.5 0.2 ${hue})`,
        '#ffd9c2', '#c3ebd5', '#eeea9e', '#cbe1ff', '#ffffff',
      ];
      const r = from?.getBoundingClientRect();
      const ox = r ? r.left + r.width / 2 : innerWidth / 2;
      const oy = r ? r.top + r.height / 2 : innerHeight * 0.6;
      const parts = Array.from({ length: 140 }, () => {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9;
        const speed = 7 + Math.random() * 9;
        return {
          x: ox, y: oy, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
          w: 5 + Math.random() * 6, h: 8 + Math.random() * 8, rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.35,
          color: colors[Math.floor(Math.random() * colors.length)], round: Math.random() < 0.3,
        };
      });
      const start = performance.now();
      const duration = 2200;
      const frame = (now: number) => {
        const t = now - start;
        ctx.clearRect(0, 0, innerWidth, innerHeight);
        const fade = t > duration - 500 ? Math.max(0, (duration - t) / 500) : 1;
        for (const p of parts) {
          p.vy += 0.32;          // gravity
          p.vx *= 0.985;         // air
          p.vy *= 0.985;
          p.x += p.vx;
          p.y += p.vy;
          p.rot += p.vr;
          ctx.save();
          ctx.globalAlpha = fade;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2); ctx.fill(); }
          else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.rot * 2)) + 1);
          ctx.restore();
        }
        if (t < duration) requestAnimationFrame(frame);
        else canvas.remove();
      };
      requestAnimationFrame(frame);
      setTimeout(() => canvas.remove(), duration + 500); // in case frames are paused
    });
  }
}
