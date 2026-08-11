# Bounded Web Audio runtime design

## Requirements

- Product hosts provide the stored `game.audio.foundation.enabled` decision; this package never reads rollout environment variables.
- `AudioContext` is created only after explicit user activation and is lazily resumed.
- Play and stop commands use the portable `@plasius/game-audio` contract.
- Asset identifiers, URIs, encoded bytes, decoded cache entries, concurrent voices and timeouts are bounded.
- Decode, fetch, browser-policy and unsupported-asset failures return controlled outcomes and caption events rather than breaking gameplay.
- Mute, stop, and disposal are idempotent. Audio is never required for deterministic game completion.
- Asset-free cues use five fixed original oscillator envelopes, no fetch, and the same activation/mute/fallback lifecycle.

## Data flow

A host creates one runtime with a feature decision, context factory and optional asset fetcher. `activate()` is called synchronously from a user gesture. The first play command fetches and decodes a bounded buffer, connects a source through the master gain, records the voice, and emits a caption. Stop commands target a command or bus. Muting changes only the master gain; rendering and captions continue.

No credentials, user identifiers, learner source, or asset bodies are logged or returned in failures.

## Generated cue flow

`createGeneratedGameCuePlayer` is inert until `activate(true)` is called from a
trusted user gesture. `play()` maps `bounce`, `brick`, `life-loss`,
`level-clear`, or `win` to a bounded oscillator frequency and gain envelope.
At most the configured number of voices can run. Natural completion, mute,
explicit stop and disposal disconnect both oscillator and gain nodes.

Generated cues never fetch, decode, log, inspect learner source, or become
assessment evidence. A host renders equivalent visual and semantic feedback and
continues gameplay for every disabled, muted, unavailable or dropped result.
