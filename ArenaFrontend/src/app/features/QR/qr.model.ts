export interface QrDto {
  id: string;
  code: string;
  generatedAt: Date;
  expirationTime: Date;
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