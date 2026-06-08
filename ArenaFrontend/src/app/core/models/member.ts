export interface MemberProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  dateOfBirth: string;
  gender?: number;
  weight?: number;
  height?: number;
  bmi?: number;
  profileImageUrl?: string;
  membershipType?: string;
  membershipStartDate?: string;
  membershipEndDate?: string;
  preferredLanguage?: string;
}

export interface UpdateProfileDto {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  preferredLanguage?: string;
  weight?: number;
  height?: number;
  gender?: number;
  profileImageUrl?: string;
}

export interface WorkoutSession {
  id: string;
  name: string;
  date: string;
  durationMinutes: number;
  caloriesBurned: number;
  type: string;
}

export interface MembershipDetails {
  type: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  price: number;
  features?: string[];
}
