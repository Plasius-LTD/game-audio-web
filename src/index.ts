import type {
  GameAudioBus,
  GameAudioCommand,
  PlayGameAudioCommand,
  StopGameAudioCommand,
} from "@plasius/game-audio";

export * from "./generated-game-cue-player.js";

export interface GameAudioPackageDescriptor {
  readonly packageName: string;
  readonly featureFlagId: string;
  readonly envPrefix: string;
  readonly summary: string;
}

export const GAME_AUDIO_WEB_PACKAGE = "@plasius/game-audio-web";
export const GAME_AUDIO_WEB_ENV_PREFIX = "GAME_AUDIO_WEB";
export const GAME_AUDIO_WEB_FEATURE_FLAG_ID = "game.audio.foundation.enabled";

export type WebAudioRuntimePlanStatus =
  | "ready-to-initialize"
  | "waiting-for-user-activation"
  | "disabled-by-feature-flag"
  | "muted-fallback";

export interface WebAudioRuntimePlanInput {
  readonly featureEnabled: boolean;
  readonly hasUserActivation: boolean;
  readonly muted: boolean;
}

export interface WebAudioRuntimePlan {
  readonly status: WebAudioRuntimePlanStatus;
  readonly shouldCreateAudioContext: boolean;
  readonly reasonCode: string;
}

export const packageDescriptor: GameAudioPackageDescriptor = Object.freeze({
  packageName: GAME_AUDIO_WEB_PACKAGE,
  featureFlagId: GAME_AUDIO_WEB_FEATURE_FLAG_ID,
  envPrefix: GAME_AUDIO_WEB_ENV_PREFIX,
  summary:
    "Bounded, lazy, user-activated Web Audio playback for Plasius game-audio commands.",
});

/** Plan lifecycle without touching a browser global. */
export function planWebAudioRuntime(
  input: WebAudioRuntimePlanInput,
): WebAudioRuntimePlan {
  if (!input.featureEnabled) {
    return Object.freeze({
      status: "disabled-by-feature-flag",
      shouldCreateAudioContext: false,
      reasonCode: "game-audio-foundation-disabled",
    });
  }
  if (input.muted) {
    return Object.freeze({
      status: "muted-fallback",
      shouldCreateAudioContext: false,
      reasonCode: "audio-muted",
    });
  }
  if (!input.hasUserActivation) {
    return Object.freeze({
      status: "waiting-for-user-activation",
      shouldCreateAudioContext: false,
      reasonCode: "browser-user-activation-required",
    });
  }
  return Object.freeze({
    status: "ready-to-initialize",
    shouldCreateAudioContext: true,
    reasonCode: "web-audio-ready",
  });
}

export interface WebAudioConnectableLike {
  connect(destination: unknown): unknown;
  disconnect(): void;
}

export interface WebAudioGainLike extends WebAudioConnectableLike {
  readonly gain: { value: number };
}

export interface WebAudioBufferSourceLike extends WebAudioConnectableLike {
  buffer: unknown;
  onended: (() => void) | null;
  start(when?: number): void;
  stop(when?: number): void;
}

/** Minimal injectable browser surface used for deterministic package tests. */
export interface WebAudioContextLike {
  state: "suspended" | "running" | "closed" | "interrupted";
  readonly currentTime: number;
  readonly destination: unknown;
  createGain(): WebAudioGainLike;
  createBufferSource(): WebAudioBufferSourceLike;
  decodeAudioData(bytes: ArrayBuffer): Promise<unknown>;
  resume(): Promise<void>;
  close(): Promise<void>;
}

export interface WebAudioCaptionEvent {
  readonly commandId: string;
  readonly status: WebAudioCommandStatus;
  readonly caption: string;
}

export type WebAudioActivationStatus =
  | "ready"
  | "waiting-for-user-activation"
  | "disabled"
  | "muted"
  | "unavailable"
  | "disposed";

export interface WebAudioActivationResult {
  readonly status: WebAudioActivationStatus;
  readonly reasonCode: string;
}

export type WebAudioCommandStatus =
  | "played"
  | "stopped"
  | "disabled"
  | "waiting-for-user-activation"
  | "muted"
  | "expired"
  | "dropped-limit"
  | "failed"
  | "disposed";

