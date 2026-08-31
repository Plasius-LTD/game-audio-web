# @plasius/game-audio-web

[![npm version](https://img.shields.io/npm/v/@plasius/game-audio-web.svg)](https://www.npmjs.com/package/@plasius/game-audio-web)
[![Build Status](https://img.shields.io/github/actions/workflow/status/Plasius-LTD/game-audio-web/ci.yml?branch=main&label=build&style=flat)](https://github.com/Plasius-LTD/game-audio-web/actions/workflows/ci.yml)
[![coverage](https://img.shields.io/codecov/c/github/Plasius-LTD/game-audio-web)](https://codecov.io/gh/Plasius-LTD/game-audio-web)
[![License](https://img.shields.io/github/license/Plasius-LTD/game-audio-web)](./LICENSE)
[![Code of Conduct](https://img.shields.io/badge/code%20of%20conduct-yes-blue.svg)](./CODE_OF_CONDUCT.md)
[![Security Policy](https://img.shields.io/badge/security%20policy-yes-orange.svg)](./SECURITY.md)
[![Changelog](https://img.shields.io/badge/changelog-md-blue.svg)](./CHANGELOG.md)

Bounded Web Audio runtime adapter for portable Plasius game-audio commands.

Apache-2.0. ESM + CJS builds. TypeScript types included.

## Installation

```bash
npm install @plasius/game-audio-web
```

## Scope

This repository is part of the Plasius in-game audio package suite.

It owns:

- Web Audio lifecycle planning and runtime activation
- lazy context creation and asset decoding after user activation
- bounded decoded-buffer caching and simultaneous voices
- mute, command/bus/all stop, and idempotent disposal
- captioned visual alternatives and controlled fallback outcomes
- lazy asset-free oscillator cues for bounce, brick, life-loss, level-clear and win events

It does not own game-world authority, speech provider credentials, raw TTS generation, or product-specific feature-flag evaluation.

## Feature Flag

- `game.audio.foundation.enabled`

## Usage

```ts
import {
  createGeneratedGameCuePlayer,
  createWebAudioRuntime,
  packageDescriptor,
  GAME_AUDIO_WEB_PACKAGE,
  GAME_AUDIO_WEB_FEATURE_FLAG_ID,
} from "@plasius/game-audio-web";

console.log(packageDescriptor.packageName === GAME_AUDIO_WEB_PACKAGE);
console.log(packageDescriptor.featureFlagId === GAME_AUDIO_WEB_FEATURE_FLAG_ID);

const runtime = createWebAudioRuntime({
  featureEnabled: true,
  onCaption: ({ caption }) => showVisualAudioCaption(caption),
});

// Call synchronously from a trusted click/touch/keyboard handler.
await runtime.activate(navigator.userActivation?.isActive === true);

await runtime.execute({
  type: "play",
  commandId: "home-filled",
  category: "sfx",
  priority: "normal",
  issuedAtEpochMs: Date.now(),
  bus: "sfx",
  asset: {
    assetId: "home-filled",
    kind: "buffer",
    uri: "/audio/home-filled.ogg",
  },
});

const cues = createGeneratedGameCuePlayer({ featureEnabled: true });
await cues.activate(true); // call from the same explicit user activation
cues.play("bounce");
cues.setMuted(true);
```

The host owns the stored feature decision and calls `activate()` from an explicit
user gesture. The runtime does not read rollout configuration, credentials, or
account state. Audio failures return controlled outcomes and caption events so
gameplay and deterministic assessment continue without sound.

`createGeneratedGameCuePlayer` creates no `AudioContext` until
`activate(true)`. It synthesizes five short original oscillator envelopes and
performs no network fetch or decode. Cue failures and voice-limit drops return
controlled status codes. The game must still render equivalent semantic and
visual feedback; generated cues are never assessment-critical.

## Development

```bash
npm install
npm run build
npm test
npm run test:coverage
npm run pack:check
```

## Governance

- Architecture decisions: [docs/adrs](./docs/adrs)
- Runtime design: [docs/design/web-audio-runtime.md](./docs/design/web-audio-runtime.md)
- Security policy: [SECURITY.md](./SECURITY.md)
- Code of conduct: [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- CLA and legal docs: [legal](./legal)

## License

Apache-2.0
<!-- BEGIN PLASIUS RELEASE INTEGRITY -->
## Release integrity

Production package publication runs only from `.github/workflows/cd.yml` on
protected `main`. The job verifies that the prepared commit is still the
current main commit and has an exact successful `ci.yml` push result before it
mutates release state. Public package CI runs on GitHub-hosted capacity so it
cannot execute on company-managed runners. npm publication runs on
GitHub-hosted Node.js 24 with
npm 11.5.1 or newer, uses the protected `production` environment and
short-lived npm OIDC with provenance, and has no long-lived npm write-token
fallback. Rollback disables CD; it never rewrites published package history.
<!-- END PLASIUS RELEASE INTEGRITY -->
