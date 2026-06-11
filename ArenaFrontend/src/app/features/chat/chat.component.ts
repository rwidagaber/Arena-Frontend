import { CommonModule } from '@angular/common';
import { AfterViewChecked, Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/services/auth';
import { ChatService } from '../../core/services/chat.service';
import { ChatConversation, ChatMessage, ChatMessageBlock, ChatResponse } from '../../core/models/chat';
// import { HeaderComponent } from '../../shared/header/header';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css'],
})
export class ChatComponent implements OnInit, AfterViewChecked {
  @ViewChild('messagesViewport') private messagesViewport?: ElementRef<HTMLDivElement>;

  private readonly chatService = inject(ChatService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  messages: ChatMessage[] = [];
  conversations: ChatConversation[] = [];
  draft = '';
  loadingHistory = true;
  loadingConversations = true;
  sending = false;
  creatingChat = false;
  deletingConversationId = '';
  error = '';
  conversationId?: string;
  memberProfileId = '';

  readonly quickPrompts = [
    'Build me a balanced workout plan',
    'What should I eat before training?',
    'How can I recover faster?',
  ];

  ngOnInit(): void {
    if (!this.auth.isLoggedIn) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/chat' } });
      return;
    }

    this.messages = [this.createAssistantWelcome()];
    this.auth
      .getMe()
      .pipe(finalize(() => (this.loadingHistory = false)))
      .subscribe({
        next: (profile) => {
          if (!profile?.activeSubscription) {
            this.router.navigate(['/home']);
            return;
          }

          this.memberProfileId = profile.id;
          this.loadConversations();
        },
        error: () => {
          this.error = 'We could not verify your subscription. Please sign in again.';
          this.loadingConversations = false;
        },
      });
  }

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  usePrompt(prompt: string): void {
    this.draft = prompt;
  }

  newChat(): void {
    if (!this.memberProfileId || this.creatingChat) {
      return;
    }

    this.creatingChat = true;
    this.error = '';

    this.chatService
      .createConversation({ memberProfileId: this.memberProfileId, title: 'New Chat' })
      .pipe(finalize(() => (this.creatingChat = false)))
      .subscribe({
        next: (conversation) => {
          this.conversations = [conversation, ...this.conversations];
          this.conversationId = conversation.id;
          this.messages = [this.createAssistantWelcome()];
          this.draft = '';
        },
        error: (err: Error) => {
          this.error = err.message || 'Could not create a new chat right now.';
        },
      });
  }

  openConversation(conversation: ChatConversation): void {
    if (this.conversationId === conversation.id || this.loadingHistory) {
      return;
    }

    this.conversationId = conversation.id;
    this.error = '';
    this.loadingHistory = true;

    this.chatService
      .getHistory(conversation.id)
      .pipe(finalize(() => (this.loadingHistory = false)))
      .subscribe({
        next: (messages) => {
          this.messages = messages.length ? messages : [this.createAssistantWelcome()];
        },
        error: () => {
          this.messages = [this.createAssistantWelcome()];
          this.error = 'Could not load this conversation.';
        },
      });
  }

  deleteConversation(conversation: ChatConversation, event: MouseEvent): void {
    event.stopPropagation();

    if (this.deletingConversationId) {
      return;
    }

    const title = conversation.title || 'this chat';
    const confirmed = window.confirm(`Delete "${title}"? This cannot be undone.`);

    if (!confirmed) {
      return;
    }

    this.deletingConversationId = conversation.id;
    this.error = '';

    this.chatService
      .deleteConversation(conversation.id)
      .pipe(finalize(() => (this.deletingConversationId = '')))
      .subscribe({
        next: () => {
          const wasActive = this.conversationId === conversation.id;
          this.conversations = this.conversations.filter((item) => item.id !== conversation.id);

          if (!wasActive) {
            return;
          }

          this.conversationId = undefined;
          this.messages = [this.createAssistantWelcome()];

          if (this.conversations.length) {
            this.openConversation(this.conversations[0]);
          }
        },
        error: (err: Error) => {
          this.error = err.message || 'Could not delete this chat right now.';
        },
      });
  }

