import { ChangeDetectionStrategy, Component, Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ACCENTS, Theme } from '../core/services';
import { IconComponent } from '../shared/icon.component';

export const APP_VERSION = '1.5';
const SEEN_KEY = 'lh-seen-version';

/** Opens the "What's new" card: once automatically after an update, and on demand. */
@Injectable({ providedIn: 'root' })
export class WhatsNew {
  readonly open = signal(false);

  /** Show once per version, a moment after the first page has rendered. */
  maybeShow() {
    let seen: string | null = null;
    try { seen = localStorage.getItem(SEEN_KEY); } catch { /* storage unavailable */ }
    if (seen !== APP_VERSION) setTimeout(() => this.open.set(true), 900);
  }

  show() { this.open.set(true); }

  close() {
    this.open.set(false);
    try { localStorage.setItem(SEEN_KEY, APP_VERSION); } catch { /* storage unavailable */ }
  }
}

@Component({
  selector: 'lh-whats-new',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (wn.open()) {
      <div class="scrim frost" (click)="wn.close()"></div>
      <div class="card-wn" role="dialog" aria-modal="true" aria-labelledby="wn-title">
        <div class="hero">
          <span class="orb" aria-hidden="true"></span>
          <span class="tag">LearnHub {{ version }}</span>
          <h2 id="wn-title" class="serif">Made to feel like yours</h2>
          <p>Pick a colour and the whole app follows it: highlights, glow, rings and the light behind every card.</p>
        </div>
        <div class="sw-row" role="radiogroup" aria-label="Accent colour">
          @for (a of accents; track a.hue) {
            <button type="button" class="sw" role="radio" [class.on]="theme.hue() === a.hue" [attr.aria-checked]="theme.hue() === a.hue"
                    [style.--h]="a.hue" [attr.aria-label]="a.name" [title]="a.name" (click)="theme.setHue(a.hue, $event)"></button>
          }
        </div>
        <ul class="list">
          @for (f of features; track f.title) {
            <li><span class="ic"><lh-icon [name]="f.icon" class="sm" /></span><span><strong>{{ f.title }}</strong><span class="d">{{ f.text }}</span></span></li>
          }
        </ul>
        <div class="actions">
          <button type="button" class="btn btn-ghost" (click)="openSettings()">More appearance options</button>
          <button type="button" class="btn btn-glow" (click)="wn.close()">Let's go <lh-icon name="arrow-right" class="sm" /></button>
        </div>
      </div>
    }
  `,
  styles: [`
    .scrim { position: fixed; inset: 0; z-index: 1900; background: rgba(17, 16, 22, .36); animation: lh-fade 260ms var(--ease-out) backwards; }
    .card-wn { position: fixed; z-index: 1901; left: 50%; top: 50%; width: min(460px, calc(100vw - 24px)); max-height: calc(100dvh - 24px); overflow-y: auto;
      transform: translate(-50%, -50%); background: var(--surface); border-radius: 22px; border: 1px solid var(--glass-line);
      box-shadow: var(--shadow-float), 0 0 80px -20px oklch(0.6 0.2 var(--hue) / .5); animation: wn-in 520ms var(--spring) backwards; }
    @keyframes wn-in { from { opacity: 0; transform: translate(-50%, -46%) scale(.94); } }
    .hero { position: relative; overflow: hidden; padding: 1.6rem 1.5rem 1.2rem; color: #fff; background: var(--nav-grad); }
    .orb { position: absolute; right: -60px; top: -70px; width: 220px; height: 220px; border-radius: 50%;
      background: radial-gradient(circle at 35% 35%, rgba(255,255,255,.55), rgba(255,255,255,.08) 60%, transparent 70%); animation: orb 6s var(--ease) infinite alternate; }
    @keyframes orb { to { transform: translate(-30px, 24px) scale(1.12); } }
    .tag { position: relative; display: inline-flex; height: 24px; align-items: center; padding: 0 .6rem; border-radius: 999px; background: rgba(255,255,255,.22);
      font-size: .76rem; font-weight: 800; letter-spacing: .01em; }
    h2 { position: relative; color: #fff; font-size: 1.7rem; margin-top: .6rem; }
    .hero p { position: relative; margin-top: .4rem; opacity: .92; line-height: 1.5; }
    .sw-row { display: flex; justify-content: space-between; gap: .35rem; padding: 1rem 1.5rem .2rem; }
    .sw { width: 30px; height: 30px; border-radius: 50%; border: 0; cursor: pointer; flex-shrink: 0;
      background: linear-gradient(135deg, oklch(0.66 0.17 var(--h)), oklch(0.45 0.2 var(--h)));
      transition: transform 260ms var(--spring), box-shadow 260ms var(--ease-out); }
    .sw:hover { transform: scale(1.12); }
    .sw.on { box-shadow: 0 0 0 3px var(--surface), 0 0 0 5px oklch(0.6 0.2 var(--h)); }
    .list { list-style: none; margin: 0; padding: .6rem 1.5rem 0; display: flex; flex-direction: column; gap: .2rem; }
    .list li { display: flex; gap: .8rem; align-items: flex-start; padding: .55rem 0; animation: lh-enter 420ms var(--ease-out) backwards; }
    .list li:nth-child(1) { animation-delay: 200ms; } .list li:nth-child(2) { animation-delay: 260ms; } .list li:nth-child(3) { animation-delay: 320ms; }
    .list li:nth-child(4) { animation-delay: 380ms; } .list li:nth-child(5) { animation-delay: 440ms; } .list li:nth-child(6) { animation-delay: 500ms; }
    .list li + li { border-top: 1px solid var(--line); }
    .ic { width: 34px; height: 34px; border-radius: 11px; display: grid; place-items: center; flex-shrink: 0; background: var(--violet-soft); color: var(--violet); }
    .list strong { display: block; color: var(--ink); }
    .d { display: block; font-size: .86rem; color: var(--muted); line-height: 1.45; }
    .actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: .5rem; padding: 1rem 1.5rem 1.3rem; }
    @media (max-width: 420px) { .actions .btn { flex: 1; } .sw { width: 26px; height: 26px; } }
  `]
})
export class WhatsNewComponent {
  protected wn = inject(WhatsNew);
  protected theme = inject(Theme);
  private router = inject(Router);
  protected version = APP_VERSION;
  protected accents = ACCENTS;
  protected features = [
    { icon: 'palette', title: 'Your colour, everywhere', text: 'Ten accents or any hue on the colour slider. It sweeps across the screen when you pick it.' },
    { icon: 'contrast', title: 'Auto theme', text: 'Light, Dark, or Auto: follows your device, even when it switches at sunset.' },
    { icon: 'search', title: 'Search everything', text: 'Press Ctrl + K (or /) to jump to any course, assignment or page.' },
    { icon: 'bell', title: 'Notifications', text: 'New grades, deadlines in the next 48 hours, missing work and announcements.' },
    { icon: 'calculator', title: 'What-if grades', text: 'Try scores for ungraded work and see what you need for the grade you want.' },
    { icon: 'gift', title: 'A little celebration', text: 'Hand in an assignment and see what happens.' },
  ];

  openSettings() {
    this.wn.close();
    this.router.navigate(['/profile'], { fragment: 'appearance' });
  }
}
