import { AbstractControl, ValidatorFn } from '@angular/forms';

export function realisticBodyValidator(): ValidatorFn {
  return (form: AbstractControl) => {

    const weight = form.get('weight')?.value;
    const height = form.get('height')?.value;

    if (!weight || !height) return null;

    const h = height / 100;
    const bmi = weight / (h * h);

    // ❌ unrealistic extremes
    if (weight < 35 || weight > 180) {
      return { unrealisticWeight: true };
    }

    if (height < 130 || height > 210) {
      return { unrealisticHeight: true };
    }

    // ❌ BMI check (teen/normal range safe)
    if (bmi < 15 || bmi > 35) {
      return { unrealisticBMI: true };
    }

    return null;
  };
}