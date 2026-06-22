import { CommonModule } from '@angular/common';
import { AfterViewChecked, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
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
  // Failed/garbled voice note kept so the user can retry without re-recording.
  voiceRetry = false;
  private lastVoiceBlob?: Blob;
  readonly maxRecordingSeconds = 60;
  // Denser, bell-shaped live waveform for the recording bar.
  readonly waveBars = [0.3, 0.5, 0.7, 0.85, 0.95, 1, 0.95, 0.85, 0.7, 0.5, 0.3];

  // Voice-note in-bubble player state
  playingClip?: ChatMessage;
  clipProgress = 0; // 0..1 for the currently playing clip
  clipElapsed = 0; // seconds, currently playing clip
  // Static decorative waveform for the voice-note player (filled by progress).
  readonly playerBars = [
    0.4, 0.7, 0.5, 0.9, 0.6, 1, 0.55, 0.8, 0.45, 0.65, 0.85, 0.5, 0.7, 0.95,
    0.6, 0.4, 0.75, 0.55, 0.9, 0.65, 0.5, 0.8, 0.45, 0.7, 0.6, 0.85, 0.5, 0.4,
  ];
  private readonly clipDurations = new Map<ChatMessage, number>();
  private activeAudio?: HTMLAudioElement;

  private mediaRecorder?: MediaRecorder;
  private audioChunks: Blob[] = [];
  private mediaStream?: MediaStream;
  private recordingTimer?: ReturnType<typeof setInterval>;
  private audioContext?: AudioContext;
  private analyser?: AnalyserNode;
  private levelRaf?: number;
  private cancelled = false;
  private readonly objectUrls: string[] = [];
  // Container/codec the recorder actually used (varies by browser) so the uploaded
  // blob + filename match what was recorded — otherwise transcription can reject it.
  private recorderMime = '';
  // We measure the clip length ourselves; WebM blobs from MediaRecorder usually report
  // no duration metadata, so relying on <audio>.duration alone shows 0:00 / Infinity.
  private recordingStartedAt = 0;
  private lastRecordingDuration = 0;

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
      this.recorderMime = this.pickRecorderMime();
      this.mediaRecorder = this.recorderMime
        ? new MediaRecorder(stream, { mimeType: this.recorderMime })
        : new MediaRecorder(stream);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.lastRecordingDuration = this.recordingStartedAt
          ? (Date.now() - this.recordingStartedAt) / 1000
          : 0;
        this.teardownRecording();
        stream.getTracks().forEach((track) => track.stop());
        const type = this.mediaRecorder?.mimeType || this.recorderMime || 'audio/webm';
        const blob = new Blob(this.audioChunks, { type });

        if (this.cancelled) {
          this.cancelled = false;
          this.transcribing = false;
          return;
        }

        if (blob.size > 0) {
          this.sendVoice(blob);
        } else {
          this.transcribing = false;
        }
      };

      this.mediaRecorder.start();
      this.recording = true;
      this.recordingSeconds = 0;
      this.recordingStartedAt = Date.now();
      this.error = '';
      this.startTimer();
      this.startLevelMeter(stream);
    } catch {
      this.error = 'Microphone access was blocked. Please allow it and try again.';
    }
  }

  /** Pick a container/codec this browser can actually record (Chrome/Firefox: webm, Safari: mp4). */
  private pickRecorderMime(): string {
    const supported = (window as { MediaRecorder?: { isTypeSupported?(t: string): boolean } }).MediaRecorder
      ?.isTypeSupported;
    if (typeof supported !== 'function') {
      return '';
    }
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
    return candidates.find((type) => supported(type)) ?? '';
  }

  private extensionFor(mimeType: string): string {
    if (mimeType.includes('mp4') || mimeType.includes('mpeg')) {
      return 'mp4';
    }
    if (mimeType.includes('ogg')) {
      return 'ogg';
    }
    return 'webm';
  }

  private stopRecording(): void {
    if (this.mediaRecorder && this.recording) {
      // Show the "Transcribing…" indicator the instant the user taps stop, rather than
      // waiting for the recorder to flush (onstop) and the upload to begin.
      this.transcribing = true;
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
    const safe = Math.max(0, Math.floor(totalSeconds || 0));
    const minutes = Math.floor(safe / 60);
    const seconds = safe % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  /** Play / pause a voice note's clip in its chat bubble (one at a time). */
  toggleClip(audio: HTMLAudioElement, message: ChatMessage): void {
    if (this.activeAudio && this.activeAudio !== audio) {
      this.activeAudio.pause();
    }

    if (audio.paused) {
      this.activeAudio = audio;
      this.playingClip = message;
      this.clipElapsed = audio.currentTime;
      void audio.play().catch(() => undefined);
    } else {
      audio.pause();
      this.playingClip = undefined;
    }
  }

  isClipPlaying(message: ChatMessage): boolean {
    return this.playingClip === message;
  }

  clipDurationOf(message: ChatMessage): number {
    return this.clipDurations.get(message) ?? 0;
  }

  /** Whether a player waveform bar should appear "played" given progress. */
  clipBarFilled(message: ChatMessage, index: number): boolean {
    return this.playingClip === message && (index + 0.5) / this.playerBars.length <= this.clipProgress;
  }

  onClipTime(message: ChatMessage, audio: HTMLAudioElement): void {
    if (this.playingClip !== message) {
      return;
    }
    this.clipElapsed = audio.currentTime;
    const duration = this.clipDurations.get(message) ?? 0;
    this.clipProgress = duration > 0 ? Math.min(1, audio.currentTime / duration) : 0;
  }

  onClipMeta(message: ChatMessage, audio: HTMLAudioElement): void {
    const duration = audio.duration;
    if (duration && isFinite(duration) && duration < 1e6) {
      this.clipDurations.set(message, duration);
      if (audio.currentTime > 1e6) {
        audio.currentTime = 0;
      }
    } else if (duration === Infinity && !this.clipDurations.has(message)) {
      // WebM blobs report Infinity until seeked; force the browser to resolve it.
      // Skipped when we already measured the length, so currentTime never gets stranded.
      audio.currentTime = 1e101;
    }
  }

  onClipEnded(message: ChatMessage): void {
    if (this.playingClip === message) {
      this.playingClip = undefined;
      this.clipProgress = 0;
      this.clipElapsed = 0;
    }
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

  private sendVoice(blob: Blob): void {
    // Keep the clip so a failed/garbled attempt can be retried without re-recording (#8).
    this.lastVoiceBlob = blob;
    this.transcribing = true;
    this.error = '';
    this.voiceRetry = false;

    const audioUrl = URL.createObjectURL(blob);
    const extension = this.extensionFor(blob.type);

    const formData = new FormData();
    formData.append('audio', blob, `voice-command.${extension}`);
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

          // Empty/garbled transcription (#9): don't post a blank bubble or the
          // backend's "couldn't understand" reply — surface a clear retry instead.
          if (!transcript) {
            URL.revokeObjectURL(audioUrl);
            this.error = "I couldn't understand that voice note. Please speak clearly and try again.";
            this.voiceRetry = true;
            return;
          }

          this.objectUrls.push(audioUrl);
          const voiceMessage = this.createMessage('user', transcript,  { isVoice: true, audioUrl });
          // Seed the duration we measured while recording so the player shows the real
          // length immediately, even before <audio> metadata resolves (or if it never does).
          if (this.lastRecordingDuration > 0) {
            this.clipDurations.set(voiceMessage, this.lastRecordingDuration);
          }
          this.messages = [...this.messages, voiceMessage];
          this.lastVoiceBlob = undefined; // sent successfully — nothing to retry
          this.handleResponse(response);
        },
        error: (err: Error) => {
          // Upload/network failure (#8): keep the clip, offer a retry.
          URL.revokeObjectURL(audioUrl);
          this.error = err.message || 'Could not send your voice note. Please try again.';
          this.voiceRetry = true;
        },
      });
  }

  /** Resend the last recorded clip after a failure or unclear transcription (#8/#9). */
  retryVoice(): void {
    if (this.lastVoiceBlob && !this.transcribing && !this.sending) {
      this.sendVoice(this.lastVoiceBlob);
    }
  }

  /** Discard the failed clip and clear the retry prompt. */
  dismissVoiceRetry(): void {
    this.voiceRetry = false;
    this.error = '';
    this.lastVoiceBlob = undefined;
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
    this.activeAudio?.pause();
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
