import { CommonModule } from '@angular/common';
import { AfterViewChecked, Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/services/auth';
import { BookingEventsService } from '../../core/services/booking-events.service';
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
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesViewport') private messagesViewport?: ElementRef<HTMLDivElement>;

  private readonly chatService = inject(ChatService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly bookingEvents = inject(BookingEventsService);
  private readonly zone = inject(NgZone);

  messages: ChatMessage[] = [];
  conversations: ChatConversation[] = [];
  draft = '';
  loadingHistory = true;
  loadingConversations = true;
  sending = false;
  recording = false;
  transcribing = false;
  creatingChat = false;
  deletingConversationId = '';
  error = '';
  conversationId?: string;
  memberProfileId = '';

  // Voice recording UX state
  recordingSeconds = 0;
  audioLevel = 0;
  speakingMessage?: ChatMessage;
  readonly maxRecordingSeconds = 60;
  readonly waveBars = [0.45, 0.75, 1, 0.75, 0.45];

  private mediaRecorder?: MediaRecorder;
  private audioChunks: Blob[] = [];
  private mediaStream?: MediaStream;
  private recordingTimer?: ReturnType<typeof setInterval>;
  private audioContext?: AudioContext;
  private analyser?: AnalyserNode;
  private levelRaf?: number;
  private cancelled = false;
  private readonly objectUrls: string[] = [];

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

          this.memberProfileId = profile.memberProfileId ?? profile.id;
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

  toggleRecording(): void {
    if (this.recording) {
      this.stopRecording();
    } else {
      void this.startRecording();
    }
  }

  private async startRecording(): Promise<void> {
    if (this.sending || this.transcribing) {
      return;
    }

    if (!this.memberProfileId) {
      this.error = 'Please complete your profile before using chat.';
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      this.error = 'Voice recording is not supported in this browser.';
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaStream = stream;
      this.audioChunks = [];
      this.cancelled = false;
      this.mediaRecorder = new MediaRecorder(stream);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.teardownRecording();
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(this.audioChunks, { type: 'audio/webm' });

        if (this.cancelled) {
          this.cancelled = false;
          return;
        }

        if (blob.size > 0) {
          this.sendVoice(blob);
        }
      };

      this.mediaRecorder.start();
      this.recording = true;
      this.recordingSeconds = 0;
      this.error = '';
      this.startTimer();
      this.startLevelMeter(stream);
    } catch {
      this.error = 'Microphone access was blocked. Please allow it and try again.';
    }
  }

  private stopRecording(): void {
    if (this.mediaRecorder && this.recording) {
      this.mediaRecorder.stop();
      this.recording = false;
    }
  }

  /** Stop recording and throw the clip away without sending it. */
  cancelRecording(): void {
    if (this.mediaRecorder && this.recording) {
      this.cancelled = true;
      this.mediaRecorder.stop();
      this.recording = false;
      this.recordingSeconds = 0;
    }
  }

  formatDuration(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  /** Read an assistant reply aloud (browser text-to-speech). */
  toggleSpeak(message: ChatMessage): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.error = 'Text-to-speech is not supported in this browser.';
      return;
    }

    if (this.speakingMessage === message) {
      this.stopSpeaking();
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(this.cleanForSpeech(message.content));
    const clear = () => this.zone.run(() => {
      if (this.speakingMessage === message) {
        this.speakingMessage = undefined;
      }
    });
    utterance.onend = clear;
    utterance.onerror = clear;
    this.speakingMessage = message;
    window.speechSynthesis.speak(utterance);
  }

  stopSpeaking(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.speakingMessage = undefined;
  }

  private startTimer(): void {
    this.recordingTimer = setInterval(() => {
      this.recordingSeconds += 1;
      if (this.recordingSeconds >= this.maxRecordingSeconds) {
        this.stopRecording();
      }
    }, 1000);
  }

  private startLevelMeter(stream: MediaStream): void {
    try {
      const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      const data = new Uint8Array(this.analyser.frequencyBinCount);
      const tick = () => {
        if (!this.analyser) {
          return;
        }
        this.analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i += 1) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        this.audioLevel = Math.min(1, rms * 3.2);
        this.levelRaf = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // Level meter is optional — recording still works without it.
    }
  }

  private teardownRecording(): void {
    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
      this.recordingTimer = undefined;
    }
    if (this.levelRaf) {
      cancelAnimationFrame(this.levelRaf);
      this.levelRaf = undefined;
    }
    this.analyser = undefined;
    if (this.audioContext) {
      void this.audioContext.close().catch(() => undefined);
      this.audioContext = undefined;
    }
    this.audioLevel = 0;
  }

  private cleanForSpeech(text: string): string {
    return text
      // strip markdown emphasis / heading markers
      .replace(/[#*_`>]/g, '')
      // strip emoji & pictographs (incl. flags, skin tones, variation selectors, ZWJ, keycaps)
      .replace(
        /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}]/gu,
        ''
      )
      // collapse the whitespace left behind
      .replace(/\s+/g, ' ')
      .trim();
  }

  private sendVoice(blob: Blob): void {
    this.transcribing = true;
    this.error = '';

    const audioUrl = URL.createObjectURL(blob);
    this.objectUrls.push(audioUrl);

    const formData = new FormData();
    formData.append('audio', blob, 'voice-command.webm');
    formData.append('memberProfileId', this.memberProfileId);

    if (this.conversationId) {
      formData.append('conversationId', this.conversationId);
    }

    this.chatService
      .sendVoiceMessage(formData)
      .pipe(finalize(() => (this.transcribing = false)))
      .subscribe({
        next: (response) => {
          const transcript = response.transcript?.trim();

          if (transcript) {
            this.messages = [
              ...this.messages,
              this.createMessage('user', transcript, { isVoice: true, audioUrl }),
            ];
          }

          this.handleResponse(response);
        },
        error: (err: Error) => {
          this.error = err.message || 'Could not process your voice note. Please try again.';
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

    if (response.bookingChanged) {
      this.bookingEvents.notifyBookingsChanged();
    }

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

  private createMessage(
    sender: ChatMessage['sender'],
    content: string,
    extra: Partial<ChatMessage> = {}
  ): ChatMessage {
    return {
      sender,
      content,
      createdAt: new Date().toISOString(),
      ...extra,
    };
  }

  ngOnDestroy(): void {
    this.stopSpeaking();
    this.teardownRecording();
    this.mediaStream?.getTracks().forEach((track) => track.stop());
    this.objectUrls.forEach((url) => URL.revokeObjectURL(url));
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
