import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MemberService } from '../../core/services/member.service';
import { MemberProfile, UpdateProfileDto } from '../../core/models/member';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { TranslationService } from '../../core/services/translation.service';
import { SidebarComponent, SidebarSection } from '../../shared/pipes/sidebar/sidebar';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe ,SidebarComponent],
  templateUrl: './member-profile.html',
  styleUrl: './member-profile.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileComponent {
  private memberService = inject(MemberService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  profile: MemberProfile | null = null;
  loading = true;
  saving = false;
  editMode = false;
  activeSection: SidebarSection = 'profile';

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
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  toggleEdit(): void {
    this.editMode = !this.editMode;
    this.cdr.markForCheck();
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
        this.cdr.markForCheck();
      },
      error: () => {
        this.saving = false;
        this.cdr.markForCheck();
      }
    });
  }

  onSectionChange(section: SidebarSection): void {
    this.activeSection = section;
    this.cdr.markForCheck();
  }

  getAge(birthday: string): number {
    const birth = new Date(birthday);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  }

  getMembershipProgress(startDate: string, endDate: string): number {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    const now = Date.now();
    const total = end - start;
    if (total <= 0) return 0;
    return Math.min(Math.round(((now - start) / total) * 100), 100);
  }

  copyId(id: string): void {
    navigator.clipboard.writeText(id);
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
    this.cdr.markForCheck();
  }
}