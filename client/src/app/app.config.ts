import { ApplicationConfig, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient, withInterceptors, withXsrfConfiguration } from '@angular/common/http';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling, withViewTransitions } from '@angular/router';
import { routes } from './app.routes';
import { Auth, errorInterceptor } from './core/services';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes,
      withComponentInputBinding(),
      // An interrupted transition (quick double navigation, hidden tab) rejects its promises; that's expected, not an error.
      withViewTransitions({
        skipInitialTransition: true,
        onViewTransitionCreated: ({ transition }) => {
          const t = transition as unknown as { ready?: Promise<void>; finished?: Promise<void> };
          t.ready?.catch(() => {});
          t.finished?.catch(() => {});
        }
      }),
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' })),
    // ASP.NET Core issues the XSRF-TOKEN cookie; Angular echoes it as X-XSRF-TOKEN on writes.
    provideHttpClient(
      withXsrfConfiguration({ cookieName: 'XSRF-TOKEN', headerName: 'X-XSRF-TOKEN' }),
      withInterceptors([errorInterceptor])),
    // Restore the signed-in user before the first route is resolved.
    provideAppInitializer(() => inject(Auth).load()),
  ]
};
