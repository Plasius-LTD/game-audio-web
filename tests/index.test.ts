import { describe, expect, it, vi } from "vitest";

import type { GameAudioCommand, PlayGameAudioCommand } from "@plasius/game-audio";

import {
  GAME_AUDIO_WEB_ENV_PREFIX,
  GAME_AUDIO_WEB_FEATURE_FLAG_ID,
  GAME_AUDIO_WEB_PACKAGE,
  createWebAudioRuntime,
  packageDescriptor,
  planWebAudioRuntime,
  type WebAudioBufferSourceLike,
  type WebAudioContextLike,
} from "../src/index.js";

describe("@plasius/game-audio-web", () => {
  it("exports package metadata", () => {
    expect(packageDescriptor.packageName).toBe(GAME_AUDIO_WEB_PACKAGE);
    expect(packageDescriptor.featureFlagId).toBe(GAME_AUDIO_WEB_FEATURE_FLAG_ID);
    expect(packageDescriptor.envPrefix).toBe(GAME_AUDIO_WEB_ENV_PREFIX);
  });
  it("does not initialize while disabled", () => {
    const plan = planWebAudioRuntime({ featureEnabled: false, hasUserActivation: true, muted: false });
    expect(plan.status).toBe("disabled-by-feature-flag");
    expect(plan.shouldCreateAudioContext).toBe(false);
  });
  it("waits for user activation", () => {
    const plan = planWebAudioRuntime({ featureEnabled: true, hasUserActivation: false, muted: false });
    expect(plan.status).toBe("waiting-for-user-activation");
    expect(plan.shouldCreateAudioContext).toBe(false);
  });
  it("plans initialization after activation", () => {
    const plan = planWebAudioRuntime({ featureEnabled: true, hasUserActivation: true, muted: false });
    expect(plan.status).toBe("ready-to-initialize");
    expect(plan.shouldCreateAudioContext).toBe(true);
  });
  it("uses a muted fallback before initialization", () => {
    const plan = planWebAudioRuntime({ featureEnabled: true, hasUserActivation: true, muted: true });
    expect(plan.status).toBe("muted-fallback");
    expect(plan.shouldCreateAudioContext).toBe(false);
  });
});

function play(
  commandId: string,
  assetId = "road-hopper-hop",
  uri = "/assets/hop.wav",
): PlayGameAudioCommand {
  return {
    type: "play",
    commandId,
    category: "sfx",
    priority: "normal",
    issuedAtEpochMs: 100,
    asset: { assetId, kind: "buffer", uri },
    bus: "sfx",
  };
}

