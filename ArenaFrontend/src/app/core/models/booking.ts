export enum BookingSource {
  Chatbot = 0,
  Manual = 1
}

export interface CreateBookingDto {
  memberProfileId: string;
  bookingDate: string; // ISO date string (YYYY-MM-DD)
  startTime: string;   // Time string (HH:mm:ss)
  endTime?: string | null;
  source: BookingSource;
}

export interface BookingDto {
  id: string;
  memberProfileId: string;
  bookingDate: string;
  startTime: string;   // Time string
  endTime?: string | null;
  status: number | string;
  source?: BookingSource;
}
