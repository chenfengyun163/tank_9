# PlayCanvas RTS Execution Plan v2

## Canonical Source Policy

- Root project docs are authoritative.
- `docs/` contains mirrored publishing copies derived from root docs.
- Update root docs first, then sync the mirrored copies in the same change set.

## Current Project State

- The repository root is the permanent Web game root.
- Unity is archived as a design-source reference only.
- `RTS-Sandbox/` is a read-only reference repo, not an active production route.
- The current milestone is `feature/playable-recovery`, which now spans the minimum playable runtime spine, interaction loop, economy loop, AI loop, HUD loop, and current stabilization work.

## Delivery Phases

### Phase 0: Route Freeze And Canonical Docs

- Goal: lock the Web-first route and remove doc authority drift.
- Input: current root docs and drifted mirror docs.
- Output: aligned root docs, sync policy, milestone naming, rollback notes.
- Acceptance:
  - root docs and `docs/` say the same thing,
  - one authoritative task board exists,
  - no route ambiguity remains.
- Branch: `feature/playcanvas-route-freeze`
- Suggested tag: `v0.1.0-route-freeze`
- Rollback: revert the doc-only change set.

### Phase 1: Repo Bootstrap

- Goal: accept the repository root as the permanent Web game foundation and finish the delivery-grade bootstrap.
- Input: current PlayCanvas shell, build config, bootstrap code, README, CI baseline.
- Output:
  - stable app shell,
  - code-created canvas path,
  - code-created camera/light/ground/reference world,
  - placeholder asset/config scaffold,
  - synced `docs/`,
  - CI with `lint`, `typecheck`, and `build`,
  - route clarity in `README.md`.
- Acceptance:
  - `npm install` succeeds,
  - `npm run lint` succeeds,
  - `npm run typecheck` succeeds,
  - `npm run build` succeeds,
  - `npm run dev` launches the browser shell,
  - no PlayCanvas editor binding is required for bootstrap,
  - placeholder entities already have stable keys for future art replacement.
- Branch: `feature/repo-bootstrap`
- Suggested tag: `v0.1.1-repo-bootstrap`
- Rollback: revert the bootstrap acceptance merge.

### Phase 2: Core Runtime

- Goal: establish the single runtime spine for all future gameplay.
- Input: accepted repo bootstrap foundation.
- Output:
  - authoritative runtime state domains,
  - entity identity contracts,
  - unified command envelope,
  - typed gameplay event taxonomy,
  - session phases,
  - replacement-friendly config keys.
- Acceptance:
  - one store remains the only source of truth,
  - commands become the only gameplay mutation path,
  - events remain notifications only,
  - gameplay logic does not leak into UI or bootstrap.
- Branch: `feature/core-runtime`
- Suggested tag: `v0.1.2-core-runtime`
- Rollback: revert the runtime spine merge.

### Phase 3: Core Loop

- Goal: deliver the first complete player interaction chain.
- Input: core runtime spine.
- Output:
  - click select,
  - box select,
  - selection feedback,
  - right-click move,
  - camera controls,
  - command translation.
- Acceptance: player can reliably select and move controllable units with clear feedback.
- Branch: `feature/core-loop`
- Suggested tag: `v0.2.0-core-loop`
- Rollback: revert the core-loop merge.

### Phase 4: Combat Loop

- Goal: deliver unified combat behavior.
- Input: core loop.
- Output:
  - attack command,
  - target validation,
  - range checks,
  - cooldown logic,
  - unified damage entry,
  - death and removal,
  - enemy recognition rules.
- Acceptance: infantry and tank units can attack and kill enemy targets through one combat pipeline.
- Branch: `feature/combat-loop`
- Suggested tag: `v0.3.0-combat-loop`
- Rollback: revert the combat-loop merge.

### Phase 5: Resource And Building Loop

- Goal: deliver economy and structure placement.
- Input: combat loop.
- Output:
  - resource nodes,
  - worker gather/return loop,
  - single spend path,
  - building placement preview,
  - footprint and occupancy rules,
  - base/resource structure flow.
- Acceptance: player can gather, return, spend, and place structures through one economy path.
- Branch: `feature/resource-and-building-loop`
- Suggested tag: `v0.4.0-resource-building`
- Rollback: revert the resource/building merge.

