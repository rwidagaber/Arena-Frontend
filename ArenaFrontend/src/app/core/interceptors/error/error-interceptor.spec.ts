import { TestBed } from '@angular/core/testing';
import { HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';

import { errorInterceptor } from './error-interceptor';

describe('errorInterceptor', () => {

  const interceptor: HttpInterceptorFn = (req, next) =>
    TestBed.runInInjectionContext(() => errorInterceptor(req, next));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should pass successful response through', (done) => {
    const req = new HttpRequest('GET', '/test');

    interceptor(req, (request) =>
      of(new HttpResponse({ status: 200, body: { ok: true } }))
    ).subscribe(res => {
      expect(res instanceof HttpResponse).toBeTrue();
      done();
    });
  });

  it('should transform string error message', (done) => {
    const req = new HttpRequest('GET', '/test');

    interceptor(req, () =>
      throwError(() => ({
        error: 'Invalid email or password'
      }))
    ).subscribe({
      error: (err) => {
        expect(err.message).toBe('Invalid email or password');
        done();
      }
    });
  });

  it('should transform array error message', (done) => {
    const req = new HttpRequest('GET', '/test');

    interceptor(req, () =>
      throwError(() => ({
        error: ['Email is required', 'Password is required']
      }))
    ).subscribe({
      error: (err) => {
        expect(err.message).toContain('Email is required');
        expect(err.message).toContain('Password is required');
        done();
      }
    });
  });

});