export interface WebAudioCommandResult {
  readonly commandId: string;
  readonly status: WebAudioCommandStatus;
  readonly reasonCode: string;
  readonly affectedVoices: number;
}

export interface CreateWebAudioRuntimeOptions {
  /** Result of the host's stored feature-flag evaluation. */
  readonly featureEnabled: boolean;
  readonly muted?: boolean;
  readonly maximumVoices?: number;
  readonly maximumCachedAssets?: number;
  readonly maximumAssetBytes?: number;
  readonly fetchTimeoutMs?: number;
  readonly contextFactory?: () => WebAudioContextLike;
  readonly fetchAsset?: (uri: string, signal: AbortSignal) => Promise<ArrayBuffer>;
  readonly onCaption?: (event: WebAudioCaptionEvent) => void;
  readonly now?: () => number;
}

export interface WebAudioRuntime {
  activate(hasUserActivation: boolean): Promise<WebAudioActivationResult>;
  execute(command: GameAudioCommand): Promise<WebAudioCommandResult>;
  setMuted(muted: boolean): void;
  stopAll(): number;
  dispose(): Promise<void>;
}

interface Voice {
  readonly commandId: string;
  readonly bus: GameAudioBus;
  readonly source: WebAudioBufferSourceLike;
}

interface ResolvedOptions {
  readonly featureEnabled: boolean;
  readonly maximumVoices: number;
  readonly maximumCachedAssets: number;
  readonly maximumAssetBytes: number;
  readonly fetchTimeoutMs: number;
  readonly contextFactory: () => WebAudioContextLike;
  readonly fetchAsset: (uri: string, signal: AbortSignal) => Promise<ArrayBuffer>;
  readonly onCaption?: (event: WebAudioCaptionEvent) => void;
  readonly now: () => number;
}

const identifierPattern = /^[a-z0-9][a-z0-9._-]{0,99}$/iu;

function boundedInteger(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error("GAME_AUDIO_WEB_INVALID_OPTIONS");
  }
  return value;
}

function defaultContextFactory(): WebAudioContextLike {
  const scope = globalThis as unknown as {
    AudioContext?: new () => WebAudioContextLike;
    webkitAudioContext?: new () => WebAudioContextLike;
  };
  const Context = scope.AudioContext ?? scope.webkitAudioContext;
  if (!Context) throw new Error("GAME_AUDIO_WEB_CONTEXT_UNAVAILABLE");
  return new Context();
}

async function defaultFetchAsset(
  uri: string,
  signal: AbortSignal,
): Promise<ArrayBuffer> {
  const response = await fetch(uri, {
    signal,
    credentials: "omit",
    cache: "force-cache",
  });
  if (!response.ok) throw new Error("GAME_AUDIO_WEB_ASSET_FETCH_FAILED");
  return response.arrayBuffer();
}

function resolveOptions(options: CreateWebAudioRuntimeOptions): ResolvedOptions {
  return {
    featureEnabled: options.featureEnabled,
    maximumVoices: boundedInteger(options.maximumVoices, 16, 1, 64),
    maximumCachedAssets: boundedInteger(options.maximumCachedAssets, 32, 1, 128),
    maximumAssetBytes: boundedInteger(
      options.maximumAssetBytes,
      2 * 1024 * 1024,
      1,
      8 * 1024 * 1024,
    ),
    fetchTimeoutMs: boundedInteger(options.fetchTimeoutMs, 5_000, 100, 10_000),
    contextFactory: options.contextFactory ?? defaultContextFactory,
    fetchAsset: options.fetchAsset ?? defaultFetchAsset,
    ...(options.onCaption === undefined ? {} : { onCaption: options.onCaption }),
    now: options.now ?? Date.now,
  };
}

function result(
  commandId: string,
  status: WebAudioCommandStatus,
  reasonCode: string,
  affectedVoices = 0,
): WebAudioCommandResult {
  return Object.freeze({ commandId, status, reasonCode, affectedVoices });
}

