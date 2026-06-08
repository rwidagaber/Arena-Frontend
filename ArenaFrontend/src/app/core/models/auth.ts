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

export interface UserLoginDto {
  email: string;
  password: string;
  RememberMe: boolean;
}

export interface RefreshTokenDto {
  accessToken: string;
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

// Combined main & dev properties cleanly
export interface AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  role: string;
  isSubscribed: boolean;
  isGoogleUser: boolean; // From main branch
  firstName?: string;    // From dev branch
  lastName?: string;     // From dev branch
}

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
  gender?: number;         // 0 = Male, 1 = Female
  profileImageUrl?: string;
  activeSubscription?: any; // To check if they have an active subscription
}