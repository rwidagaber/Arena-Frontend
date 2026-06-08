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
import {
    SocialAuthService,
  SocialAuthServiceConfig,
  GoogleLoginProvider,
} from '@abacritt/angularx-social-login';
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([
      loggingInterceptor,
      loadingInterceptor,
      authInterceptor,
      errorInterceptor,
    ])),
    // Register ngx-translate with standalone APIs
    provideTranslateService({
      defaultLanguage: 'en'
    }),
    provideTranslateHttpLoader({ prefix: './i18n/', suffix: '.json' }),

    
    SocialAuthService,
    {
      provide: 'SocialAuthServiceConfig',
      useValue: {
        autoLogin: false,
        providers: [
          {
            id: GoogleLoginProvider.PROVIDER_ID,
            provider: new GoogleLoginProvider('656089986689-anh4euktf142is1dmbeqq9ovank82cjc.apps.googleusercontent.com')
          }
        ]
      } as SocialAuthServiceConfig,
    }
    
  ]
};
