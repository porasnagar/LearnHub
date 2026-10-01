import { ChangeDetectionStrategy, Component, ElementRef, HostListener, inject, input, signal } from '@angular/core';
import { ACCENTS, Theme } from '../core/services';
import { IconComponent } from './icon.component';
import { GlideDirective } from './motion';

/** Theme (Light / Dark / Auto) and accent colour: preset swatches plus a full-spectrum slider. */
@Component({
  selector: 'lh-appearance',
  imports: [IconComponent, GlideDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="label">Theme</div>
    <div class="seg modes" lhGlide role="radiogroup" aria-label="Theme">
      <button type="button" role="radio" [class.active]="theme.pref() === 'light'" [attr.aria-checked]="theme.pref() === 'light'" (click)="theme.setPref('light', $event)">
        <lh-icon name="sun" class="sm" /> Light</button>
      <button type="button" role="radio" [class.active]="theme.pref() === 'dark'" [attr.aria-checked]="theme.pref() === 'dark'" (click)="theme.setPref('dark', $event)">
        <lh-icon name="moon" class="sm" /> Dark</button>
      <button type="button" role="radio" [class.active]="theme.pref() === 'auto'" [attr.aria-checked]="theme.pref() === 'auto'" (click)="theme.setPref('auto', $event)">
        <lh-icon name="contrast" class="sm" /> Auto</button>
    </div>
    @if (theme.pref() === 'auto') { <p class="hint">Follows your device: {{ theme.mode() }} right now.</p> }

    <div class="label row-between">
      <span>Accent colour</span>
      <span class="name"><span class="dot"></span>{{ theme.accentName() }}</span>
    </div>
    <div class="swatches" role="radiogroup" aria-label="Accent colour">
      @for (a of accents; track a.hue) {
        <button type="button" class="sw" role="radio" [class.on]="theme.hue() === a.hue" [attr.aria-checked]="theme.hue() === a.hue"
                [style.--h]="a.hue" [attr.aria-label]="a.name" [title]="a.name" (click)="theme.setHue(a.hue, $event)">
          <lh-icon name="check" class="sm tick" />
        </button>
      }
    </div>

    <label class="label" [attr.for]="sliderId">Any colour you like</label>
    <input [id]="sliderId" class="hue" type="range" min="0" max="359" step="1" [value]="theme.hue()"
           (input)="slide($event)" aria-label="Accent hue" />
    @if (!compact()) {
      <div class="preview" aria-hidden="true">
        <span class="pv-btn">Primary</span>
        <span class="pv-chip">Selected</span>
        <span class="pv-link">A link</span>
        <span class="pv-today">1</span>
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
    .label { display: flex; align-items: center; justify-content: space-between; gap: .5rem; font-size: .82rem; font-weight: 700; color: var(--ink-2); margin: 1rem 0 .5rem; }
    .label:first-child { margin-top: 0; }
    .modes { display: flex; width: 100%; }
    .modes button { flex: 1; justify-content: center; }
    .hint { margin-top: .4rem; font-size: .8rem; color: var(--muted); }
    .name { display: inline-flex; align-items: center; gap: .4rem; font-weight: 700; color: var(--ink); }
    .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--nav-grad); box-shadow: 0 0 10px oklch(0.6 0.2 var(--hue) / .6); }
    .swatches { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: .55rem; }
    .sw { aspect-ratio: 1; width: 100%; max-width: 46px; justify-self: center; border-radius: 50%; border: 0; cursor: pointer; display: grid; place-items: center; color: #fff;
      background: linear-gradient(135deg, oklch(0.66 0.17 var(--h)), oklch(0.5 0.2 var(--h)) 55%, oklch(0.4 0.19 var(--h)));
      box-shadow: 0 6px 14px -8px oklch(0.5 0.2 var(--h) / .9), inset 0 1px 0 rgba(255,255,255,.35);
      transition: transform 260ms var(--spring), box-shadow 260ms var(--ease-out); }
    .sw:hover { transform: translateY(-2px) scale(1.06); }
    .sw:active { transform: scale(.92); }
    .sw .tick { opacity: 0; transform: scale(.4); transition: opacity 200ms var(--ease-out), transform 300ms var(--spring); }
    .sw.on { box-shadow: 0 0 0 3px var(--surface), 0 0 0 5px oklch(0.6 0.2 var(--h)), 0 8px 20px -6px oklch(0.55 0.2 var(--h) / .8); }
    .sw.on .tick { opacity: 1; transform: none; }

    /* Full-spectrum slider: the track is the hue wheel itself. */
    .hue { width: 100%; height: 26px; margin: 0; appearance: none; -webkit-appearance: none; background: transparent; cursor: pointer; }
    .hue::-webkit-slider-runnable-track { height: 12px; border-radius: 999px; box-shadow: inset 0 0 0 1px rgba(0,0,0,.06);
      background: linear-gradient(to right, oklch(.62 .19 0), oklch(.62 .19 30), oklch(.62 .19 60), oklch(.62 .19 90), oklch(.62 .19 120), oklch(.62 .19 150),
        oklch(.62 .19 180), oklch(.62 .19 210), oklch(.62 .19 240), oklch(.62 .19 270), oklch(.62 .19 300), oklch(.62 .19 330), oklch(.62 .19 360)); }
    .hue::-moz-range-track { height: 12px; border-radius: 999px;
      background: linear-gradient(to right, oklch(.62 .19 0), oklch(.62 .19 60), oklch(.62 .19 120), oklch(.62 .19 180), oklch(.62 .19 240), oklch(.62 .19 300), oklch(.62 .19 360)); }
    .hue::-webkit-slider-thumb { -webkit-appearance: none; width: 24px; height: 24px; margin-top: -6px; border-radius: 50%;
      background: var(--violet); border: 3px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,.3), 0 0 14px oklch(0.6 0.2 var(--hue) / .7);
      transition: transform 160ms var(--ease-out); }
    .hue:active::-webkit-slider-thumb { transform: scale(1.18); }
    .hue::-moz-range-thumb { width: 20px; height: 20px; border-radius: 50%; background: var(--violet); border: 3px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,.3); }

    .preview { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; margin-top: 1rem; padding: .8rem; border-radius: var(--r-ctl);
      background: var(--accent-tint); border: 1px dashed oklch(0.6 0.15 var(--hue) / .35); }
    .pv-btn { height: 32px; padding: 0 .9rem; border-radius: 10px; display: inline-grid; place-items: center; background: var(--nav-grad); color: #fff;
      font-weight: 700; font-size: .84rem; box-shadow: var(--nav-glow); }
    .pv-chip { height: 28px; padding: 0 .75rem; border-radius: 999px; display: inline-grid; place-items: center; font-size: .8rem; font-weight: 700;
      color: var(--violet); background: var(--violet-soft); }
    .pv-link { color: var(--violet); font-weight: 700; font-size: .86rem; text-decoration: underline; text-underline-offset: 3px; }
    .pv-today { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; background: var(--nav-grad); color: #fff; font-weight: 800; font-size: .8rem;
      box-shadow: 0 6px 14px -4px oklch(0.52 0.2 var(--hue) / .65); margin-left: auto; }
  `]
})
export class AppearanceComponent {
  protected theme = inject(Theme);
  protected accents = ACCENTS;
  /** Compact: no preview strip (used inside the small menu). */
  readonly compact = input(false);
  protected sliderId = `hue-${Math.random().toString(36).slice(2, 7)}`;

  // Dragging recolours live (no reveal animation); each value is saved as you go.
  slide(e: Event) { this.theme.setHue(+(e.target as HTMLInputElement).value, null, false); }
}

/** The sidebar entry: a colour dot that opens Appearance in a small floating panel. */
@Component({
  selector: 'lh-appearance-menu',
  imports: [IconComponent, AppearanceComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="nav-link" (click)="open.set(!open())" [attr.aria-expanded]="open()" aria-haspopup="dialog">
      <lh-icon name="palette" /><span class="grow">Appearance</span><span class="dot" aria-hidden="true"></span>
    </button>
    @if (open()) {
      <div class="pop-panel pop" role="dialog" aria-label="Appearance">
        <div class="head"><strong>Appearance</strong>
          <button type="button" class="btn btn-ghost btn-icon btn-sm" (click)="open.set(false)" aria-label="Close"><lh-icon name="x" class="sm" /></button></div>
        <lh-appearance [compact]="true" />
      </div>
    }
  `,
  styles: [`
    :host { position: relative; display: block; }
    .nav-link { display: flex; align-items: center; gap: .75rem; height: 42px; padding: 0 .75rem; border-radius: var(--r-ctl); border: 0; background: transparent; width: 100%;
      color: var(--ink-2); font-weight: 600; font-size: .95rem; cursor: pointer; transition: background var(--dur) var(--ease), color var(--dur) var(--ease); text-align: left; }
    .nav-link:hover, .nav-link[aria-expanded="true"] { background: var(--accent-tint); color: var(--ink); }
    .dot { width: 14px; height: 14px; border-radius: 50%; background: var(--nav-grad); box-shadow: 0 0 0 2px var(--surface), 0 0 12px oklch(0.6 0.2 var(--hue) / .7); }
    .pop-panel { position: absolute; z-index: 70; left: calc(100% + 16px); bottom: -8px; width: 320px; padding: .9rem 1rem 1rem;
      background: var(--surface); border: 1px solid var(--glass-line); border-radius: 18px; box-shadow: var(--shadow-float), 0 0 40px -10px oklch(0.6 0.2 var(--hue) / .35);
      transform-origin: bottom left; }
    .head { display: flex; align-items: center; justify-content: space-between; margin-bottom: .6rem; }
  `]
})
export class AppearanceMenuComponent {
  protected open = signal(false);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  @HostListener('document:click', ['$event'])
  onDoc(e: MouseEvent) { if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.open.set(false); }

  @HostListener('document:keydown.escape')
  onEsc() { this.open.set(false); }
}
