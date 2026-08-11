import { describe, expect, it, vi } from "vitest";
import {
  GENERATED_GAME_CUE_IDS,
  createGeneratedGameCuePlayer,
  type GeneratedAudioContextLike,
  type GeneratedAudioParamLike,
  type GeneratedGainLike,
  type GeneratedOscillatorLike,
} from "../src/index.js";

function parameter(): GeneratedAudioParamLike & {
  setValueAtTime: ReturnType<typeof vi.fn>;
  exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
} {
  return {
    value: 0,
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
}

function createGeneratedContext() {
  const oscillators: Array<GeneratedOscillatorLike & {
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  }> = [];
  const gains: GeneratedGainLike[] = [];
  const context: GeneratedAudioContextLike = {
    state: "suspended",
    currentTime: 2,
    destination: {},
    createOscillator: vi.fn(() => {
      const oscillator = {
        type: "sine" as const,
        frequency: parameter(),
        onended: null,
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      oscillators.push(oscillator);
      return oscillator;
    }),
    createGain: vi.fn(() => {
      const gain = {
        gain: parameter(),
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
      gains.push(gain);
      return gain;
    }),
    resume: vi.fn(async () => {
      context.state = "running";
    }),
    close: vi.fn(async () => {
      context.state = "closed";
    }),
  };
  return { context, oscillators, gains };
}

describe("lazy original generated game cues", () => {
  it("waits for activation and creates no context until a user gesture", async () => {
    const { context } = createGeneratedContext();
    const contextFactory = vi.fn(() => context);
    const player = createGeneratedGameCuePlayer({
      featureEnabled: true,
      contextFactory,
    });
    expect(player.play("bounce").status).toBe("waiting-for-user-activation");
    expect((await player.activate(false)).status).toBe("waiting-for-user-activation");
    expect(contextFactory).not.toHaveBeenCalled();
    expect((await player.activate(true)).status).toBe("ready");
    expect(contextFactory).toHaveBeenCalledOnce();
    expect(context.resume).toHaveBeenCalledOnce();
    await player.dispose();
  });

  it("plays all five bounded oscillator envelopes without fetching assets", async () => {
    const { context, oscillators, gains } = createGeneratedContext();
    const player = createGeneratedGameCuePlayer({
      featureEnabled: true,
      contextFactory: () => context,
    });
    await player.activate(true);
    for (const cueId of GENERATED_GAME_CUE_IDS) {
      expect(player.play(cueId)).toEqual({
        cueId,
        status: "played",
        reasonCode: "generated-cue-played",
      });
    }
    expect(oscillators).toHaveLength(5);
    expect(gains).toHaveLength(5);
    expect(oscillators.map((oscillator) => oscillator.type)).toEqual([
      "sine", "square", "sawtooth", "triangle", "sine",
    ]);
    expect(oscillators.every((oscillator) =>
      oscillator.frequency.setValueAtTime.mock.calls.length === 1
      && oscillator.frequency.exponentialRampToValueAtTime.mock.calls.length === 1
      && oscillator.start.mock.calls.length === 1
      && oscillator.stop.mock.calls.length === 1)).toBe(true);
    oscillators[0]?.onended?.();
    expect(player.stopAll()).toBe(4);
    await player.dispose();
  });

  it("honours feature, mute, voice and unavailable fallbacks", async () => {
    const disabled = createGeneratedGameCuePlayer({ featureEnabled: false });
    expect((await disabled.activate(true)).status).toBe("disabled");
    expect(disabled.play("brick").status).toBe("disabled");

    const { context } = createGeneratedContext();
    const player = createGeneratedGameCuePlayer({
      featureEnabled: true,
      maximumVoices: 1,
      contextFactory: () => context,
    });
    await player.activate(true);
    expect(player.play("bounce").status).toBe("played");
    expect(player.play("brick").status).toBe("dropped-limit");
    player.setMuted(true);
    expect(player.play("life-loss").status).toBe("muted");
    player.setMuted(false);
    context.state = "closed";
    expect(player.play("win").status).toBe("unavailable");
    await player.dispose();
    expect(player.play("win").status).toBe("disposed");
    expect((await player.activate(true)).status).toBe("disposed");
  });

  it("fails closed for invalid options and unavailable browser audio", async () => {
    expect(() => createGeneratedGameCuePlayer({
      featureEnabled: true,
      maximumVoices: 0,
    })).toThrow("GAME_AUDIO_WEB_GENERATED_CUE_OPTIONS_INVALID");
    expect(() => createGeneratedGameCuePlayer({
      featureEnabled: true,
      maximumVoices: 1.5,
    })).toThrow("GAME_AUDIO_WEB_GENERATED_CUE_OPTIONS_INVALID");
    expect(() => createGeneratedGameCuePlayer({
      featureEnabled: true,
      volume: Number.NaN,
    })).toThrow("GAME_AUDIO_WEB_GENERATED_CUE_OPTIONS_INVALID");
    const unavailable = createGeneratedGameCuePlayer({
      featureEnabled: true,
      contextFactory: () => {
        throw new Error("synthetic failure");
      },
    });
    expect((await unavailable.activate(true)).status).toBe("unavailable");

    const browserless = createGeneratedGameCuePlayer({ featureEnabled: true });
    expect((await browserless.activate(true)).status).toBe("unavailable");

    const { context } = createGeneratedContext();
    context.createOscillator = vi.fn(() => {
      throw new Error("synthetic oscillator failure");
    });
    const failedPlay = createGeneratedGameCuePlayer({
      featureEnabled: true,
      contextFactory: () => context,
    });
    await failedPlay.activate(true);
    expect(failedPlay.play("bounce").status).toBe("unavailable");
  });
});
