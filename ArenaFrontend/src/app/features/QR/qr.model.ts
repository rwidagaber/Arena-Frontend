export interface QrDto {
  id: string;
  code: string;
  generatedAt: string;
  expirationTime: string;
  isUsed: boolean;
  bookingId: string;
}


export interface BookingDto {
  id: string;
  memberProfileId: string;
  bookingDate: string;
  startTime: string;
  endTime?: string | null;
  status: number | string;
}