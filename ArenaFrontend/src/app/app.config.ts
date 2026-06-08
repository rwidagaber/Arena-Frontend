import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth/auth-interceptor';
import { errorInterceptor } from './core/interceptors/error/error-interceptor';
import { loadingInterceptor } from './core/interceptors/loading/loading-interceptor';
import { loggingInterceptor } from './core/interceptors/logging/logging-interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([
      loggingInterceptor,
      loadingInterceptor,
      errorInterceptor,
      authInterceptor,
    ]))
    ])),
    // Register ngx-translate with standalone APIs
    provideTranslateService({
      defaultLanguage: 'en'
    }),
    provideTranslateHttpLoader({ prefix: './i18n/', suffix: '.json' })
  ]
};
