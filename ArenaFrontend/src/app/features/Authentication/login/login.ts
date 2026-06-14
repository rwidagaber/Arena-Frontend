import { Component, inject, AfterViewInit, NgZone, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TranslationService } from '../../../core/services/translation.service';
import { ThemeService } from '../../../core/services/themeservice';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent implements OnInit, AfterViewInit, OnDestroy {

  private fb        = inject(FormBuilder);
  private auth      = inject(AuthService);
  private router    = inject(Router);
  private ngZone    = inject(NgZone);
  readonly t        = inject(TranslationService);
  readonly themeService = inject(ThemeService);
  private translate = inject(TranslateService);

  showPw      = false;
  loading     = false;
  serverError = '';

  private langSub?: Subscription;

  get currentLang() { return this.t.currentLang(); }
  get isRtl() { return this.currentLang === 'ar'; }

  form = this.fb.group({
    email:      ['', [Validators.required, Validators.email]],
    password:   ['', [Validators.required, Validators.minLength(6)]],
    rememberMe: [false]
  });

  ngOnInit(): void {
    this.langSub = this.translate.onLangChange.subscribe(() => {});
  }

  ngOnDestroy(): void {
    this.langSub?.unsubscribe();
  }

  ngAfterViewInit(): void {
    const waitForGoogle = setInterval(() => {
      if (typeof (window as any).google !== 'undefined') {
        clearInterval(waitForGoogle);
        this.initGoogleButton();
      }
    }, 100);
  }

  private initGoogleButton(): void {
    (window as any).google.accounts.id.initialize({
      client_id: '656089986689-anh4euktf142is1dmbeqq9ovank82cjc.apps.googleusercontent.com',
      callback: (response: any) => {
        this.ngZone.run(() => this.handleGoogleResponse(response));
      }
    });

    (window as any).google.accounts.id.renderButton(
      document.getElementById('google-btn'),
      { theme: 'outline', size: 'large', text: 'signin_with', width: 376 }
    );
  }

  handleGoogleResponse(response: any): void {
    const idToken = response.credential;
    this.loading = true;
    this.serverError = '';

    this.auth.googleLogin(idToken).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.isGoogleUser) {
          this.router.navigate(['/complete-profile']);
        } else if (res.isSubscribed) {
          this.router.navigate(['/dashboard']);
        } else {
          const ret = new URLSearchParams(window.location.search).get('returnUrl') ?? '/';
          this.router.navigateByUrl(ret);
        }
      },
      error: (err: Error) => {
        this.loading = false;
        this.serverError = err.message;
      }
    });
  }

  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading = true;
    this.serverError = '';

    const { rememberMe, ...loginDto } = this.form.getRawValue();

    this.auth.login(loginDto as any, rememberMe ?? false).subscribe({
      next: () => {
        this.loading = false;
        if (this.auth.isSubscribed) {
          this.router.navigate(['/dashboard']);
        } else {
          const ret = new URLSearchParams(window.location.search).get('returnUrl') ?? '/';
          this.router.navigateByUrl(ret);
        }
      },
      error: (err: Error) => {
        this.loading = false;
        this.serverError = err.message;
      },
    });
  }

  goToSignup(): void { this.router.navigate(['/register']); }
  goToforgot(): void { this.router.navigate(['/forgot-password']); }

  isInvalid(field: string): boolean {
    const c = this.form.get(field)!;
    return c.invalid && (c.dirty || c.touched);
  }

  getError(field: string): string {
    const c: AbstractControl = this.form.get(field)!;
    if (c.hasError('required'))  return this.translate.instant('auth.validation.required');
    if (c.hasError('email'))     return this.translate.instant('auth.validation.invalidEmail');
    if (c.hasError('minlength')) return this.translate.instant('auth.validation.minPassword', { min: c.errors?.['minlength'].requiredLength });
    return '';
  }
}