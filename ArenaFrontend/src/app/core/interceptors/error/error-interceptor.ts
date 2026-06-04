import { HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((err) => {
      let message = 'Something went wrong';

      if (err && err.error) {
        const errorBody = err.error;
        
        // 1. Direct string
        if (typeof errorBody === 'string') {
          message = errorBody;
        }
        // 2. has .message property
        else if (errorBody.message) {
          if (Array.isArray(errorBody.message)) {
            message = errorBody.message.join(', ');
          } else {
            message = errorBody.message;
          }
        }
        // 3. has .errors array (e.g. some APIs)
        else if (Array.isArray(errorBody.errors)) {
          message = errorBody.errors.join(', ');
        }
        // 4. ASP.NET Core ProblemDetails or ModelState
        else if (errorBody.errors && typeof errorBody.errors === 'object') {
          message = Object.values(errorBody.errors)
            .flat()
            .join(', ');
        }
        // 5. title from ProblemDetails
        else if (errorBody.title) {
          message = errorBody.title;
        }
      } else if (err && err.message) {
        // Fallback to HttpErrorResponse's wrapper message
        message = err.message;
      }

      console.error('HTTP ERROR:', err);

      return throwError(() => new Error(message));
    })
  );
};