function validCommand(command: GameAudioCommand): boolean {
  return identifierPattern.test(command.commandId)
    && Number.isFinite(command.issuedAtEpochMs)
    && (
      command.deadlineEpochMs === undefined
      || Number.isFinite(command.deadlineEpochMs)
    );
}

function validAssetUri(uri: string): boolean {
  if (uri.length < 1 || uri.length > 2_048) return false;
  if (uri.startsWith("/")) return !uri.startsWith("//");
  try {
    const parsed = new URL(uri);
    return parsed.protocol === "https:"
      || (parsed.protocol === "data:" && /^data:audio\//iu.test(uri));
  } catch {
    return false;
  }
}

class BrowserWebAudioRuntime implements WebAudioRuntime {
  readonly #options: ResolvedOptions;
  readonly #voices = new Map<string, Voice>();
  readonly #buffers = new Map<string, unknown>();
  #context: WebAudioContextLike | undefined;
  #masterGain: WebAudioGainLike | undefined;
  #muted: boolean;
  #disposed = false;

  constructor(options: CreateWebAudioRuntimeOptions) {
    this.#options = resolveOptions(options);
    this.#muted = options.muted ?? false;
  }

  async activate(hasUserActivation: boolean): Promise<WebAudioActivationResult> {
    if (this.#disposed) {
      return { status: "disposed", reasonCode: "audio-runtime-disposed" };
    }
    const plan = planWebAudioRuntime({
      featureEnabled: this.#options.featureEnabled,
      hasUserActivation,
      muted: this.#muted,
    });
    if (plan.status === "disabled-by-feature-flag") {
      return { status: "disabled", reasonCode: plan.reasonCode };
    }
    if (plan.status === "muted-fallback") {
      return { status: "muted", reasonCode: plan.reasonCode };
    }
    if (plan.status === "waiting-for-user-activation") {
      return { status: "waiting-for-user-activation", reasonCode: plan.reasonCode };
    }
    try {
      if (!this.#context) {
        this.#context = this.#options.contextFactory();
        this.#masterGain = this.#context.createGain();
        this.#masterGain.gain.value = this.#muted ? 0 : 1;
        this.#masterGain.connect(this.#context.destination);
      }
      if (this.#context.state === "suspended" || this.#context.state === "interrupted") {
        await this.#context.resume();
      }
      return { status: "ready", reasonCode: "web-audio-ready" };
    } catch {
      return { status: "unavailable", reasonCode: "web-audio-unavailable" };
    }
  }

  async execute(command: GameAudioCommand): Promise<WebAudioCommandResult> {
    if (this.#disposed) return result(command.commandId, "disposed", "audio-runtime-disposed");
    if (!validCommand(command)) return result(command.commandId, "failed", "invalid-audio-command");
    if (!this.#options.featureEnabled) return result(command.commandId, "disabled", "game-audio-foundation-disabled");
    if (command.deadlineEpochMs !== undefined && command.deadlineEpochMs < this.#options.now()) {
      return result(command.commandId, "expired", "audio-command-deadline-expired");
    }
    if (command.type === "stop") return this.#stop(command);
    if (this.#muted) return this.#captioned(command, "muted", "audio-muted");
    if (!this.#context || !this.#masterGain) {
      return this.#captioned(
        command,
        "waiting-for-user-activation",
        "browser-user-activation-required",
      );
    }
    if (this.#voices.size >= this.#options.maximumVoices) {
      return this.#captioned(command, "dropped-limit", "audio-voice-limit");
    }
    return this.#play(command);
  }

  setMuted(muted: boolean): void {
    this.#muted = muted;
    if (this.#masterGain) this.#masterGain.gain.value = muted ? 0 : 1;
  }

  stopAll(): number {
    return this.#stopMatching(() => true);
  }

  async dispose(): Promise<void> {
    if (this.#disposed) return;
    this.#disposed = true;
    this.stopAll();
    this.#buffers.clear();
    this.#masterGain?.disconnect();
    const context = this.#context;
    this.#context = undefined;
    this.#masterGain = undefined;
    if (context && context.state !== "closed") {
      try {
        await context.close();
      } catch {
        // Browser teardown failure is intentionally non-fatal.
      }
    }
  }

  async #play(command: PlayGameAudioCommand): Promise<WebAudioCommandResult> {
    if (
      !identifierPattern.test(command.asset.assetId)
      || command.asset.uri === undefined
      || !validAssetUri(command.asset.uri)
      || command.asset.kind === "tts"
    ) {
      return this.#captioned(command, "failed", "invalid-or-unsupported-audio-asset");
    }
    try {
      const buffer = await this.#loadBuffer(command);
      if (this.#disposed || !this.#context || !this.#masterGain) {
        return result(command.commandId, "disposed", "audio-runtime-disposed");
      }
      if (this.#voices.size >= this.#options.maximumVoices) {
        return this.#captioned(command, "dropped-limit", "audio-voice-limit");
      }
      const source = this.#context.createBufferSource();
      const bus = command.bus ?? "sfx";
      source.buffer = buffer;
      source.connect(this.#masterGain);
      source.onended = () => this.#releaseVoice(command.commandId);
      this.#voices.set(command.commandId, { commandId: command.commandId, bus, source });
      source.start(0);
      return this.#captioned(command, "played", "audio-played");
    } catch {
      return this.#captioned(command, "failed", "audio-asset-unavailable");
    }
  }

  async #loadBuffer(command: PlayGameAudioCommand): Promise<unknown> {
    const uri = command.asset.uri as string;
    const key = `${command.asset.assetId}:${command.asset.contentHash ?? "no-hash"}:${uri}`;
    const cached = this.#buffers.get(key);
    if (cached !== undefined) return cached;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#options.fetchTimeoutMs);
    try {
      const bytes = await this.#options.fetchAsset(uri, controller.signal);
      if (!(bytes instanceof ArrayBuffer) || bytes.byteLength > this.#options.maximumAssetBytes) {
        throw new Error("GAME_AUDIO_WEB_ASSET_TOO_LARGE");
      }
      const context = this.#context;
      if (!context) throw new Error("GAME_AUDIO_WEB_CONTEXT_UNAVAILABLE");
      const decoded = await context.decodeAudioData(bytes.slice(0));
      if (this.#buffers.size >= this.#options.maximumCachedAssets) {
        const oldest = this.#buffers.keys().next().value as string | undefined;
        if (oldest !== undefined) this.#buffers.delete(oldest);
      }
      this.#buffers.set(key, decoded);
      return decoded;
    } finally {
      clearTimeout(timeout);
    }
  }

  #stop(command: StopGameAudioCommand): WebAudioCommandResult {
    const affected = this.#stopMatching((voice) =>
      command.targetCommandId !== undefined
        ? voice.commandId === command.targetCommandId
        : command.bus !== undefined
          ? voice.bus === command.bus
          : true,
    );
    return result(command.commandId, "stopped", "audio-stopped", affected);
  }

  #stopMatching(predicate: (voice: Voice) => boolean): number {
    let affected = 0;
    for (const voice of [...this.#voices.values()]) {
      if (!predicate(voice)) continue;
      affected += 1;
      this.#voices.delete(voice.commandId);
      voice.source.onended = null;
      try {
        voice.source.stop(0);
      } catch {
        // A naturally-ended source is already stopped.
      }
      voice.source.disconnect();
    }
    return affected;
  }

  #releaseVoice(commandId: string): void {
    const voice = this.#voices.get(commandId);
    if (!voice) return;
    this.#voices.delete(commandId);
    voice.source.onended = null;
    voice.source.disconnect();
  }

  #captioned(
    command: PlayGameAudioCommand,
    status: WebAudioCommandStatus,
    reasonCode: string,
  ): WebAudioCommandResult {
    this.#options.onCaption?.({
      commandId: command.commandId,
      status,
      caption: `Audio ${command.asset.assetId}`,
    });
    return result(command.commandId, status, reasonCode, status === "played" ? 1 : 0);
  }
}

/** Create one bounded runtime. The host remains responsible for the remote flag decision. */
export function createWebAudioRuntime(
  options: CreateWebAudioRuntimeOptions,
): WebAudioRuntime {
  return new BrowserWebAudioRuntime(options);
}
