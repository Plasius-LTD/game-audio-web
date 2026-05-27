# ADR 0001: @plasius/game-audio-web Package Boundary

- Status: Proposed
- Date: 2026-05-27
- Decision Makers: Plasius engineering

## Context

The Plasius in-game audio suite needs independently releasable packages for core contracts, spatial acoustics, browser playback, and React integration. This package must have a clear boundary before implementation begins so later work can be tracked through package-local Tasks and validated without crossing unrelated product concerns.

## Decision

Keep browser-specific playback in a dedicated adapter package so core contracts remain portable and React hosts can choose when to initialize browser audio.

This package uses `game.audio.foundation.enabled` as its initial rollout flag. Product hosts remain responsible for remote flag evaluation and any capability checks required for user-visible controls or diagnostics.

## Consequences

### Positive

- The package has an explicit ownership boundary from the first scaffold.
- Implementation Tasks can add behavior without changing the package purpose.
- Documentation, tests, and release workflows are present before feature work begins.

### Negative

- The first scaffold intentionally contains limited behavior.
- Cross-package integration must be tracked by follow-up Tasks after the core contracts stabilize.

## Related Decisions

- Plasius site ADR 0068: In-Game Audio Package Boundaries and Acoustic Occlusion
- Plasius Isekai TDR 0036: In-Game Audio Runtime Pipeline
