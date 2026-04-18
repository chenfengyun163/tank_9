# Unity To PlayCanvas Migration Map v1

## Migration Intent

Unity is no longer the production route. The old Unity work is now treated as a design-asset source that informs the new PlayCanvas + TypeScript implementation.

## What We Preserve

- RTS target scope:
  - single-player,
  - infantry and tanks,
  - main base, barracks, resource building,
  - one resource,
  - movement,
  - combat,
  - building,
  - production,
  - basic enemy AI.
- Module boundaries:
  - Core,
  - Units,
  - Buildings,
  - Resources,
  - Input,
  - UI,
  - AI.
- Delivery discipline:
  - atomic tasks,
  - branch-per-task,
  - rollback-first workflow,
  - periodic debt reviews.

## Unity Module To PlayCanvas Module Mapping

- `ResourceManager.cs` -> `src/core/game-state.ts` + `src/systems/resource-system.ts`
- `GameEvents.cs` idea -> `src/core/game-events.ts`
- `TeamType.cs` -> `src/core/team-type.ts`
- `IDamageable.cs` -> `src/core/damageable.ts`
- `GridManager.cs` -> `src/systems/grid-occupancy.ts` or placement support inside `build-placement.ts`
- `PlacementSystem.cs` -> `src/entities/buildings/build-placement.ts`
- `PreviewRenderer.cs` -> placement preview logic under `build-placement.ts` plus minimal rendering helper
- `CameraController.cs` -> `src/scenes/main-scene.ts` or `src/bootstrap/world-factory.ts`
- Unity `BuildingData` ScriptableObjects -> JSON or typed config records in `assets/configs/`

## What Can Be Translated Conceptually

- Grid occupancy and placement legality.
- Single-resource spend / refund rules.
- Team identity and damage contracts.
- Base-centered production flow.
- Resource gather-and-return loop.
- Enemy pressure pacing.

## What Must Be Rewritten

- Scene composition and runtime bootstrap.
- Entity lifecycle and component attachment.
- Movement implementation.
- Input hit testing.
- UI wiring.
- Asset loading and manifest management.

## What Must Be Deleted

- MonoBehaviour-first architecture.
- `Awake` / `Start` / `Update` as the primary system design.
- ScriptableObject runtime configuration as a project pillar.
- Inspector-heavy dependency injection.
- Scene/prefab manual setup as the required delivery path.
- Global singleton hub patterns like `GameMaster`.
- Physics-driven ad hoc RTS movement from the reference repo.

## Migration Rules

- Do not port Unity C# line-for-line.
- Port gameplay intent and data relationships, not engine-specific implementation.
- If a Unity concept required editor-heavy setup, replace it with code-first bootstrap or typed config.
- Keep one state store, one event surface, and one damage contract in the new route.
