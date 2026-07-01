export interface ActiveSubscription {
  id: string;
  planNameEn: string;
  planNameAr: string;
  startDate: string;
  endDate: string;
  status: string;
  remainingSessions: number;
  totalSessions: number;
  paymentAmount: number;
  reminderSent: boolean;
  hasAI: boolean;
}

export interface MemberProfile {
  id: string;
  memberProfileId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string | null;
  preferredLanguage: string;
  isActive: boolean;
  weight: number | null;
  height: number | null;
  bmi: number | null;
  targetWeight: number | null;
  goal: string | null;
  gender: string | null;
  profileImage: string | null;
  birthday: string | null;
  activeSubscription: ActiveSubscription | null;
}

export interface UpdateProfileDto {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  preferredLanguage?: string;
  weight?: number;
  height?: number;
  gender?: string;
  profileImage?: string;
  birthday?: string;
  goal?: string;
  targetWeight?: number;
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