function createContext() {
  const sources: Array<WebAudioBufferSourceLike & { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }> = [];
  const gain = {
    gain: { value: 1 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
  const context: WebAudioContextLike = {
    state: "suspended",
    currentTime: 0,
    destination: {},
    createGain: vi.fn(() => gain),
    createBufferSource: vi.fn(() => {
      const source = {
        buffer: undefined,
        onended: null,
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      sources.push(source);
      return source;
    }),
    decodeAudioData: vi.fn(async () => ({ duration: 0.2 })),
    resume: vi.fn(async () => {
      context.state = "running";
    }),
    close: vi.fn(async () => {
      context.state = "closed";
    }),
  };
  return { context, sources, gain };
}

describe("bounded browser playback", () => {
  it("waits for activation, lazily decodes, caches and emits captions", async () => {
    const { context, sources } = createContext();
    const contextFactory = vi.fn(() => context);
    const fetchAsset = vi.fn(async () => new ArrayBuffer(32));
    const captions: string[] = [];
    const runtime = createWebAudioRuntime({
      featureEnabled: true,
      contextFactory,
      fetchAsset,
      now: () => 100,
      onCaption: (event) => captions.push(`${event.status}:${event.caption}`),
    });

    expect((await runtime.activate(false)).status).toBe("waiting-for-user-activation");
    expect(contextFactory).not.toHaveBeenCalled();
    expect((await runtime.activate(true)).status).toBe("ready");
    expect(context.resume).toHaveBeenCalledOnce();

    expect((await runtime.execute(play("one"))).status).toBe("played");
    expect((await runtime.execute(play("two"))).status).toBe("played");
    expect(fetchAsset).toHaveBeenCalledOnce();
    expect(context.decodeAudioData).toHaveBeenCalledOnce();
    expect(sources[0]?.start).toHaveBeenCalledOnce();
    expect(captions).toContain("played:Audio road-hopper-hop");

    const stopped = await runtime.execute({
      type: "stop",
      commandId: "stop-one",
      targetCommandId: "one",
      category: "sfx",
      priority: "normal",
      issuedAtEpochMs: 100,
    });
    expect(stopped.status).toBe("stopped");
    expect(sources[0]?.stop).toHaveBeenCalledOnce();
    await runtime.dispose();
  });

  it("honours disabled, muted, expired and voice-limit fallbacks", async () => {
    const disabled = createWebAudioRuntime({ featureEnabled: false, now: () => 100 });
    expect((await disabled.activate(true)).status).toBe("disabled");
    expect((await disabled.execute(play("disabled"))).status).toBe("disabled");

    const { context, gain } = createContext();
    const runtime = createWebAudioRuntime({
      featureEnabled: true,
      contextFactory: () => context,
      fetchAsset: async () => new ArrayBuffer(16),
      maximumVoices: 1,
      now: () => 100,
    });
    await runtime.activate(true);
    runtime.setMuted(true);
    expect(gain.gain.value).toBe(0);
    expect((await runtime.execute(play("muted"))).status).toBe("muted");
    runtime.setMuted(false);
    expect((await runtime.execute(play("voice-one"))).status).toBe("played");
    expect((await runtime.execute(play("voice-two", "other"))).status).toBe("dropped-limit");

    const expired: GameAudioCommand = {
      ...play("expired"),
      deadlineEpochMs: 99,
    };
    expect((await runtime.execute(expired)).status).toBe("expired");
    await runtime.dispose();
  });

  it("fails gracefully for invalid, oversized and undecodable assets", async () => {
    const { context } = createContext();
    const captions: string[] = [];
    const runtime = createWebAudioRuntime({
      featureEnabled: true,
      contextFactory: () => context,
      fetchAsset: async (uri) => {
        if (uri.includes("large")) return new ArrayBuffer(33);
        throw new Error("synthetic-person@example.test");
      },
      maximumAssetBytes: 32,
      now: () => 100,
      onCaption: (event) => captions.push(event.caption),
    });
    await runtime.activate(true);

    expect((await runtime.execute(play("invalid", "asset", "javascript:alert(1)"))).status).toBe("failed");
    expect((await runtime.execute(play("large", "large", "/large.wav"))).status).toBe("failed");
    expect((await runtime.execute(play("fetch", "fetch", "/fetch.wav"))).status).toBe("failed");
    expect(JSON.stringify(captions)).not.toContain("synthetic-person");

    await runtime.dispose();
    expect((await runtime.execute(play("disposed"))).status).toBe("disposed");
  });

  it("stops a whole bus and handles natural voice completion idempotently", async () => {
    const { context, sources } = createContext();
    const runtime = createWebAudioRuntime({
      featureEnabled: true,
      contextFactory: () => context,
      fetchAsset: async () => new ArrayBuffer(8),
      now: () => 100,
    });
    await runtime.activate(true);
    await runtime.execute(play("a"));
    await runtime.execute(play("b", "other"));
    sources[0]?.onended?.();
    const result = await runtime.execute({
      type: "stop",
      commandId: "stop-bus",
      bus: "sfx",
      category: "sfx",
      priority: "normal",
      issuedAtEpochMs: 100,
    });
    expect(result.status).toBe("stopped");
    expect(result.affectedVoices).toBe(1);
    await runtime.dispose();
    await runtime.dispose();
  });
});
