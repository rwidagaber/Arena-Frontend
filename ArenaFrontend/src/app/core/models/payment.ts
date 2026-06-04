export interface Payment {
  id: string;
  memberName: string;
  memberId: string;
  planName: string;
  planId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  transactionId: string | null;
  status: string;
  paymentDate: string | null;
  iframeUrl: string | null;
  subscriptionEndDate?: string | null;
  subscriptionStatus?: string | null;
}
