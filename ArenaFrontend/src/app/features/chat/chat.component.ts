import { CommonModule } from '@angular/common';
import { AfterViewChecked, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { catchError, finalize, of, switchMap } from 'rxjs';
import { AuthService } from '../../core/services/auth';
import { BookingEventsService } from '../../core/services/booking-events.service';
import { ChatService } from '../../core/services/chat.service';
import { ChatConversation, ChatMessage, ChatMessageBlock, ChatResponse } from '../../core/models/chat';
import { NotificationService } from '../../core/services/notification.service';
import { CreateProgressLogDto, ProgressReportService, ProgressSummaryDto } from '../../core/services/progress-report.service';
import { MemberService } from '../../core/services/member.service';
import { UpdateProfileDto } from '../../core/models/member';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslateModule],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css'],
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesViewport') private messagesViewport?: ElementRef<HTMLDivElement>;

  private readonly chatService = inject(ChatService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly bookingEvents = inject(BookingEventsService);
  private readonly notificationService = inject(NotificationService);
  private readonly location = inject(Location);
  private readonly translate = inject(TranslateService);
  private readonly progressService = inject(ProgressReportService);
  private readonly memberService = inject(MemberService);

  private t(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params);
  }

  messages: ChatMessage[] = [];
  conversations: ChatConversation[] = [];
  readonly visibleConversations = signal<ChatConversation[]>([]);
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
  sidebarOpen = false;

  // Auto-scroll state: we only stick to the bottom when the user is already there,
  // otherwise reading older messages would be impossible (the viewport kept getting
  // yanked down on every change-detection pass). `showScrollDown` drives the
  // "jump to latest" button that appears when the user has scrolled up.
  showScrollDown = false;
  private autoScrollPinned = true;
  private lastRenderSignature = '';

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

  readonly quickPrompts = ['CHAT.PROMPT_1', 'CHAT.PROMPT_2', 'CHAT.PROMPT_3'];

  showSubscriptionModal = false;

  // ── Body-composition onboarding prompt ───────────────────────────────
  // Nudge the member to fill in their body data (weight / height / body-fat /
  // muscle + goal) so the AI can tailor their workout & nutrition. Moved here
  // from the profile dashboard so it prompts right where the AI is used.
  // Driven purely by whether that data is still missing — no persisted flag —
  // and dismissable for the current visit.
  bodyPromptDismissed = false;
  private bodyStatsLoaded = false;
  private bodyProfile: { weight?: number | null; height?: number | null; goal?: string | null } | null = null;
  private bodyProgress: ProgressSummaryDto | null = null;

  /** True while the member's body-fat % or muscle mass is still missing (null/0) —
   *  the two measurements the AI needs and that a member can't self-report elsewhere.
   *  Other fields (weight/height/goal) don't trigger this onboarding nudge. */
  private bodyCompositionIncomplete(): boolean {
    if (!this.bodyProfile) return false;
    const bodyFat = this.bodyProgress?.currentBodyFat ?? null;
    const muscle = this.bodyProgress?.currentMuscleMass ?? null;
    return bodyFat == null || bodyFat === 0 || muscle == null || muscle === 0;
  }

  /** Show the popup once data has loaded, is still incomplete, hasn't been
   *  dismissed, and the subscription modal isn't already taking over. */
  get showBodyPrompt(): boolean {
    return this.bodyStatsLoaded
      && !this.bodyPromptDismissed
      && !this.showSubscriptionModal
      && this.bodyCompositionIncomplete();
  }

  // ── Inline body-composition editor (opens in-place from the prompt CTA) ──
  // Keeps the member on the chat page: the same fields the profile dashboard's
  // editor uses, saved through the same services.
  bodyEditOpen = false;
  savingBody = false;
  bodyEditError = '';
  editWeight: number | null = null;
  editHeight: number | null = null;
  editBodyFat: number | null = null;
  editMuscle: number | null = null;
  editGoal = '';

  readonly goalOptions = [
    { value: 'WeightLoss', labelKey: 'memberProfile.dash.goalWeightLoss' },
    { value: 'MuscleGain', labelKey: 'memberProfile.dash.goalMuscleGain' },
    { value: 'Endurance', labelKey: 'memberProfile.dash.goalEndurance' },
    { value: 'GeneralFitness', labelKey: 'memberProfile.dash.goalGeneralFitness' },
  ];

  /** Parse a number input, keeping blank -> null (so it can stay unset). */
  parseEditNum(v: string): number | null {
    const t = (v ?? '').trim();
    if (t === '') return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }

  /** Body fat / muscle mass, once recorded, are real measurements — they can't
   *  be cleared or reset to 0 afterwards (only updated to another real value). */
  private get bodyFatLocked(): boolean {
    const orig = this.bodyProgress?.currentBodyFat ?? null;
    return orig != null && orig > 0;
  }
  private get muscleLocked(): boolean {
    const orig = this.bodyProgress?.currentMuscleMass ?? null;
    return orig != null && orig > 0;
  }

  /** True when the member tried to wipe a previously-set body-fat/muscle value. */
  get bodyMeasurementCleared(): boolean {
    const bfCleared = this.bodyFatLocked && (this.editBodyFat == null || this.editBodyFat <= 0);
    const mmCleared = this.muscleLocked && (this.editMuscle == null || this.editMuscle <= 0);
    return bfCleared || mmCleared;
  }

  /** Mirror of the dashboard editor's positivity/percent validation, plus the
   *  rule that recorded body-fat/muscle can't be zeroed out again. */
  get bodyEditValid(): boolean {
    const positive = (v: number | null) => v == null || v > 0;
    const bf = this.editBodyFat;
    const baseValid = positive(this.editWeight) && positive(this.editHeight) && positive(this.editMuscle)
      && (bf == null || (bf > 0 && bf <= 100));
    return baseValid && !this.bodyMeasurementCleared;
  }

  /** Primary action → open the inline editor prefilled with what we know. */
  openBodyEditFromPrompt(): void {
    this.editWeight = this.bodyProfile?.weight ?? null;
    this.editHeight = this.bodyProfile?.height ?? null;
    this.editBodyFat = this.bodyProgress?.currentBodyFat ?? null;
    this.editMuscle = this.bodyProgress?.currentMuscleMass ?? null;
    this.editGoal = this.bodyProfile?.goal ?? '';
    this.bodyEditError = '';
    this.bodyEditOpen = true;
  }

  /** Cancel → back to the intro state (keeps the prompt open). */
  closeBodyEdit(): void {
    if (this.savingBody) return;
    this.bodyEditOpen = false;
    this.bodyEditError = '';
  }

  /** Persist the body composition + goal, then close the prompt. Mirrors the
   *  dashboard editor: profile fields via updateProfile, measurements via a
   *  new progress log. */
  saveBodyEdit(): void {
    if (this.savingBody || !this.bodyEditValid || !this.memberProfileId) return;

    const dto: UpdateProfileDto = {
      weight: this.editWeight ?? undefined,
      height: this.editHeight ?? undefined,
      goal: this.editGoal || undefined,
    };

    const prevWeight = this.bodyProfile?.weight ?? null;
    const bodyCompChanged =
      (this.editWeight != null && this.editWeight !== prevWeight) ||
      this.editBodyFat !== (this.bodyProgress?.currentBodyFat ?? null) ||
      this.editMuscle !== (this.bodyProgress?.currentMuscleMass ?? null);
    const logWeight = this.editWeight ?? prevWeight;
    const progressDto: CreateProgressLogDto | null =
      bodyCompChanged && logWeight != null
        ? { weight: logWeight, bodyFat: this.editBodyFat, muscleMass: this.editMuscle }
        : null;

    this.savingBody = true;
    this.bodyEditError = '';

    this.memberService
      .updateProfile(dto)
      .pipe(
        switchMap(() => (progressDto ? this.progressService.createProgressEntry(progressDto) : of(null))),
        finalize(() => (this.savingBody = false))
      )
      .subscribe({
        next: () => {
          // Reflect saved values locally so the prompt's incomplete-check clears.
          this.bodyProfile = {
            weight: this.editWeight ?? this.bodyProfile?.weight ?? null,
            height: this.editHeight ?? this.bodyProfile?.height ?? null,
            goal: this.editGoal || this.bodyProfile?.goal || null,
          };
          this.bodyProgress = {
            currentWeight: logWeight ?? this.bodyProgress?.currentWeight ?? 0,
            currentBodyFat: this.editBodyFat ?? this.bodyProgress?.currentBodyFat ?? null,
            currentMuscleMass: this.editMuscle ?? this.bodyProgress?.currentMuscleMass ?? null,
            weightChange: this.bodyProgress?.weightChange ?? null,
            bodyFatChange: this.bodyProgress?.bodyFatChange ?? null,
            muscleMassChange: this.bodyProgress?.muscleMassChange ?? null,
            logs: this.bodyProgress?.logs ?? [],
          };
          this.bodyEditOpen = false;
          this.bodyPromptDismissed = true;
        },
        error: (err: { error?: unknown; message?: string }) => {
          const e = err?.error;
          const msg = Array.isArray(e)
            ? e.join(', ')
            : typeof e === 'string'
              ? e
              : (e as { message?: string; title?: string })?.message ??
                (e as { title?: string })?.title ??
                err?.message;
          this.bodyEditError = msg || this.t('memberProfile.dash.saveFailed');
        },
      });
  }

  /** "Later" / close / backdrop → hide for this visit; reappears next time
   *  while data is still missing. */
  dismissBodyPrompt(): void {
    if (this.savingBody) return;
    this.bodyPromptDismissed = true;
    this.bodyEditOpen = false;
  }

  /** Load progress-derived body-fat/muscle so the incomplete check matches the
   *  profile dashboard's original logic. */
  private loadBodyStats(): void {
    this.progressService
      .getProgress()
      .pipe(
        catchError(() => of(null as ProgressSummaryDto | null)),
        finalize(() => (this.bodyStatsLoaded = true))
      )
      .subscribe((progress) => (this.bodyProgress = progress));
  }

  ngOnInit(): void {
    if (!this.auth.isLoggedIn) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/chat' } });
      return;
    }

    this.sidebarOpen = typeof window !== 'undefined' && window.innerWidth > 900;
    this.messages = [this.createAssistantWelcome()];
    this.auth
      .getMe()
      .pipe(finalize(() => (this.loadingHistory = false)))
      .subscribe({
        next: (profile) => {
          this.memberProfileId = profile?.memberProfileId ?? profile?.id ?? '';

          if (!profile?.activeSubscription || !profile.activeSubscription.hasAI) {
            this.showSubscriptionModal = true;
            this.loadingConversations = false;
            return;
          }

          this.bodyProfile = { weight: profile.weight, height: profile.height, goal: profile.goal };
          this.loadBodyStats();
          this.loadConversations();
        },
        error: () => {
          this.error = this.t('CHAT.ERR_SUBSCRIPTION');
          this.loadingConversations = false;
        },
      });
  }

  goToSubscription(): void {
    this.showSubscriptionModal = false;
    this.router.navigate(['/'], { fragment: 'membership' });
  }

  goToHome(): void {
    this.showSubscriptionModal = false;
    if (typeof window !== 'undefined' && window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/']);
    }
  }

  ngAfterViewChecked(): void {
    // Only scroll when the rendered content actually changed (new message, or the
    // typing/transcribing indicator toggled) AND the user is pinned to the bottom.
    // This is what fixes the scroll malfunction: previously every CD pass forced
    // the viewport down, so manual scroll-up was impossible.
    const signature = `${this.messages.length}|${this.sending}|${this.transcribing}`;
    if (signature !== this.lastRenderSignature) {
      this.lastRenderSignature = signature;
      if (this.autoScrollPinned) {
        this.scrollToBottom();
      }
    }
  }

  /** Track whether the user is at (or near) the bottom of the message list. */
  onMessagesScroll(): void {
    const element = this.messagesViewport?.nativeElement;
    if (!element) {
      return;
    }
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    this.autoScrollPinned = distanceFromBottom < 120;
    this.showScrollDown = !this.autoScrollPinned;
  }

  /** "Jump to latest" button — re-pins the view and scrolls to the newest message. */
  scrollToLatest(): void {
    this.autoScrollPinned = true;
    this.showScrollDown = false;
    this.scrollToBottom(true);
  }

  usePrompt(promptKey: string): void {
    // quickPrompts hold i18n keys; drop the resolved text into the composer.
    this.draft = this.t(promptKey);
  }

  /** Suggestion chips are shown in the empty new-chat state only — they vanish
   *  as soon as the conversation has a user message (or one is being sent). */
  get showQuickPrompts(): boolean {
    return (
      !this.loadingHistory &&
      !this.sending &&
      !this.transcribing &&
      !this.messages.some((message) => message.sender === 'user')
    );
  }

  /** Click a suggestion in the empty state → fill and send it immediately. */
  startWithPrompt(promptKey: string): void {
    this.draft = this.t(promptKey);
    this.send();
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  closeSidebar(): void {
    if (typeof window !== 'undefined' && window.innerWidth <= 900) {
      this.sidebarOpen = false;
    }
  }

  /** Force-close sidebar on any screen size (used by close button) */
  forceCloseSidebar(): void {
    this.sidebarOpen = false;
  }

  newChat(): void {
    if (!this.memberProfileId || this.creatingChat) {
      return;
    }

    this.creatingChat = true;
    this.error = '';

    this.chatService
      .createConversation({ memberProfileId: this.memberProfileId, title: this.t('CHAT.NEW_CHAT_TITLE') })
      .pipe(finalize(() => (this.creatingChat = false)))
      .subscribe({
        next: (conversation) => {
          this.conversations = [conversation, ...this.conversations];
          this.syncConversations();
          this.conversationId = conversation.id;
          this.messages = [this.createAssistantWelcome()];
          this.draft = '';
          this.autoScrollPinned = true;
          this.closeSidebar();
        },
        error: (err: Error) => {
          this.error = err.message || this.t('CHAT.ERR_CREATE');
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
    this.autoScrollPinned = true;
    this.closeSidebar();

    this.chatService
      .getHistory(conversation.id)
      .pipe(finalize(() => (this.loadingHistory = false)))
      .subscribe({
        next: (messages) => {
          this.messages = messages.length ? messages : [this.createAssistantWelcome()];
        },
        error: () => {
          this.messages = [this.createAssistantWelcome()];
          this.error = this.t('CHAT.ERR_LOAD');
        },
      });
  }

  async deleteConversation(conversation: ChatConversation, event: MouseEvent): Promise<void> {
    event.stopPropagation();

    if (this.deletingConversationId) {
      return;
    }

    const title = conversation.title || this.t('CHAT.THIS_CHAT');

    // Show premium confirmation dialog instead of browser confirm
    const confirmed = await this.notificationService.confirm(
      this.t('CHAT.DELETE_TITLE'),
      this.t('CHAT.DELETE_CONFIRM', { title }),
      this.t('CHAT.DELETE_ACTION'),
      this.t('CHAT.CANCEL'),
      this.t('CHAT.CONFIRM_ACTION')
    );

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
          this.syncConversations();

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
          this.error = err.message || this.t('CHAT.ERR_DELETE');
        },
      });
  }

  private syncConversations(): void {
    this.visibleConversations.set(this.conversations);
  }

  send(): void {
    const message = this.draft.trim();

    if (!message || this.sending) {
      return;
    }

    if (!this.memberProfileId) {
      this.error = this.t('CHAT.ERR_PROFILE');
      return;
    }

    this.error = '';
    this.draft = '';
    this.sending = true;
    this.autoScrollPinned = true;
    this.messages = [...this.messages, this.createMessage('user', message)];

    this.chatService
      .sendMessage({ memberProfileId: this.memberProfileId, message, conversationId: this.conversationId })
      .pipe(finalize(() => (this.sending = false)))
      .subscribe({
        next: (response) => this.handleResponse(response),
        error: (err: Error) => {
          this.error = err.message || this.t('CHAT.ERR_SERVICE');
        },
      });
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      this.send();
    }
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
      this.error = this.t('CHAT.ERR_PROFILE');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      this.error = this.t('CHAT.ERR_VOICE_UNSUPPORTED');
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
      this.error = this.t('CHAT.ERR_MIC_BLOCKED');
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
            this.error = this.t('CHAT.ERR_VOICE_UNCLEAR');
            this.voiceRetry = true;
            return;
          }

          this.objectUrls.push(audioUrl);
          this.autoScrollPinned = true;
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
          this.error = err.message || this.t('CHAT.ERR_VOICE_SEND');
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
      this.createMessage('assistant', reply || this.t('CHAT.DEFAULT_REPLY')),
    ];
    this.loadConversations(false);
  }

  private createAssistantWelcome(): ChatMessage {
    return this.createMessage('assistant', '', { i18nKey: 'CHAT.WELCOME' });
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


  private scrollToBottom(smooth = false): void {
    const element = this.messagesViewport?.nativeElement;

    if (!element) {
      return;
    }

    // Defer to the next frame so the freshly-rendered content is measured before we
    // scroll — otherwise scrollHeight can lag one message behind.
    requestAnimationFrame(() => {
      element.scrollTo({ top: element.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
      this.showScrollDown = false;
    });
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
        this.syncConversations();
        // Do NOT auto-open the last conversation: Arena always opens on a fresh
        // new chat (welcome + suggestions). Past chats stay available in history.
      });
  }
}
