# @plasius/game-audio-web

[![npm version](https://img.shields.io/npm/v/%40plasius%2Fgame-audio-web.svg)](https://www.npmjs.com/package/@plasius/game-audio-web)
[![Build Status](https://img.shields.io/github/actions/workflow/status/Plasius-LTD/game-audio-web/ci.yml?branch=main&label=build&style=flat)](https://github.com/Plasius-LTD/game-audio-web/actions/workflows/ci.yml)
[![coverage](https://img.shields.io/codecov/c/github/Plasius-LTD/game-audio-web)](https://codecov.io/gh/Plasius-LTD/game-audio-web)
[![License](https://img.shields.io/github/license/Plasius-LTD/game-audio-web)](./LICENSE)
[![Code of Conduct](https://img.shields.io/badge/code%20of%20conduct-yes-blue.svg)](./CODE_OF_CONDUCT.md)
[![Security Policy](https://img.shields.io/badge/security%20policy-yes-orange.svg)](./SECURITY.md)
[![Changelog](https://img.shields.io/badge/changelog-md-blue.svg)](./CHANGELOG.md)

Web Audio runtime adapter scaffold for Plasius game audio.

Apache-2.0. ESM + CJS builds. TypeScript types included.

## Installation

```bash
npm install @plasius/game-audio-web
```

## Scope

This repository is part of the Plasius in-game audio package suite.

It owns:

- Web Audio lifecycle planning
- lazy initialization after user activation
- adapter status and fallback outcome contracts
- future decoding, streaming, scheduling, bus graph, and limiter implementation surface

It does not own game-world authority, speech provider credentials, raw TTS generation, or product-specific feature-flag evaluation.

## Feature Flag

- `game.audio.foundation.enabled`

## Usage

```ts
import {
  packageDescriptor,
  GAME_AUDIO_WEB_PACKAGE,
  GAME_AUDIO_WEB_FEATURE_FLAG_ID,
} from "@plasius/game-audio-web";

console.log(packageDescriptor.packageName === GAME_AUDIO_WEB_PACKAGE);
console.log(packageDescriptor.featureFlagId === GAME_AUDIO_WEB_FEATURE_FLAG_ID);
```

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
- Security policy: [SECURITY.md](./SECURITY.md)
- Code of conduct: [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- CLA and legal docs: [legal](./legal)

## License

Apache-2.0
