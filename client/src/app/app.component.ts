import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Interactions } from './shared/motion';
import { OverlaysComponent } from './shared/ui';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, OverlaysComponent],
  template: `<router-outlet /><lh-overlays />`
})
export class AppComponent {
  constructor() { inject(Interactions).start(); }
}
