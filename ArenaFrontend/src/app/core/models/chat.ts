export type ChatSender = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id?: string;
  sender: ChatSender;
  content: string;
  createdAt: string;
}

export interface ChatRequest {
  memberProfileId: string;
  message: string;
  conversationId?: string;
}

export interface ChatConversation {
  id: string;
  title: string;
  startedAt: string;
  messageCount: number;
  lastMessage: string;
}

export interface CreateConversationRequest {
  memberProfileId: string;
  title?: string;
}

export interface ChatMessageBlock {
  type: 'paragraph' | 'heading' | 'list' | 'ordered-list';
  text?: string;
  items?: string[];
}

export interface ChatResponse {
  id?: string;
  conversationId?: string;
  message?: string;
  messageText?: string;
  response?: string;
  reply?: string;
  answer?: string;
  content?: string;
  sender?: string;
  sentAt?: string;
  timestamp?: string;
  messages?: ChatMessage[];
}
