# PlayCanvas RTS Task Board v2

## Current Branch

- `refactor/demo-polish`

## Next Branch

- `feature/ci-publish`

## Current Milestone

- Raise the playable slice to a sharper, more readable RTS demo before publish prep.

## Next Recommended Task

- Run demo polish on the playable slice by:
  - sharpening input response and command feedback,
  - improving camera control and battlefield readability,
  - extending smoke coverage for attack-move and rally-point flows,
  - trimming low-value placeholder artifacts,
  - validating the fixed local play-session URL (`npm run play`, with `npm run dev -- --host 127.0.0.1 --port 4173` as a fallback when needed).

## Backlog

- Demo stabilization.
- CI publish.

## In Progress

- Minimal playable recovery slice hardening.
- Demo stabilization bugfix pass.
- Headless runtime smoke tests and CI test stage.
- Browser input and HUD stability pass.
- Browser playtest bugfix pass.

## Blocked

- No hard blocker is currently stopping playable-recovery work.
- Publish hardening is blocked on smoke-test coverage and a focused playtest pass.
- Browser replayability still needs one more focused manual playtest pass after the latest stabilization fixes.

## Done

- The repository root now hosts the active Web game route.
- PlayCanvas + TypeScript + Vite project shell exists.
- Minimal code-first PlayCanvas app bootstrap exists.
- Camera, light, ground, and reference world shell can be created from code.
- Root architecture, code rules, migration map, and execution docs exist.
- CI baseline exists.
- Structured RTS runtime slices exist in one authoritative store.
- Canonical player/AI command surface exists for select, move, attack, gather, build, produce, and restart.
- Runtime entity registry syncs logical entities into PlayCanvas render entities.
- Minimal playable match flow exists with selection, movement, combat, gathering, building, production, AI pressure, win/loss, restart, and HUD panels.

## Risks

- Root docs and `docs/` can drift if they are edited independently.
- `GameController` now carries a lot of orchestration and needs a stabilization pass before more content is added.
- Browser-only interaction bugs may remain until a focused manual playtest round is completed.
- Large bundle warnings should be watched before publish hardening.

## Rollback Point

- Current playable-recovery slice before demo stabilization and publish hardening.

## Full Atomic Task Queue

1. Align root docs and `docs/` mirror policy under `feature/repo-bootstrap`. Done.
2. Update README to declare the root Web project as the only active production route. Done.
3. Move app shell ownership so canvas/HUD mounting is created by code rather than fixed HTML. Done.
4. Add placeholder asset/config registry contracts for units, buildings, and resources. Done.
5. Expand game session phases to cover bootstrap, loading, playing, victory, defeat, and restart. Done.
6. Replace the flat prototype state with RTS domain slices while keeping one store. Done.
7. Replace the minimal command union with a unified command envelope for select/move/attack/gather/build/produce/restart. Done.
8. Define stable entity identity contracts: `id`, `configKey`, `assetKey`, `team`, `footprint`, `anchor`, `scale`. Done.
9. Add runtime entity registry and snapshot access rules. Done.
10. Add input hit testing and click selection. Done.
11. Add box selection and selection feedback rendering. Done.
12. Add right-click move command translation and unit move execution. Done.
13. Add infantry and tank placeholder definitions and spawn pipeline. Done.
14. Add attack command, target acquisition, cooldown, range, unified damage, and death cleanup. Done.
15. Add resource node definitions and worker gather/return loop. Done.
16. Add building placement preview, footprint occupancy, and placement validation. Done.
17. Add base, barracks, and resource-building definitions with shared structure contracts. Done.
18. Add production queues and spawn rules. Done.
19. Add AI economy loop: gather, spend, and build. Done.
20. Add AI military loop: produce, rally, attack, and retarget. Done.
21. Add match start seeding and win/loss detection. Done.
22. Add restart/reset flow for a new match. Done.
23. Add HUD resource panel, selection panel, build menu, production menu, and win/loss overlay. Done.
24. Add camera pan/zoom controls for battlefield navigation. Done.
25. Run a Refactor / Consistency audit for duplicate systems and art-replacement blockers. In progress.
26. Add smoke validation and publish workflow hardening. In progress.
