import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import * as signalR from '@microsoft/signalr';
import { AuthService } from './auth';

export interface NotificationDto {
  id: string;
  title: string;
  message: string;
  type: 'Success' | 'Warning' | 'Error' | 'Info';
  isRead: boolean;
  createdAt: string;
}

export interface AlertOptions {
  id: string;
  type: 'Success' | 'Error' | 'Warning' | 'Info' | 'Confirmation';
  eyebrow?: string;
  title: string;
  message: string;
  secondaryText?: string;
  ctaText?: string;
  secondaryCtaText?: string;
  resolve: (value: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  private readonly apiBase = environment.apiUrl.replace(/\/api$/, '');
  private readonly base = `${environment.apiUrl}/notifications`;

  readonly notifications = signal<NotificationDto[]>([]);
  readonly unreadCount   = signal(0);

  readonly toasts = signal<NotificationDto[]>([]);
  readonly activeAlert = signal<AlertOptions | null>(null);
  private readonly toastTimeouts = new Map<string, { timer: any; remaining: number; startedAt: number }>();
  private readonly TOAST_DURATION_MS = 6000;

  private hub?: signalR.HubConnection;
  private hubRefCount = 0;

  private normalizeNotification(data: any): NotificationDto {
    let typeVal = data.type ?? data.Type ?? 'Info';
    
    // Map C# integer enum values to string labels
    if (typeVal === 0 || typeVal === '0') {
      typeVal = 'Info';
    } else if (typeVal === 1 || typeVal === '1') {
      typeVal = 'Success';
    } else if (typeVal === 2 || typeVal === '2') {
      typeVal = 'Warning';
    } else if (typeVal === 3 || typeVal === '3') {
      typeVal = 'Error';
    }

    return {
      id: data.id ?? data.Id ?? Math.random().toString(36).substring(2, 9),
      title: data.title ?? data.Title ?? '',
      message: data.message ?? data.Message ?? '',
      type: typeVal as 'Success' | 'Warning' | 'Error' | 'Info',
      isRead: data.isRead ?? data.IsRead ?? false,
      createdAt: data.createdAt ?? data.CreatedAt ?? new Date().toISOString()
    };
  }

  // ── REST ──────────────────────────────────────────────────────────
  loadNotifications() {
    this.http.get<any[]>(this.base).subscribe(list => {
      const normalized = (list ?? []).map(item => this.normalizeNotification(item));
      this.notifications.set(normalized.slice(0, 10));
      this.unreadCount.set(normalized.filter(n => !n.isRead).length);
    });
  }

  markAsRead(id: string) {
    this.http.patch(`${this.base}/${id}/read`, {}).subscribe(() => {
      this.notifications.update(list =>
        list.map(n => n.id === id ? { ...n, isRead: true } : n)
      );
      this.unreadCount.update(c => Math.max(0, c - 1));
    });
  }

  markAllAsRead() {
    this.http.patch(`${this.base}/read-all`, {}).subscribe(() => {
      this.notifications.update(list => list.map(n => ({ ...n, isRead: true })));
      this.unreadCount.set(0);
    });
  }

  // ── Sound ─────────────────────────────────────────────────────────
  private readonly audio = new Audio('assets/sounds/freesound_community-draw-sword1-44724.mp3');

  private playSound(): void {
    try {
      this.audio.currentTime = 0;
      this.audio.volume = 0.5;
      this.audio.play().catch(() => {});
    } catch {
      this.audio.play().catch(err => console.error('Audio play failed:', err));
    }
  }

  // ── Toasts ────────────────────────────────────────────────────────
  private showToast(n: NotificationDto): void {
    this.toasts.update(list => [...list, n]);
    const duration = this.TOAST_DURATION_MS;
    const timer = setTimeout(() => this.dismissToast(n.id), duration);
    this.toastTimeouts.set(n.id, {
      timer,
      remaining: duration,
      startedAt: Date.now()
    });
    this.playSound();
  }

  dismissToast(id: string): void {
    this.toasts.update(list => list.filter(t => t.id !== id));
    const item = this.toastTimeouts.get(id);
    if (item) {
      clearTimeout(item.timer);
      this.toastTimeouts.delete(id);
    }
  }

  pauseToast(id: string): void {
    const item = this.toastTimeouts.get(id);
    if (item) {
      clearTimeout(item.timer);
      const elapsed = Date.now() - item.startedAt;
      item.remaining = Math.max(0, item.remaining - elapsed);
    }
  }

  resumeToast(id: string): void {
    const item = this.toastTimeouts.get(id);
    if (item && item.remaining > 0) {
      item.startedAt = Date.now();
      item.timer = setTimeout(() => this.dismissToast(id), item.remaining);
    }
  }

  // ── SignalR ───────────────────────────────────────────────────────
  connectHub() {
    this.hubRefCount++;
    const token = this.auth.accessToken;
    if (!token || this.hub) return;

    this.hub = new signalR.HubConnectionBuilder()
      .withUrl(`${this.apiBase}/hubs/notifications`, {
        accessTokenFactory: () => this.auth.accessToken ?? '',
        withCredentials: false
      })
      .withAutomaticReconnect()
      .build();

    this.hub.on('ReceiveNotification', (data: any) => {
      const n = this.normalizeNotification(data);
      this.notifications.update(list => [n, ...list].slice(0, 10));
      this.unreadCount.update(c => c + 1);
      this.showToast(n);
    });

    this.hub.start().catch(console.error);
  }

  disconnectHub() {
    this.hubRefCount--;
    if (this.hubRefCount > 0) return;

    this.toastTimeouts.forEach(t => clearTimeout(t.timer));
    this.toastTimeouts.clear();
    this.hub?.stop();
    this.hub = undefined;
  }

  // ── Local Toasts & Custom Alerts ──────────────────────────────────
  showLocalToast(title: string, message: string, type: 'Success' | 'Warning' | 'Error' | 'Info' = 'Info'): void {
    const n: NotificationDto = {
      id: Math.random().toString(36).substring(2, 9),
      title,
      message,
      type,
      isRead: true,
      createdAt: new Date().toISOString()
    };
    this.showToast(n);
  }

  showAlert(options: Omit<AlertOptions, 'id' | 'resolve'>): Promise<boolean> {
    const current = this.activeAlert();
    if (current) {
      current.resolve(false);
    }

    return new Promise<boolean>((resolve) => {
      const alertOpt: AlertOptions = {
        ...options,
        id: Math.random().toString(36).substring(2, 9),
        resolve: (val: boolean) => {
          this.activeAlert.set(null);
          resolve(val);
        }
      };
      this.activeAlert.set(alertOpt);
    });
  }

  success(title: string, message: string, ctaText?: string, eyebrow?: string): Promise<boolean> {
    return this.showAlert({ type: 'Success', title, message, ctaText, eyebrow });
  }

  error(title: string, message: string, ctaText?: string, eyebrow?: string): Promise<boolean> {
    return this.showAlert({ type: 'Error', title, message, ctaText, eyebrow });
  }

  warning(title: string, message: string, ctaText?: string, eyebrow?: string): Promise<boolean> {
    return this.showAlert({ type: 'Warning', title, message, ctaText, eyebrow });
  }

  info(title: string, message: string, ctaText?: string, eyebrow?: string): Promise<boolean> {
    return this.showAlert({ type: 'Info', title, message, ctaText, eyebrow });
  }

  confirm(title: string, message: string, ctaText?: string, secondaryCtaText?: string, eyebrow?: string): Promise<boolean> {
    return this.showAlert({ type: 'Confirmation', title, message, ctaText, secondaryCtaText, eyebrow });
  }
}