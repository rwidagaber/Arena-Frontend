export interface QrDto {
  id: string;
  code: string;
  generatedAt: string;
  expirationTime: string;
  isUsed: boolean;
  bookingId: string;
}

export interface QrScanResultDto {
  isExpired: boolean;
  isAlreadyUsed: boolean;
  message: string;
  bookingId?: string;
  memberProfileId?: string;
}

export interface ScanQrRequestDto {
  code: string;
  scannedById: string;
}

export interface BookingDto {
  id: string;
  memberProfileId: string;
  bookingDate: string;
  startTime: string;
  endTime?: string | null;
  status: number | string;
}
