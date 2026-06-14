import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

// ✅ رسائل واضحة لكل status code
const STATUS_MESSAGES: Record<number, string> = {
  400: 'Invalid request. Please check your input.',
  401: 'Invalid email or password.',
  403: 'You don\'t have permission to do this.',
  404: 'The requested resource was not found.',
  409: 'This account already exists.',
  422: 'Invalid data. Please check your input.',
  429: 'Too many attempts. Please try again later.',
  500: 'Server error. Please try again later.',
  502: 'Service unavailable. Please try again later.',
  503: 'Service unavailable. Please try again later.',
};

const isTechnical = (msg: string): boolean => {
  const technicalPatterns = [
    /at\s+\w+\s*\(/,           // stack trace
    /Exception/,                // C# exceptions
    /System\./,                 // .NET namespaces  
    /Microsoft\./,              // ASP.NET
    /Object reference/,         // null ref
    /Http failure response/,    // Angular HTTP wrapper
    /\w+:\d+:\d+/,             // file:line:col
    /localhost/,                // dev URLs
  ];
  return technicalPatterns.some(p => p.test(msg));
};

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((err) => {

      if (err instanceof Error) {
        // لو الرسالة technical → استبدلها
        const msg = isTechnical(err.message)
          ? 'Something went wrong. Please try again.'
          : err.message;
        return throwError(() => new Error(msg));
      }

      if (!(err instanceof HttpErrorResponse)) {
        return throwError(() => new Error('Something went wrong. Please try again.'));
      }

      let message = STATUS_MESSAGES[err.status] ?? 'Something went wrong. Please try again.';

      // حاول تاخد رسالة من الـ body بس لو مش technical
      if (err.error) {
        const errorBody = err.error;
        let bodyMsg = '';

        if (typeof errorBody === 'string') {
          bodyMsg = errorBody;
        } else if (errorBody.message) {
          bodyMsg = Array.isArray(errorBody.message)
            ? errorBody.message.join(', ')
            : errorBody.message;
        } else if (Array.isArray(errorBody.errors)) {
          bodyMsg = errorBody.errors.join(', ');
        } else if (errorBody.errors && typeof errorBody.errors === 'object') {
          bodyMsg = Object.values(errorBody.errors).flat().join(', ');
        } else if (errorBody.title) {
          bodyMsg = errorBody.title;
        }

        // استخدم رسالة السيرفر بس لو مش technical
        if (bodyMsg && !isTechnical(bodyMsg)) {
          message = bodyMsg;
        }
      }

      console.error('HTTP ERROR:', err); // للـ debugging بس

      return throwError(() => new Error(message));
    })
  );
};