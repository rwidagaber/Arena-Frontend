import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TranslationService } from '../../../core/services/translation.service';
import { ThemeService } from '../../../core/services/themeservice';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.css'
})
export class ForgotPasswordComponent implements OnInit, OnDestroy {

  private fb        = inject(FormBuilder);
  private auth      = inject(AuthService);
  private router    = inject(Router);
  readonly t        = inject(TranslationService);
  readonly themeService = inject(ThemeService);
  private translate = inject(TranslateService);

  loading     = false;
  serverError = '';
  success     = false;

  private langSub?: Subscription;

  get currentLang() { return this.t.currentLang(); }
  get isRtl() { return this.currentLang === 'ar'; }

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]]
  });

  ngOnInit(): void {
    this.langSub = this.translate.onLangChange.subscribe(() => {});
  }

  ngOnDestroy(): void {
    this.langSub?.unsubscribe();
  }

  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading = true;
    this.serverError = '';

    this.auth.forgotPassword({ email: this.form.value.email! }).subscribe({
      next: () => {
        this.loading = false;
        this.success = true;
      },
      error: (err: Error) => {
        this.loading = false;
        this.serverError = err.message;
      }
    });
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }

  getEmailError(): string {
    const c = this.form.get('email')!;
    if (c.hasError('required')) return this.translate.instant('auth.validation.required');
    if (c.hasError('email'))    return this.translate.instant('auth.validation.invalidEmail');
    return '';
  }
}