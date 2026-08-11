export const GENERATED_GAME_CUE_IDS = Object.freeze([
  "bounce",
  "brick",
  "life-loss",
  "level-clear",
  "win",
] as const);

export type GeneratedGameCueId = (typeof GENERATED_GAME_CUE_IDS)[number];

export interface GeneratedAudioParamLike {
  value: number;
  setValueAtTime(value: number, startTime: number): void;
  exponentialRampToValueAtTime(value: number, endTime: number): void;
}

export interface GeneratedOscillatorLike {
  type: "sine" | "square" | "sawtooth" | "triangle";
  readonly frequency: GeneratedAudioParamLike;
  onended: (() => void) | null;
  connect(destination: unknown): unknown;
  disconnect(): void;
  start(when?: number): void;
  stop(when?: number): void;
}

export interface GeneratedGainLike {
  readonly gain: GeneratedAudioParamLike;
  connect(destination: unknown): unknown;
  disconnect(): void;
}

/** Minimal injectable oscillator-only Web Audio surface. */
export interface GeneratedAudioContextLike {
  state: "suspended" | "running" | "closed" | "interrupted";
  readonly currentTime: number;
  readonly destination: unknown;
  createOscillator(): GeneratedOscillatorLike;
  createGain(): GeneratedGainLike;
  resume(): Promise<void>;
  close(): Promise<void>;
}

export type GeneratedCueStatus =
  | "played"
  | "waiting-for-user-activation"
  | "disabled"
  | "muted"
  | "unavailable"
  | "dropped-limit"
  | "disposed";

export interface GeneratedCueResult {
  readonly cueId: GeneratedGameCueId;
  readonly status: GeneratedCueStatus;
  readonly reasonCode: string;
}

export interface GeneratedCueActivationResult {
  readonly status: "ready" | "waiting-for-user-activation" | "disabled" | "muted" | "unavailable" | "disposed";
  readonly reasonCode: string;
}

export interface CreateGeneratedGameCuePlayerOptions {
  /** Result of the host's remote feature-flag evaluation. */
  readonly featureEnabled: boolean;
  readonly muted?: boolean;
  readonly maximumVoices?: number;
  readonly volume?: number;
  readonly contextFactory?: () => GeneratedAudioContextLike;
}

export interface GeneratedGameCuePlayer {
  activate(hasUserActivation: boolean): Promise<GeneratedCueActivationResult>;
  play(cueId: GeneratedGameCueId): GeneratedCueResult;
  setMuted(muted: boolean): void;
  stopAll(): number;
  dispose(): Promise<void>;
}

interface CueShape {
  readonly type: GeneratedOscillatorLike["type"];
  readonly startFrequency: number;
  readonly endFrequency: number;
  readonly durationSeconds: number;
}

const cueShapes: Readonly<Record<GeneratedGameCueId, CueShape>> = Object.freeze({
  bounce: { type: "sine", startFrequency: 440, endFrequency: 520, durationSeconds: 0.055 },
  brick: { type: "square", startFrequency: 620, endFrequency: 740, durationSeconds: 0.075 },
  "life-loss": { type: "sawtooth", startFrequency: 220, endFrequency: 82, durationSeconds: 0.32 },
  "level-clear": { type: "triangle", startFrequency: 523, endFrequency: 784, durationSeconds: 0.28 },
  win: { type: "sine", startFrequency: 659, endFrequency: 988, durationSeconds: 0.48 },
});

interface Voice {
  readonly oscillator: GeneratedOscillatorLike;
  readonly gain: GeneratedGainLike;
}

function defaultContextFactory(): GeneratedAudioContextLike {
  const scope = globalThis as unknown as {
    AudioContext?: new () => GeneratedAudioContextLike;
    webkitAudioContext?: new () => GeneratedAudioContextLike;
  };
  const Context = scope.AudioContext ?? scope.webkitAudioContext;
  if (!Context) throw new Error("GAME_AUDIO_WEB_CONTEXT_UNAVAILABLE");
  return new Context();
}

function boundedNumber(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (value === undefined) return fallback;
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error("GAME_AUDIO_WEB_GENERATED_CUE_OPTIONS_INVALID");
  }
  return value;
}

class BrowserGeneratedGameCuePlayer implements GeneratedGameCuePlayer {
  readonly #featureEnabled: boolean;
  readonly #maximumVoices: number;
  readonly #volume: number;
  readonly #contextFactory: () => GeneratedAudioContextLike;
  readonly #voices = new Set<Voice>();
  #context: GeneratedAudioContextLike | undefined;
  #muted: boolean;
  #disposed = false;

