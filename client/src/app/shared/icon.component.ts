import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

/**
 * LearnHub's own duotone icon set, drawn on a 24px grid: a 1.8px rounded outline
 * plus one soft filled accent shape (class "d"). Paths are constants in this file.
 */
const D = 'class="d"';
const ICONS: Record<string, string> = {
  home: `<path ${D} d="M13 3.5h5a2.5 2.5 0 0 1 2.5 2.5v3a2.5 2.5 0 0 1-2.5 2.5h-5z"/><rect x="3.5" y="3.5" width="7.5" height="9.5" rx="2.5"/><rect x="13" y="3.5" width="7.5" height="7.5" rx="2.5"/><rect x="13" y="13.5" width="7.5" height="7" rx="2.5"/><rect x="3.5" y="15.5" width="7.5" height="5" rx="2.5"/>`,
  courses: `<path ${D} d="M10 3.5h4v6.5l-2-1.5-2 1.5z"/><path d="M6.5 3.5h11a1.5 1.5 0 0 1 1.5 1.5v14.5H7.5A2.5 2.5 0 0 1 5 17V5a1.5 1.5 0 0 1 1.5-1.5z"/><path d="M5 17a2.5 2.5 0 0 1 2.5-2.5H19"/><path d="M10 3.5v6.5l2-1.5 2 1.5V3.5"/>`,
  calendar: `<rect ${D} x="13" y="13.5" width="4" height="4" rx="1.2"/><rect x="3.5" y="5" width="17" height="15.5" rx="4"/><path d="M3.5 10h17M8 3v4M16 3v4"/>`,
  grades: `<path ${D} d="M14.5 3.5V8h4.5z"/><path d="M6.5 3.5h8L19 8v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1.5-1.5z"/><path d="M8.3 17l2.2-6 2.2 6M9 15.2h3M15.5 12.5v3M14 14h3"/>`,
  explore: `<path ${D} d="M15 9l-1.8 4.2L9 15l1.8-4.2z"/><circle cx="12" cy="12" r="8.5"/><path d="M15 9l-1.8 4.2L9 15l1.8-4.2z"/>`,
  admin: `<path ${D} d="M3.5 9L12 4.2 20.5 9z"/><path d="M3.5 9L12 4.2 20.5 9M4.5 20h15M6.5 11v6.5M10 11v6.5M14 11v6.5M17.5 11v6.5"/>`,
  user: `<circle ${D} cx="12" cy="8.5" r="3.6"/><circle cx="12" cy="8.5" r="3.6"/><path d="M5 19.5c1.2-3.3 3.8-5 7-5s5.8 1.7 7 5"/>`,
  logout: `<path ${D} d="M5 6.5a2 2 0 0 1 2-2h6v15H7a2 2 0 0 1-2-2z"/><path d="M13 4.5H7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h6M11 12h9M17 9l3 3-3 3"/>`,
  menu: `<path d="M4 7h16M4 12h10M4 17h16"/>`,
  search: `<circle ${D} cx="11" cy="11" r="6.5"/><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>`,
  plus: `<path d="M12 5v14M5 12h14"/>`,
  'arrow-right': `<path d="M5 12h14M13 6l6 6-6 6"/>`,
  'arrow-left': `<path d="M19 12H5M11 6l-6 6 6 6"/>`,
  'chevron-left': `<path d="M14.5 6l-6 6 6 6"/>`,
  'chevron-right': `<path d="M9.5 6l6 6-6 6"/>`,
  'chevron-down': `<path d="M6 9.5l6 6 6-6"/>`,
  check: `<path d="M5 12.5l4.5 4.5L19 7.5"/>`,
  'check-circle': `<circle ${D} cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="8.5"/><path d="M8.2 12.3l2.6 2.6 5-5.2"/>`,
  assignment: `<path ${D} d="M9 3.5h6a1 1 0 0 1 1 1V6a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z"/><rect x="5" y="5" width="14" height="16" rx="3"/><path d="M9 3.5h6a1 1 0 0 1 1 1V6a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1zM9 12h6M9 16h4"/>`,
  people: `<circle ${D} cx="16.5" cy="9.5" r="2.6"/><circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19c.9-2.9 3-4.5 5.5-4.5s4.6 1.6 5.5 4.5"/><circle cx="16.5" cy="9.5" r="2.6"/><path d="M15.8 14.6c2.3-.2 4.1 1.2 4.9 3.9"/>`,
  settings: `<circle ${D} cx="15" cy="7" r="2.2"/><circle ${D} cx="9" cy="17" r="2.2"/><path d="M4 7h8.8M17.2 7H20M4 17h2.8M11.2 17H20"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>`,
  download: `<path ${D} d="M5 19.5h14"/><path d="M12 4v11M7.5 11l4.5 4.5 4.5-4.5M5 19.5h14"/>`,
  upload: `<path ${D} d="M4.5 14.5v3a2.5 2.5 0 0 0 2.5 2.5h10a2.5 2.5 0 0 0 2.5-2.5v-3z"/><path d="M12 15V4.5M7.5 9L12 4.5 16.5 9M4.5 14.5v3a2.5 2.5 0 0 0 2.5 2.5h10a2.5 2.5 0 0 0 2.5-2.5v-3"/>`,
  file: `<path ${D} d="M13.5 3.5V8a.5.5 0 0 0 .5.5h4.5z"/><path d="M7 3.5h6.5l5 5V19a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5z"/><path d="M13.5 3.5V8a.5.5 0 0 0 .5.5h4.5M8.5 13h7M8.5 16.5h4.5"/>`,
  pencil: `<path ${D} d="M15.8 5a2 2 0 0 1 2.8 0l.4.4a2 2 0 0 1 0 2.8l-2.3 2.3-3.2-3.2z"/><path d="M4.5 19.5l1-4.2L15.8 5a2 2 0 0 1 2.8 0l.4.4a2 2 0 0 1 0 2.8L8.7 18.5zM13.5 7.3l3.2 3.2"/>`,
  trash: `<path ${D} d="M6.5 7h11l-.8 11.5a2 2 0 0 1-2 1.5H9.3a2 2 0 0 1-2-1.5z"/><path d="M4.5 7h15M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2M6.5 7l.8 11.5a2 2 0 0 0 2 1.5h5.4a2 2 0 0 0 2-1.5L17.5 7M10 11v5M14 11v5"/>`,
  eye: `<circle ${D} cx="12" cy="12" r="3"/><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>`,
  'eye-off': `<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><path d="M4 4l16 16"/>`,
  clock: `<circle ${D} cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>`,
  info: `<circle ${D} cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>`,
  alert: `<path ${D} d="M10.3 4.6L3.2 17.4A2 2 0 0 0 5 20.3h14a2 2 0 0 0 1.8-2.9L13.7 4.6a2 2 0 0 0-3.4 0z"/><path d="M10.3 4.6L3.2 17.4A2 2 0 0 0 5 20.3h14a2 2 0 0 0 1.8-2.9L13.7 4.6a2 2 0 0 0-3.4 0zM12 9.5v4M12 17h.01"/>`,
  chat: `<path ${D} d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 19 17h-9l-4.5 3.5V17H5a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 5 5.5z"/><path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 19 17h-9l-4.5 3.5V17H5a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 5 5.5zM8 10h8M8 13h5"/>`,
  award: `<circle ${D} cx="12" cy="9" r="5.5"/><circle cx="12" cy="9" r="5.5"/><path d="M8.8 13.5L7.5 20.5l4.5-2.2 4.5 2.2-1.3-7"/>`,
  backpack: `<path ${D} d="M9.5 13.5h5v4h-5z"/><path d="M7 9a5 5 0 0 1 10 0v10a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 19zM9.5 5.2V4.5a2.5 2.5 0 0 1 5 0v.7M9.5 13.5h5v4h-5z"/>`,
  presenter: `<rect ${D} x="10" y="4" width="10.5" height="8" rx="1.5"/><rect x="10" y="4" width="10.5" height="8" rx="1.5"/><circle cx="6" cy="9.5" r="2"/><path d="M2.5 19.5c.3-3 1.6-5 3.5-5 1.3 0 2.2.6 3.2 1.6l3.3-2"/>`,
  refresh: `<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4"/>`,
  flag: `<path ${D} d="M5.5 5h11.5l-2.5 4 2.5 4H5.5z"/><path d="M5.5 20.5V4.5M5.5 5h11.5l-2.5 4 2.5 4H5.5"/>`,
  lock: `<rect ${D} x="5" y="10.5" width="14" height="10" rx="2.5"/><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5M12 14.5v2"/>`,
  sun: `<circle ${D} cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="4"/><path d="M12 3v1.5M12 19.5V21M3 12h1.5M19.5 12H21M5.6 5.6l1.1 1.1M17.3 17.3l1.1 1.1M5.6 18.4l1.1-1.1M17.3 6.7l1.1-1.1"/>`,
  moon: `<path ${D} d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>`,
  x: `<path d="M6 6l12 12M18 6L6 18"/>`,
  inbox: `<path ${D} d="M3.5 13.5H8l1.5 2.5h5l1.5-2.5h4.5V18a1.5 1.5 0 0 1-1.5 1.5h-14A1.5 1.5 0 0 1 3.5 18z"/><path d="M3.5 13.5l2.8-7.2A2 2 0 0 1 8.2 5h7.6a2 2 0 0 1 1.9 1.3l2.8 7.2V18a1.5 1.5 0 0 1-1.5 1.5h-14A1.5 1.5 0 0 1 3.5 18zM3.5 13.5H8l1.5 2.5h5l1.5-2.5h4.5"/>`,
  trend: `<path ${D} d="M4 16l5-5 3.5 3.5L20 7v13H4z" opacity=".5"/><path d="M4 16l5-5 3.5 3.5L20 7M15 7h5v5"/>`,
  cap: `<path ${D} d="M2.5 9.5L12 5l9.5 4.5L12 14z"/><path d="M2.5 9.5L12 5l9.5 4.5L12 14zM6.5 11.7V16c1.5 1.4 3.4 2 5.5 2s4-.6 5.5-2v-4.3M21.5 9.5V14"/>`,
  mail: `<rect ${D} x="3.5" y="5.5" width="17" height="13" rx="3"/><rect x="3.5" y="5.5" width="17" height="13" rx="3"/><path d="M4.5 7.5l7.5 5.5 7.5-5.5"/>`,
  play: `<circle ${D} cx="12" cy="12" r="8.5"/><path d="M10 8.8v6.4l5.2-3.2z"/>`,
  more: `<path d="M6 12h.01M12 12h.01M18 12h.01" stroke-width="3"/>`,
  external: `<path d="M8 16L16 8M9.5 8H16v6.5"/>`,
  bolt: `<path ${D} d="M13 3L5 13.5h6L10.5 21 19 10h-6z"/><path d="M13 3L5 13.5h6L10.5 21 19 10h-6z"/>`,
  target: `<circle ${D} cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><path d="M12 12h.01"/>`,
};

