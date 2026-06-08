export interface DashboardStats {
  totalMembers: number;
  activeMembers: number;
  totalTrainers: number;
  totalClasses: number;
  monthlyRevenue: number;
  newMembersThisMonth: number;
}

export interface UpcomingClass {
  id: string;
  name: string;
  trainerName: string;
  startTime: string;
  endTime: string;
  dayOfWeek: string;
  maxCapacity: number;
  enrolledCount: number;
  imageUrl?: string;
}

export interface RecentMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  joinedAt: string;
  membershipType: string;
  profileImageUrl?: string;
}

export interface DashboardData {
  stats: DashboardStats;
  upcomingClasses: UpcomingClass[];
  recentMembers: RecentMember[];
}
