import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, ValidatorFn, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth';
import { strongPasswordValidator } from '../../../shared/utils/validators/password.validator';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TranslationService } from '../../../core/services/translation.service';
import { ThemeService } from '../../../core/services/themeservice';
import { Subscription } from 'rxjs';

export function passwordsMatch(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const pw  = group.get('newPassword')?.value;
    const cpw = group.get('confirmNewPassword')?.value;
    if (!pw || !cpw) return null;
    return pw === cpw ? null : { mismatch: true };
  };
}

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.css'
})
export class ResetPasswordComponent implements OnInit, OnDestroy {

  private fb        = inject(FormBuilder);
  private auth      = inject(AuthService);
  private router    = inject(Router);
  private route     = inject(ActivatedRoute);
  readonly t        = inject(TranslationService);
  readonly themeService = inject(ThemeService);
  private translate = inject(TranslateService);

  loading     = false;
  serverError = '';
  success     = false;
  showPw      = false;
  email       = '';
  token       = '';

  private langSub?: Subscription;

  get currentLang() { return this.t.currentLang(); }
  get isRtl() { return this.currentLang === 'ar'; }

  form = this.fb.group({
    newPassword:        ['', [Validators.required, Validators.minLength(8), strongPasswordValidator()]],
    confirmNewPassword: ['', Validators.required]
  }, { validators: passwordsMatch() });

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    this.email = this.route.snapshot.queryParamMap.get('email') ?? '';

    if (!this.token || !this.email) {
      this.router.navigate(['/forgot-password']);
    }

    this.langSub = this.translate.onLangChange.subscribe(() => {});
  }

  ngOnDestroy(): void {
    this.langSub?.unsubscribe();
  }

  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading = true;
    this.serverError = '';

    this.auth.resetPassword({
      email:              this.email,
      token:              this.token,
      newPassword:        this.form.value.newPassword!,
      confirmNewPassword: this.form.value.confirmNewPassword!
    }).subscribe({
      next: () => {
        this.loading = false;
        this.success = true;
        setTimeout(() => this.router.navigate(['/login']), 2000);
      },
      error: (err: Error) => {
        this.loading = false;
        this.serverError = err.message;
      }
    });
  }

  get showMismatch(): boolean {
    return this.form.hasError('mismatch') &&
           (this.form.get('confirmNewPassword')?.dirty ?? false);
  }

  getPasswordError(): string {
    const c = this.form.get('newPassword')!;
    if (c.hasError('required'))     return this.translate.instant('auth.validation.required');
    if (c.hasError('minlength'))    return this.translate.instant('auth.validation.minPassword', { min: 8 });
    if (c.hasError('weakPassword')) return this.translate.instant('auth.validation.minPassword', { min: 8 });
    return '';
  }
}