  constructor(options: CreateGeneratedGameCuePlayerOptions) {
    this.#featureEnabled = options.featureEnabled;
    this.#muted = options.muted ?? false;
    this.#maximumVoices = boundedNumber(options.maximumVoices, 8, 1, 32);
    if (!Number.isInteger(this.#maximumVoices)) {
      throw new Error("GAME_AUDIO_WEB_GENERATED_CUE_OPTIONS_INVALID");
    }
    this.#volume = boundedNumber(options.volume, 0.12, 0, 0.5);
    this.#contextFactory = options.contextFactory ?? defaultContextFactory;
  }

  async activate(hasUserActivation: boolean): Promise<GeneratedCueActivationResult> {
    if (this.#disposed) return { status: "disposed", reasonCode: "generated-cue-player-disposed" };
    if (!this.#featureEnabled) return { status: "disabled", reasonCode: "game-audio-foundation-disabled" };
    if (this.#muted) return { status: "muted", reasonCode: "audio-muted" };
    if (!hasUserActivation) {
      return { status: "waiting-for-user-activation", reasonCode: "browser-user-activation-required" };
    }
    try {
      this.#context ??= this.#contextFactory();
      if (this.#context.state === "suspended" || this.#context.state === "interrupted") {
        await this.#context.resume();
      }
      return { status: "ready", reasonCode: "generated-cue-player-ready" };
    } catch {
      return { status: "unavailable", reasonCode: "web-audio-unavailable" };
    }
  }

  play(cueId: GeneratedGameCueId): GeneratedCueResult {
    if (this.#disposed) return { cueId, status: "disposed", reasonCode: "generated-cue-player-disposed" };
    if (!this.#featureEnabled) return { cueId, status: "disabled", reasonCode: "game-audio-foundation-disabled" };
    if (this.#muted) return { cueId, status: "muted", reasonCode: "audio-muted" };
    const context = this.#context;
    if (!context) return { cueId, status: "waiting-for-user-activation", reasonCode: "browser-user-activation-required" };
    const shape = cueShapes[cueId];
    if (!shape || context.state === "closed") {
      return { cueId, status: "unavailable", reasonCode: "generated-cue-unavailable" };
    }
    if (this.#voices.size >= this.#maximumVoices) {
      return { cueId, status: "dropped-limit", reasonCode: "audio-voice-limit" };
    }
    try {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime;
      const end = start + shape.durationSeconds;
      oscillator.type = shape.type;
      oscillator.frequency.setValueAtTime(shape.startFrequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(shape.endFrequency, end);
      gain.gain.setValueAtTime(Math.max(0.0001, this.#volume), start);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      oscillator.connect(gain);
      gain.connect(context.destination);
      const voice = { oscillator, gain };
      oscillator.onended = () => this.#release(voice);
      this.#voices.add(voice);
      oscillator.start(start);
      oscillator.stop(end);
      return { cueId, status: "played", reasonCode: "generated-cue-played" };
    } catch {
      return { cueId, status: "unavailable", reasonCode: "generated-cue-unavailable" };
    }
  }

  setMuted(muted: boolean): void {
    this.#muted = muted;
    if (muted) this.stopAll();
  }

  stopAll(): number {
    const voices = [...this.#voices];
    for (const voice of voices) {
      this.#voices.delete(voice);
      voice.oscillator.onended = null;
      try {
        voice.oscillator.stop(0);
      } catch {
        // A naturally-ended oscillator is already stopped.
      }
      voice.oscillator.disconnect();
      voice.gain.disconnect();
    }
    return voices.length;
  }

  async dispose(): Promise<void> {
    if (this.#disposed) return;
    this.#disposed = true;
    this.stopAll();
    const context = this.#context;
    this.#context = undefined;
    if (context && context.state !== "closed") {
      try {
        await context.close();
      } catch {
        // Browser teardown failure is intentionally non-fatal.
      }
    }
  }

  #release(voice: Voice): void {
    if (!this.#voices.delete(voice)) return;
    voice.oscillator.onended = null;
    voice.oscillator.disconnect();
    voice.gain.disconnect();
  }
}

/** Create a lazy, asset-free player for original generated game cues. */
export function createGeneratedGameCuePlayer(
  options: CreateGeneratedGameCuePlayerOptions,
): GeneratedGameCuePlayer {
  return new BrowserGeneratedGameCuePlayer(options);
}
