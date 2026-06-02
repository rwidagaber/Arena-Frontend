import { AbstractControl, ValidationErrors } from '@angular/forms';

export function minAgeValidator(minAge: number) {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;

    if (!value) return null;

    const birthDate = new Date(value);
    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();

    const monthDiff = today.getMonth() - birthDate.getMonth();
    const dayDiff = today.getDate() - birthDate.getDate();

    // لو لسه موصلش عيد ميلاده السنة دي
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      age--;
    }

    return age >= minAge
      ? null
      : { minAge: { requiredAge: minAge, actualAge: age } };
  };
}