### Phase 6: Production Loop

- Goal: deliver player production and roster flow.
- Input: resource/building loop.
- Output:
  - main base production,
  - barracks production,
  - infantry/tank training,
  - queue rules,
  - spawn rules,
  - cost and timer definitions.
- Acceptance: player can build required structures and produce the playable combat roster.
- Branch: `feature/production-loop`
- Suggested tag: `v0.5.0-production`
- Rollback: revert the production merge.

### Phase 7: Enemy AI Loop

- Goal: deliver a complete AI opponent economy-to-attack loop.
- Input: production loop.
- Output:
  - AI gather/build/produce rules,
  - target selection,
  - pressure cadence,
  - rebuild behavior,
  - active attack waves.
- Acceptance: AI can play a basic match and actively challenge the player instead of idling.
- Branch: `feature/enemy-ai-loop`
- Suggested tag: `v0.6.0-ai-loop`
- Rollback: revert the AI merge.

### Phase 8: Game Loop And Win/Loss

- Goal: close the full match lifecycle.
- Input: enemy AI loop.
- Output:
  - start-of-match setup,
  - victory and defeat detection,
  - restart flow,
  - replayable single-match loop.
- Acceptance: a full match can start, progress, finish, and restart without manual scene editing.
- Branch: `feature/game-loop-and-win-loss`
- Suggested tag: `v0.7.0-game-loop`
- Rollback: revert the game-loop merge.

### Phase 9: UI Completion

- Goal: finish practical RTS HUD surfaces without UI owning gameplay state.
- Input: game loop.
- Output:
  - resource display,
  - build menu,
  - unit/building info panel,
  - production menu,
  - win/loss overlays.
- Acceptance: all key actions and match state are visible and usable through a stable HUD.
- Branch: `feature/ui-completion`
- Suggested tag: `v0.8.0-ui`
- Rollback: revert the UI merge.

### Phase 10: Demo Stabilization

- Goal: harden the playable version for repeatable local play and future art replacement.
- Input: UI-complete playable build.
- Output:
  - consistency cleanup,
  - placeholder asset conventions,
  - smoke checks,
  - content/config hygiene,
  - debt audit.
- Acceptance:
  - no duplicate systems,
  - no blocker-level placeholder-art coupling,
  - stable local replayability.
- Branch: `refactor/demo-stabilization`
- Suggested tag: `v0.9.0-demo-stable`
- Rollback: revert the stabilization merge or redeploy the previous tag.

### Phase 11: CI Publish

- Goal: finalize publish readiness.
- Input: stabilized playable build.
- Output:
  - release workflow,
  - static hosting output path,
  - deployment notes,
  - automated verification path.
- Acceptance: the project can build static assets and is ready for automated deployment.
- Branch: `feature/ci-publish`
- Suggested tag: `v1.0.0-web-rts-playable`
- Rollback: redeploy the previous stable tag or revert publish workflow changes.

## Serial And Parallel Work

- Serial:
  - repo bootstrap must be accepted before core runtime expands,
  - core runtime must land before input/combat/resource systems branch out,
  - AI must build on the same production/resource/combat systems as the player.
- Parallel:
  - validation and CI hardening can progress alongside gameplay phases,
  - refactor audits should run every 3 to 5 tasks,
  - docs mirror sync happens in the same branch as root-doc updates.

## Subagent Responsibility Model

- Architecture Agent: guards module boundaries, command/store/event ownership, and anti-duplication rules.
- Repo Bootstrap Agent: owns app shell, project structure, CI baseline, and route clarity.
- Core Runtime Agent: owns state domains, identity contracts, command types, and runtime configuration.
- Core Loop Agent: owns selection, command translation, movement, and camera behavior.
- Combat / Resource Agent: owns damage, gathering, placement, spending, and production loops.
- AI Agent: owns enemy economy, production, pressure cadence, and attack targeting.
- UI Agent: owns HUD presentation and intent forwarding without state ownership.
- Validation / Build Agent: owns lint, typecheck, build, smoke checks, and publish readiness.
- Refactor / Consistency Agent: audits second-system drift, God objects, and placeholder-art coupling.
