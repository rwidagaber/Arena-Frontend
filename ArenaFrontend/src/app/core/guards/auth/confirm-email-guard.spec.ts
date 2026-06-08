import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { confirmEmailGuard } from './confirm-email-guard';

describe('confirmEmailGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) => 
      TestBed.runInInjectionContext(() => confirmEmailGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
