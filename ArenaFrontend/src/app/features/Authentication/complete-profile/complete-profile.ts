import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth';
import { minAgeValidator } from '../../../shared/utils/validators/min-age.validator';
import { phoneValidator } from '../../../shared/utils/validators/phoneValidator';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TranslationService } from '../../../core/services/translation.service';
import { ThemeService } from '../../../core/services/themeservice';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-complete-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './complete-profile.html',
  styleUrl: './complete-profile.css'
})
export class CompleteProfileComponent implements OnInit, OnDestroy {

  private fb        = inject(FormBuilder);
  private auth      = inject(AuthService);
  private router    = inject(Router);
  readonly t        = inject(TranslationService);
  readonly themeService = inject(ThemeService);
  private translate = inject(TranslateService);

  loading     = false;
  serverError = '';
  genderOptions: { value: number; label: string }[] = [];

  private langSub?: Subscription;

  get currentLang() { return this.t.currentLang(); }
  get isRtl() { return this.currentLang === 'ar'; }

  form = this.fb.group({
    phoneNumber: ['', [Validators.required, phoneValidator]],
    dateOfBirth: ['', [Validators.required, minAgeValidator(16)]],
    weight:      [null, [Validators.required, Validators.min(35), Validators.max(180)]],
    height:      [null, [Validators.required, Validators.min(130), Validators.max(210)]],
    gender:      [null, Validators.required],
  });

  ngOnInit(): void {
    history.pushState(null, '', location.href);
    window.addEventListener('popstate', this.preventBack);

    this.translate.get('auth.completeProfile.genderMale').subscribe(() => {
      this.buildGenderOptions();
    });

    this.langSub = this.translate.onLangChange.subscribe(() => {
      this.buildGenderOptions();
    });
  }

  ngOnDestroy(): void {
    window.removeEventListener('popstate', this.preventBack);
    this.langSub?.unsubscribe();
  }

  private preventBack = (): void => {
    history.pushState(null, '', location.href);
  }

  private buildGenderOptions(): void {
    this.genderOptions = [
      { value: 0, label: this.translate.instant('auth.completeProfile.genderMale') },
      { value: 1, label: this.translate.instant('auth.completeProfile.genderFemale') },
    ];
  }

  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading = true;
    this.serverError = '';

    this.auth.completeProfile(this.form.getRawValue() as any).subscribe({
      next: () => {
        this.loading = false;
        window.removeEventListener('popstate', this.preventBack);
        this.router.navigate(['/home']);
      },
      error: (err: Error) => {
        this.loading = false;
        this.serverError = err.message;
      }
    });
  }

  isInvalid(field: string): boolean {
    const c = this.form.get(field)!;
    return c.invalid && (c.dirty || c.touched);
  }

  getError(field: string): string {
    const c = this.form.get(field)!;
    if (c.hasError('required'))     return this.translate.instant('auth.validation.required');
    if (c.hasError('invalidPhone')) return this.translate.instant('auth.validation.invalidPhone');
    if (c.hasError('minAge'))       return this.translate.instant('auth.validation.minAge', { age: c.errors?.['minAge'].requiredAge });
    if (c.hasError('min'))          return this.translate.instant('auth.validation.minWeight', { min: c.errors?.['min'].min });
    if (c.hasError('max'))          return this.translate.instant('auth.validation.maxWeight', { max: c.errors?.['max'].max });
    return '';
  }
}