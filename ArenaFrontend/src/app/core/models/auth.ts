// ─────────────────────────────────────────
// Requests  (مطابقة لـ DTOs الـ backend)
// ─────────────────────────────────────────

export interface UserRegisterDto {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;

  phoneNumber: string;
  birthday: string;

  // ✅ الجديد
  weight?: number;
  height?: number;
gender: number; // 0 = Male, 1 = Female
  preferredLanguage?: string;
}

export interface CompleteProfileDto {
  phoneNumber: string;
  dateOfBirth: string;
  weight: number;
  height: number;
  gender: number; // 0 = Male, 1 = Female
}

export interface AuthResponseDto {
  accessToken:  string;
  refreshToken: string;
  expiresAt:    string;
  role:         string;
  isGoogleUser: boolean; // ← ضيف ده
}
export interface UserLoginDto {
  email: string;
  password: string;
  RememberMe:boolean;
}

export interface RefreshTokenDto {
  refreshToken: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

export interface ForgotPasswordDto {
  email: string;
}

export interface ResetPasswordDto {
  email: string;
  token: string;
  newPassword: string;
  confirmNewPassword: string;
}

// ─────────────────────────────────────────
// Responses
// ─────────────────────────────────────────



export interface UserSummary {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  preferredLanguage: string;
}

export interface GetProfileDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  preferredLanguage: string;
  dateOfBirth?: string;
  weight?: number;
  height?: number;
  bmi?: number;
  gender?: number;        // 0 = Male, 1 = Female (حسب الـ Gender enum)
  profileImageUrl?: string;
}
