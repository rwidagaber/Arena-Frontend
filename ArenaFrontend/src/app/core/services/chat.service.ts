import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ChatConversation,
  ChatMessage,
  ChatRequest,
  ChatResponse,
  CreateConversationRequest,
} from '../models/chat';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/chat`;

  getConversations(memberProfileId: string): Observable<ChatConversation[]> {
    if (!memberProfileId) {
      return of([]);
    }

    return this.http
      .get<ChatConversation[]>(`${this.baseUrl}/conversations/${memberProfileId}`)
      .pipe(
        map((conversations) => conversations ?? []),
        catchError(() => of([]))
      );
  }

  getHistory(conversationId?: string): Observable<ChatMessage[]> {
    if (!conversationId) {
      return of([]);
    }

    return this.http
      .get<ChatResponse[]>(`${this.baseUrl}/conversations/${conversationId}/messages`)
      .pipe(
        map((messages) => messages.map((message) => this.normalizeBackendMessage(message))),
        catchError(() => of([]))
      );
  }

  createConversation(request: CreateConversationRequest): Observable<ChatConversation> {
    return this.http.post<ChatConversation>(`${this.baseUrl}/conversations`, {
      memberProfileId: request.memberProfileId,
      title: request.title ?? 'New Chat',
    });
  }

  deleteConversation(conversationId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/conversations/${conversationId}`);
  }

  sendMessage(request: ChatRequest): Observable<ChatResponse> {
    return this.http.post<ChatResponse>(this.baseUrl, request).pipe(
      map((response) => this.normalizeResponse(response))
    );
  }

  private normalizeResponse(response: ChatResponse | string): ChatResponse {
    if (typeof response === 'string') {
      return { message: response };
    }

    return {
      ...response,
      message: response.message ?? response.reply,
    };
  }

  private normalizeBackendMessage(message: ChatResponse): ChatMessage {
    return {
      id: message.id,
      sender: message.sender?.toLowerCase() === 'user' ? 'user' : 'assistant',
      content: message.messageText ?? message.content ?? '',
      createdAt: message.sentAt ?? message.timestamp ?? new Date().toISOString(),
    };
  }
}
