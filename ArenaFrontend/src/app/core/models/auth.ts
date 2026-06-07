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
  preferredLanguage?: string;
}

export interface UserLoginDto {
  email: string;
  password: string;
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

export interface AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  role: string;
  isSubscribed?: boolean;
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
  gender?: number;        // 0 = Male, 1 = Female (حسب الـ Gender enum)
  profileImageUrl?: string;
  activeSubscription?: any; // To check if they have an active subscription
}
