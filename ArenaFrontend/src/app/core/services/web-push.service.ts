import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class WebPushService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/push`;

private readonly vapidPublicKey = environment.vapidPublicKey;
  async requestPermissionAndSubscribe(): Promise<void> {
    // مش شغال في المتصفحات اللي مش بتدعم Push
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    try {
      const registration = await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey)
      });

      // ابعت الـ subscription للـ backend
      await this.http.post(`${this.base}/subscribe`, {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')!))),
          auth:   btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')!)))
        }
      }).toPromise();

    } catch (err) {
      console.error('Push subscription failed:', err);
    }
  }

  async unsubscribe(): Promise<void> {
    if (!('serviceWorker' in navigator)) return;

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await this.http.delete(`${this.base}/unsubscribe`, {
        body: subscription.endpoint
      }).toPromise();
      await subscription.unsubscribe();
    }
  }

  private urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer as ArrayBuffer; 
}
}