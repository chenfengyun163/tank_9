# PlayCanvas RTS Code Rules v2

## Delivery Rules

- One atomic task per branch.
- Prefer the smallest safe step that advances the playable RTS loop.
- Root docs are updated first; `docs/` mirrors are synced in the same change.

## Hard Constraints

- TypeScript-first.
- Single-player only in v1.
- Ground units only in v1.
- No multiplayer or backend-first architecture.
- No second resource system.
- No second event system.
- No second damage system.
- No second state store.
- UI must never own runtime state.
- Avoid editor-only setup when code can create the same runtime structure.

## Architecture Safety Rules

- Commands are the only gameplay mutation path.
- `GameEvents` are notifications only.
- `core` is the only place for shared contracts and state definitions.
- `bootstrap` wires the app but does not implement game rules.
- `ui` only reflects state and forwards intent.
- Placeholder asset identity must be driven by stable keys, not hard-coded geometry assumptions.

## Testing And Validation Rules

- Each task must document:
  - what changed,
  - what was intentionally not changed,
  - manual preview steps,
  - acceptance criteria,
  - rollback approach.
- Runtime-facing tasks should pass `npm run lint`, `npm run typecheck`, and `npm run build`.

## Forbidden Patterns

- No God Object world manager.
- No UI-owned resource, health, or selection truth.
- No duplicate event buses hidden inside feature modules.
- No direct gameplay mutation from DOM-only code.
- No inspector-first architecture as the primary project composition method.
- No gameplay logic branching on temporary placeholder visuals.
