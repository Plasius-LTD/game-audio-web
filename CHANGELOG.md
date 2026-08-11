# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

- **Added**
  - Add a user-activated Web Audio runtime for portable `@plasius/game-audio`
    play and stop commands.
  - Add bounded lazy decoding, decoded-buffer caching, simultaneous voices,
    mute/stop lifecycle, and captioned visual alternatives.
  - Add runtime design documentation and failure/limit/lifecycle coverage.

- **Changed**
  - Accept the product host's feature decision rather than reading rollout
    configuration inside the adapter.

- **Fixed**
  - Return controlled outcomes for browser-policy, fetch, decode, timeout, and
    unsupported-command failures so audio cannot interrupt gameplay.

- **Security**
  - Bound asset identifiers, encoded bytes, decoded cache entries, concurrent
    voices, and fetch timeouts without reflecting sensitive failure details.

## [0.1.3] - 2026-06-22

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [0.1.2] - 2026-06-21

### Added

- Initial @plasius/game-audio-web package scaffold from the Plasius package template.
- Package boundary ADR and baseline validation scripts.
- Feature flag contract for `game.audio.foundation.enabled`.


[0.1.2]: https://github.com/Plasius-LTD/game-audio-web/releases/tag/v0.1.2
[0.1.3]: https://github.com/Plasius-LTD/game-audio-web/releases/tag/v0.1.3
