export interface GameAudioPackageDescriptor {
  readonly packageName: string;
  readonly featureFlagId: string;
  readonly envPrefix: string;
  readonly summary: string;
}

export const GAME_AUDIO_WEB_PACKAGE = "@plasius/game-audio-web";
export const GAME_AUDIO_WEB_ENV_PREFIX = "GAME_AUDIO_WEB";
export const GAME_AUDIO_WEB_FEATURE_FLAG_ID = "game.audio.foundation.enabled";
export type WebAudioRuntimePlanStatus = "ready-to-initialize" | "waiting-for-user-activation" | "disabled-by-feature-flag" | "muted-fallback";
export interface WebAudioRuntimePlanInput { readonly featureEnabled: boolean; readonly hasUserActivation: boolean; readonly muted: boolean; }
export interface WebAudioRuntimePlan { readonly status: WebAudioRuntimePlanStatus; readonly shouldCreateAudioContext: boolean; readonly reasonCode: string; }
export const packageDescriptor: GameAudioPackageDescriptor = Object.freeze({ packageName: GAME_AUDIO_WEB_PACKAGE, featureFlagId: GAME_AUDIO_WEB_FEATURE_FLAG_ID, envPrefix: GAME_AUDIO_WEB_ENV_PREFIX, summary: "Web Audio runtime adapter scaffold for Plasius game audio." });
export function planWebAudioRuntime(input: WebAudioRuntimePlanInput): WebAudioRuntimePlan {
  if (!input.featureEnabled) return Object.freeze({ status: "disabled-by-feature-flag", shouldCreateAudioContext: false, reasonCode: "game-audio-foundation-disabled" });
  if (input.muted) return Object.freeze({ status: "muted-fallback", shouldCreateAudioContext: false, reasonCode: "audio-muted" });
  if (!input.hasUserActivation) return Object.freeze({ status: "waiting-for-user-activation", shouldCreateAudioContext: false, reasonCode: "browser-user-activation-required" });
  return Object.freeze({ status: "ready-to-initialize", shouldCreateAudioContext: true, reasonCode: "web-audio-ready" });
}