@Component({
  selector: 'lh-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'ico', 'aria-hidden': 'true' },
  template: `<svg viewBox="0 0 24 24" [innerHTML]="svg()"></svg>`,
  styles: [`
    :host { display: inline-flex; width: 20px; height: 20px; flex-shrink: 0; }
    :host(.lg) { width: 26px; height: 26px; }
    :host(.sm) { width: 16px; height: 16px; }
    svg { width: 100%; height: 100%; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; overflow: visible; }
    svg ::ng-deep .d { fill: currentColor; stroke: none; opacity: var(--duo, 0.18); }
  `]
})
export class IconComponent {
  private sanitizer = inject(DomSanitizer);
  readonly name = input.required<string>();
  // Only constant markup from the ICONS table above is trusted here, never user input.
  readonly svg = computed(() => this.sanitizer.bypassSecurityTrustHtml(ICONS[this.name()] ?? ''));
}

@Component({
  selector: 'lh-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 40 40" aria-hidden="true">
      <rect width="40" height="40" rx="12" class="bg" />
      <rect x="10" y="9" width="7.5" height="22" rx="3.75" fill="#cfc0ff" />
      <rect x="10" y="23.5" width="20" height="7.5" rx="3.75" fill="#e9e58e" />
      <circle cx="26" cy="14" r="4" fill="#fff" class="dot" />
    </svg>
    @if (word()) { <span class="word">learn<b>hub</b></span> }
  `,
  styles: [`
    :host { display: inline-flex; align-items: center; gap: .6rem; }
    .bg { fill: #16151c; }
    :host-context([data-theme="dark"]) .bg { fill: #2a2838; }
    .word { font-weight: 800; font-size: 1.22rem; letter-spacing: -.02em; color: var(--ink); }
    .word b { color: var(--violet); font-weight: 800; }
  `]
})
export class LogoComponent {
  readonly size = input(36);
  readonly word = input(true);
}
