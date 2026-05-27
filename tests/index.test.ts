import { describe, expect, it } from "vitest";

import { GAME_AUDIO_WEB_ENV_PREFIX, GAME_AUDIO_WEB_FEATURE_FLAG_ID, GAME_AUDIO_WEB_PACKAGE, packageDescriptor, planWebAudioRuntime } from "../src/index.js";

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
});
