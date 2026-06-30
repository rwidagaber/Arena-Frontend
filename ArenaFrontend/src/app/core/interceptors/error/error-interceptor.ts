import {
  HttpInterceptorFn, HttpErrorResponse
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError, switchMap, BehaviorSubject, filter, take } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../services/auth'; // غير المسار لو مختلف

let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

// ✅ مفاتيح الترجمة لكل status code (مطابقة لملف auth.errors / auth.validation)
const STATUS_MESSAGE_KEYS: Record<number, string> = {
  400: 'auth.errors.invalidRequest',
  401: 'auth.errors.invalidCredentials',
  403: 'auth.errors.noPermission',
  404: 'auth.errors.notFound',
  409: 'auth.errors.emailExists',
  422: 'auth.errors.invalidData',
  429: 'auth.errors.tooManyAttempts',
  500: 'auth.errors.somethingWrong',
  502: 'auth.errors.serviceUnavailable',
  503: 'auth.errors.serviceUnavailable',
};

const DEFAULT_ERROR_KEY = 'auth.errors.somethingWrong';
const SESSION_EXPIRED_KEY = 'auth.errors.sessionExpired';

const isTechnical = (msg: string): boolean => {
  const technicalPatterns = [
    /at\s+\w+\s*\(/,           // stack trace
    /Exception/,                // C# exceptions
    /System\./,                 // .NET namespaces
    /Microsoft\./,              // ASP.NET
    /Object reference/,         // null ref
    /Http failure response/,    // Angular HTTP wrapper
    /\w+:\d+:\d+/,              // file:line:col
    /localhost/,                // dev URLs
  ];
  return technicalPatterns.some(p => p.test(msg));
};

export const errorInterceptor: HttpInterceptorFn = (req, next) => {

  // ✅ سيب طلبات ملفات الترجمة (./i18n/en.json , ./i18n/ar.json) تعدي عادي
  // من غير أي تدخل من الـ interceptor ده. لازم ده يكون أول حاجة في الفنكشن،
  // قبل أي inject تاني، عشان منعملش حلقة مقفولة:
  // TranslateService → HttpClient → errorInterceptor → TranslateService
  if (req.url.includes('/i18n/')) {
    return next(req);
  }

  const authService = inject(AuthService);
  const translate = inject(TranslateService);

  // helper بيرجع Error بالرسالة المترجمة + المفتاح الأصلي (i18nKey) عشان نقدر
  // نعيد الترجمة لو المستخدم غيّر اللغة بعد ظهور الإيرور
  const translatedError = (key: string, params?: Record<string, unknown>) =>
    throwError(() => Object.assign(new Error(translate.instant(key, params)), { i18nKey: key, i18nParams: params }));

  return next(req).pipe(
    catchError((err) => {

      // ── Refresh Token Logic ───────────────────────────────────────────────
      if (err instanceof HttpErrorResponse && err.status === 401) {

        // لو الـ request اللي فشل هو الـ refresh نفسه → فعلاً انتهت الجلسة
        if (req.url.includes('/auth/refresh')) {
          isRefreshing = false;
          authService.clearSession();
          return translatedError(SESSION_EXPIRED_KEY);
        }

        // لو الـ request اللي فشل هو الـ login نفسه → سيبه يكمل تحت
        // للـ Normal Error Handling عشان ياخد رسالة "Invalid email or password"
        // الحقيقية بدل "Session expired"
        if (!req.url.includes('/auth/login')) {

          if (!isRefreshing) {
            isRefreshing = true;
            refreshTokenSubject.next(null);

            return authService.refresh().pipe(
              switchMap((tokens) => {
                isRefreshing = false;
                refreshTokenSubject.next(tokens.accessToken);

                // أعد الـ request الأصلي بالتوكن الجديد
                const retryReq = req.clone({
                  setHeaders: { Authorization: `Bearer ${tokens.accessToken}` }
                });
                return next(retryReq);
              }),
              catchError((refreshErr) => {
                isRefreshing = false;
                refreshTokenSubject.next(null);
                authService.clearSession();
                return translatedError(SESSION_EXPIRED_KEY);
              })
            );

          } else {
            // لو في refresh جاري، استنى التوكن الجديد وبعدين أعد الـ request
            return refreshTokenSubject.pipe(
              filter(token => token !== null),
              take(1),
              switchMap(token => {
                const retryReq = req.clone({
                  setHeaders: { Authorization: `Bearer ${token!}` }
                });
                return next(retryReq);
              })
            );
          }
        }
        // لو دخلنا هنا يبقى req.url فيه /auth/login → بنكمل تحت عادي
      }

      // ── Normal Error Handling ─────────────────────────────────────────────
      if (!(err instanceof HttpErrorResponse)) {
        if (err instanceof Error) {
          // لو الرسالة already مترجمة (جاية من نفس الـ interceptor) أو مش technical خليها
          const msg = isTechnical(err.message)
            ? translate.instant(DEFAULT_ERROR_KEY)
            : err.message;
          const key = isTechnical(err.message) ? DEFAULT_ERROR_KEY : (err as any).i18nKey;
          return throwError(() => Object.assign(new Error(msg), { i18nKey: key }));
        }
        return translatedError(DEFAULT_ERROR_KEY);
      }

      // الرسالة الافتراضية حسب status code (مترجمة)
      const statusKey = STATUS_MESSAGE_KEYS[err.status] ?? DEFAULT_ERROR_KEY;
      let message = translate.instant(statusKey);

      // حاول تاخد رسالة من الـ body بس لو مش technical
      // ⚠️ ملحوظة: دي رسالة جاية من السيرفر مباشرة، مش مفتاح ترجمة،
      // فهتفضل زي ما هي (عادةً إنجليزي) إلا لو السيرفر نفسه بيرجع مفتاح ترجمة معروف.
      if (err.error) {
        const errorBody = err.error;
        let bodyMsg = '';

        if (Array.isArray(errorBody)) {
          bodyMsg = errorBody.join(', ');
        } else if (typeof errorBody === 'string') {
          bodyMsg = errorBody;
        } else if (errorBody.message) {
          bodyMsg = Array.isArray(errorBody.message)
            ? errorBody.message.join(', ')
            : errorBody.message;
        } else if (errorBody.error && typeof errorBody.error === 'string') {
          bodyMsg = errorBody.error;
        } else if (Array.isArray(errorBody.errors)) {
          bodyMsg = errorBody.errors.join(', ');
        } else if (errorBody.errors && typeof errorBody.errors === 'object') {
          bodyMsg = Object.values(errorBody.errors).flat().join(', ');
        } else if (errorBody.title) {
          bodyMsg = errorBody.title;
        }

        // ✅ لو عايز تدي أولوية لرسالة السيرفر، فعّل السطر ده.
        // مش بنفعّله افتراضيًا عشان الرسالة المترجمة (status-based) هتفضل
        // أدق وأنضف من رسالة سيرفر إنجليزي خام جوه واجهة عربي.
        // if (bodyMsg && !isTechnical(bodyMsg)) {
        //   message = bodyMsg;
        // }
        void bodyMsg; // (متسيبهاش لو هتفعّل الأولوية فوق)
      }

      console.error('HTTP ERROR:', err); // للـ debugging بس

      return throwError(() => Object.assign(new Error(message), { i18nKey: statusKey }));
    })
  );
};