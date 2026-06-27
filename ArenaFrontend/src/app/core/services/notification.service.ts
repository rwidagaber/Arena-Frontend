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

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  private readonly apiBase = environment.apiUrl.replace(/\/api$/, '');
  private readonly base = `${environment.apiUrl}/notifications`;

  readonly notifications = signal<NotificationDto[]>([]);
  readonly unreadCount   = signal(0);

  readonly toasts = signal<NotificationDto[]>([]);
  private readonly toastTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly TOAST_DURATION_MS = 6000;

  private hub?: signalR.HubConnection;
  private hubRefCount = 0;

  // ── REST ──────────────────────────────────────────────────────────
  loadNotifications() {
    this.http.get<NotificationDto[]>(this.base).subscribe(list => {
      this.notifications.set(list.slice(0, 10));
      this.unreadCount.set(list.filter(n => !n.isRead).length);
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
    const timer = setTimeout(() => this.dismissToast(n.id), this.TOAST_DURATION_MS);
    this.toastTimers.set(n.id, timer);
    this.playSound();
  }

  dismissToast(id: string): void {
    this.toasts.update(list => list.filter(t => t.id !== id));
    const timer = this.toastTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.toastTimers.delete(id);
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

    this.hub.on('ReceiveNotification', (n: NotificationDto) => {
      this.notifications.update(list => [n, ...list].slice(0, 10));
      this.unreadCount.update(c => c + 1);
      this.showToast(n);
    });

    this.hub.start().catch(console.error);
  }

  disconnectHub() {
    this.hubRefCount--;
    if (this.hubRefCount > 0) return;

    this.toastTimers.forEach(t => clearTimeout(t));
    this.toastTimers.clear();
    this.hub?.stop();
    this.hub = undefined;
  }
}