  send(): void {
    const message = this.draft.trim();

    if (!message || this.sending) {
      return;
    }

    if (!this.memberProfileId) {
      this.error = 'Please complete your profile before using chat.';
      return;
    }

    this.error = '';
    this.draft = '';
    this.sending = true;
    this.messages = [...this.messages, this.createMessage('user', message)];

    this.chatService
      .sendMessage({ memberProfileId: this.memberProfileId, message, conversationId: this.conversationId })
      .pipe(finalize(() => (this.sending = false)))
      .subscribe({
        next: (response) => this.handleResponse(response),
        error: (err: Error) => {
          this.error = err.message || 'The chat service is not available right now.';
        },
      });
  }

  trackMessage(index: number, message: ChatMessage): string {
    return message.id ?? `${message.sender}-${message.createdAt}-${index}`;
  }

  trackConversation(_index: number, conversation: ChatConversation): string {
    return conversation.id;
  }

  formatMessage(content: string): ChatMessageBlock[] {
    const lines = content
      .replace(/\r/g, '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length) {
      return [{ type: 'paragraph', text: '' }];
    }

    const blocks: ChatMessageBlock[] = [];
    let pendingList: string[] = [];
    let pendingOrderedList: string[] = [];

    const flushLists = (): void => {
      if (pendingList.length) {
        blocks.push({ type: 'list', items: pendingList });
        pendingList = [];
      }

      if (pendingOrderedList.length) {
        blocks.push({ type: 'ordered-list', items: pendingOrderedList });
        pendingOrderedList = [];
      }
    };

    for (const line of lines) {
      const heading = line.match(/^#{1,3}\s+(.+)$/);
      const bullet = line.match(/^[-*\u2022]\s+(.+)$/);
      const numbered = line.match(/^\d+[.)]\s+(.+)$/);
      const label = line.match(/^([A-Z][A-Za-z\s]{2,28}):\s*(.*)$/);

      if (bullet) {
        pendingList.push(this.cleanMessageText(bullet[1]));
        continue;
      }

      if (numbered) {
        pendingOrderedList.push(this.cleanMessageText(numbered[1]));
        continue;
      }

      flushLists();

      if (heading) {
        blocks.push({ type: 'heading', text: this.cleanMessageText(heading[1]) });
      } else if (label) {
        blocks.push({ type: 'heading', text: this.cleanMessageText(label[1]) });

        if (label[2]) {
          blocks.push({ type: 'paragraph', text: this.cleanMessageText(label[2]) });
        }
      } else {
        blocks.push({ type: 'paragraph', text: this.cleanMessageText(line) });
      }
    }

    flushLists();
    return blocks;
  }

  private cleanMessageText(text: string): string {
    return text.replace(/\*\*/g, '').trim();
  }

  private handleResponse(response: ChatResponse): void {
    this.conversationId = response.conversationId ?? this.conversationId;

    if (response.messages?.length) {
      this.messages = response.messages;
      return;
    }

    const reply =
      response.message ?? response.messageText ?? response.response ?? response.reply ?? response.answer ?? response.content;

    this.messages = [
      ...this.messages,
      this.createMessage('assistant', reply || 'I received your message.'),
    ];
    this.loadConversations(false);
  }

  private createAssistantWelcome(): ChatMessage {
    return this.createMessage(
      'assistant',
      'Hey, I am your Arena assistant. Ask me about training, nutrition, recovery, or your next step in the gym.'
    );
  }

  private createMessage(sender: ChatMessage['sender'], content: string): ChatMessage {
    return {
      sender,
      content,
      createdAt: new Date().toISOString(),
    };
  }

  private scrollToBottom(): void {
    const element = this.messagesViewport?.nativeElement;

    if (!element) {
      return;
    }

    element.scrollTop = element.scrollHeight;
  }

  private loadConversations(showLoading = true): void {
    if (!this.memberProfileId) {
      this.loadingConversations = false;
      return;
    }

    if (showLoading) {
      this.loadingConversations = true;
    }

    this.chatService
      .getConversations(this.memberProfileId)
      .pipe(finalize(() => (this.loadingConversations = false)))
      .subscribe((conversations) => {
        this.conversations = conversations;

        if (!this.conversationId && conversations.length) {
          this.openConversation(conversations[0]);
        }
      });
  }
}
