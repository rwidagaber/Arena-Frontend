export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  durationMonths: number;
  price: number;
  sessionLimit: number | null;
  isActive: boolean;
}
