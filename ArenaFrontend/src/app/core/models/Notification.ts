// ── Notification Type (mirrors ArenaDomain.Enums.NotificationType) ──────
export enum NotificationType {
  Success = 'Success',
  Warning = 'Warning',
  Error   = 'Error',
  Info    = 'Info',
}

// ── Read model (mirrors ArenaApplication.Dtos.NotificationDtos.NotificationDto) ──
export interface NotificationDto {
  id: string;          // Guid
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: string;   // DateTime (ISO string over the wire)
}

// ── Create model (mirrors ArenaApplication.Dtos.NotificationDtos.CreateNotificationDto) ──
export interface CreateNotificationDto {
  memberProfileId: string; // Guid
  title: string;
  message: string;
  type: NotificationType;
}