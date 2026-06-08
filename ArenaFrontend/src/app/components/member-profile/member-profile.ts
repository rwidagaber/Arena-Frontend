import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MemberService } from '../../core/services/member.service';
import { MemberProfile, UpdateProfileDto } from '../../core/models/member';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { TranslationService } from '../../core/services/translation.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe],
  templateUrl: './member-profile.html',
  styleUrl: './member-profile.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileComponent {
  private memberService = inject(MemberService);
  private fb = inject(FormBuilder);

  profile: MemberProfile | null = null;
  loading = true;
  saving = false;
  editMode = false;

  form = this.fb.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    phoneNumber: [''],
    preferredLanguage: [''],
    weight: [0],
    height: [0],
  });

  constructor() {
    this.loadProfile();
  }

  private loadProfile(): void {
    this.memberService.getProfile().subscribe({
      next: (res) => {
        this.profile = res;
        this.form.patchValue({
          firstName: res.firstName,
          lastName: res.lastName,
          phoneNumber: res.phoneNumber,
          preferredLanguage: res.preferredLanguage,
          weight: res.weight ?? 0,
          height: res.height ?? 0,
        });
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  toggleEdit(): void {
    this.editMode = !this.editMode;
  }

  save(): void {
    if (this.form.invalid) return;
    this.saving = true;

    const dto: UpdateProfileDto = {
      firstName: this.form.value.firstName ?? undefined,
      lastName: this.form.value.lastName ?? undefined,
      phoneNumber: this.form.value.phoneNumber ?? undefined,
      preferredLanguage: this.form.value.preferredLanguage ?? undefined,
      weight: this.form.value.weight ?? undefined,
      height: this.form.value.height ?? undefined,
    };

    this.memberService.updateProfile(dto).subscribe({
      next: (res) => {
        this.profile = res;
        this.editMode = false;
        this.saving = false;
      },
      error: () => { this.saving = false; }
    });
  }

  cancel(): void {
    if (this.profile) {
      this.form.patchValue({
        firstName: this.profile.firstName,
        lastName: this.profile.lastName,
        phoneNumber: this.profile.phoneNumber,
        preferredLanguage: this.profile.preferredLanguage,
        weight: this.profile.weight ?? 0,
        height: this.profile.height ?? 0,
      });
    }
    this.editMode = false;
  }
}
