import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SubscriptionPlan } from '../models/subscription-plan';
import { Payment } from '../models/payment';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PricingService {
  // Use environment variables for the API URL
  private apiUrl = `${environment.apiUrl}/subscription-plans`;

  constructor(private http: HttpClient) { }

  getSubscriptionPlans(): Observable<SubscriptionPlan[]> {
    return this.http.get<SubscriptionPlan[]>(this.apiUrl);
  }

  createPayment(planId: string, paymentMethod: number): Observable<{ iframeUrl: string }> {
    return this.http.post<{ iframeUrl: string }>(`${environment.apiUrl}/payments`, {
      planId,
      paymentMethod
    });
  }

  getMyPayments(): Observable<Payment[]> {
    return this.http.get<Payment[]>(`${environment.apiUrl}/payments/my-payments`);
  }
}
