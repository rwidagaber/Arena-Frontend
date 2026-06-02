import { HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((err) => {
      let message = 'Something went wrong';

      const error = err?.error;

      // 1. string
      if (typeof error === 'string') {
        message = error;
      }

      // 2. array of strings
      else if (Array.isArray(error)) {
        message = error.join(', ');
      }

      // 3. { message: "" }
      else if (error?.message) {
        message = error.message;
      }

      // 4. { errors: [] }
      else if (Array.isArray(error?.errors)) {
        message = error.errors.join(', ');
      }

      // 5. fallback ASP.NET ModelState
      else if (error?.errors && typeof error.errors === 'object') {
        message = Object.values(error.errors)
          .flat()
          .join(', ');
      }

      console.error('HTTP ERROR:', err);

      return throwError(() => new Error(message));
    })
  );
};