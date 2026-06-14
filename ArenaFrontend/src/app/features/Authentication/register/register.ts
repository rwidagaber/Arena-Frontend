import { Component, inject, AfterViewInit, NgZone, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule, FormBuilder, Validators,
  AbstractControl, ValidationErrors, ValidatorFn
} from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth';
import { strictEmailValidator } from '../../../shared/utils/validators/strict-email.validator';
import { strongPasswordValidator } from '../../../shared/utils/validators/password.validator';
import { minAgeValidator } from '../../../shared/utils/validators/min-age.validator';
import { phoneValidator } from '../../../shared/utils/validators/phoneValidator';
import { realisticBodyValidator } from '../../../shared/utils/validators/realisticBodyValidator';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TranslationService } from '../../../core/services/translation.service';
import { ThemeService } from '../../../core/services/themeservice';
import { Subscription } from 'rxjs';

export function passwordsMatch(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const pw = group.get('password')?.value;
    const cpw = group.get('confirmPassword')?.value;
    if (!pw || !cpw) return null;
    return pw === cpw ? null : { mismatch: true };
  };
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class RegisterComponent implements OnInit, AfterViewInit, OnDestroy {

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
  genderOptions: { value: number; label: string }[] = [];

  private langSub?: Subscription;

  get currentLang() { return this.t.currentLang(); }
  get isRtl() { return this.currentLang === 'ar'; }

  form = this.fb.group(
    {
      firstName:       ['', Validators.required],
      lastName:        ['', Validators.required],
      phoneNumber:     ['', [Validators.required, phoneValidator]],
      birthday:        ['', [Validators.required, minAgeValidator(16)]],
      email:           ['', [Validators.required, Validators.email, strictEmailValidator()]],
      password:        ['', [Validators.required, Validators.minLength(8), strongPasswordValidator()]],
      confirmPassword: ['', Validators.required],
      weight:          [null, [Validators.required, Validators.min(35), Validators.max(180)]],
      height:          [null, [Validators.required, Validators.min(130), Validators.max(210)]],
      gender:          [null, Validators.required],
    },
    { validators: [passwordsMatch(), realisticBodyValidator()] }
  );

  ngOnInit(): void {
    // ✅ حمّل الـ gender options بعد ما الترجمة تتحمل
    this.translate.get('auth.register.genderMale').subscribe(() => {
      this.buildGenderOptions();
    });

    // ✅ حدّث الـ options لما اللغة تتغير
    this.langSub = this.translate.onLangChange.subscribe(() => {
      this.buildGenderOptions();
    });
  }

  private buildGenderOptions(): void {
    this.genderOptions = [
      { value: 0, label: this.translate.instant('auth.register.genderMale') },
      { value: 1, label: this.translate.instant('auth.register.genderFemale') },
    ];
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
      { theme: 'outline', size: 'large', text: 'continue_with', width: 376 }
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
        } else {
          this.router.navigate(['/']);
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

    this.auth.register(this.form.getRawValue() as any).subscribe({
      next: (res) => {
        this.loading = false;
        this.router.navigate(['/confirm-email'], {
          queryParams: { userId: res.userId, email: this.form.value.email }
        });
      },
      error: (err: Error) => { this.loading = false; this.serverError = err.message; },
    });
  }

  goToLogin(): void { this.router.navigate(['/login']); }

  isInvalid(field: string): boolean {
    const c = this.form.get(field)!;
    return c.invalid && (c.dirty || c.touched);
  }

  get showMismatch(): boolean {
    return this.form.hasError('mismatch') &&
           (this.form.get('confirmPassword')?.dirty ?? false);
  }

  getError(field: string): string {
    const c = this.form.get(field)!;
    if (c.hasError('required'))     return this.translate.instant('auth.validation.required');
    if (c.hasError('weakPassword')) return this.translate.instant('auth.validation.minPassword', { min: 8 });
    if (c.hasError('minlength'))    return this.translate.instant('auth.validation.minPassword', { min: c.errors?.['minlength'].requiredLength });
    if (c.hasError('invalidEmail')) return this.translate.instant('auth.validation.invalidEmail');
    if (c.hasError('minAge'))       return this.translate.instant('auth.validation.minAge', { age: c.errors?.['minAge'].requiredAge });
    if (c.hasError('invalidPhone')) return this.translate.instant('auth.validation.invalidPhone');
    if (c.hasError('min'))          return this.translate.instant('auth.validation.minWeight', { min: c.errors?.['min'].min });
    if (c.hasError('max'))          return this.translate.instant('auth.validation.maxWeight', { max: c.errors?.['max'].max });
    return '';
  }

  get bodyError(): string {
    if (this.form.hasError('unrealisticWeight')) return this.translate.instant('auth.validation.minWeight', { min: 35 });
    if (this.form.hasError('unrealisticHeight')) return this.translate.instant('auth.validation.minHeight', { min: 130 });
    if (this.form.hasError('unrealisticBMI'))    return 'Weight and height combination is not realistic';
    return '';
  }
}