# PlayCanvas RTS Architecture v2

## Goal

Build a complete, replayable, single-player Web RTS with PlayCanvas and TypeScript. The runtime must be code-first, editor-light, GitHub-friendly, and safe for later art replacement without gameplay rewrites.

## Canonical Documentation Rule

- Root docs are authoritative.
- `docs/` mirrors root docs for publishing and onboarding.
- Mirrored docs must never become a second source of truth.

## Core Architecture Principles

- One resource system.
- One event system.
- One damage system.
- One state store.
- Commands are the only gameplay mutation entrypoint.
- Events are notifications, not a second command path.
- UI does not own core state.
- Systems are bootstrapped by code, not by manual editor wiring.
- Placeholder visuals must be replaceable by swapping config and presentation keys, not gameplay logic.

## Module Boundaries

### Core

- Owns shared contracts, state domains, command types, team identity, damage contracts, and runtime configuration.
- Must not contain rendering code, DOM code, or PlayCanvas entity creation.

### Entities

- Own instance-level unit, building, and resource behavior plus presentation adapters.
- Can expose capabilities and local state.
- Must not become global managers or a second orchestration layer.

### Systems

- Own cross-entity orchestration such as combat, resources, production, AI, occupancy, and win/loss rules.
- Consume commands, read the store, update authoritative state, and emit events.

### Input

- Owns hit testing, selection, drag-box handling, and command translation.
- Must not mutate resources, health, production queues, or AI state directly.

### UI

- Reads state snapshots and reacts to notifications.
- Emits player intent only through approved command/controller entrypoints.
- Must never own gameplay truth.

### Bootstrap / Platform

- Creates the PlayCanvas app, the DOM shell, and the world shell through code.
- May mount placeholder visuals and root entities.
- Must not accumulate gameplay rules, economy logic, combat rules, or AI behavior.

## Runtime Data Flow

1. Input or UI emits an intent.
2. Intent is translated into a typed command.
3. Commands are the only supported gameplay mutation path.
4. Systems process commands and update the authoritative store.
5. Systems and entities emit typed notifications through the shared event surface.
6. UI reads snapshots and notifications to refresh presentation.

## Placeholder Asset Replacement Rules

- Every unit, building, and resource type must have:
  - a stable `id`,
  - a `configKey`,
  - an `assetKey`,
  - collider or footprint metadata,
  - anchor and scale conventions.
- Placeholder visuals may use primitive meshes and flat materials.
- Gameplay code must never branch on a mesh type, material color, or temporary geometry choice.

## What Carries Forward From Unity

- Single-resource economy.
- Base RTS module boundaries.
- Atomic task discipline and rollback-first workflow.
- Build placement, production, collection, and enemy pressure as target loops.

## What Does Not Carry Forward

- MonoBehaviour-centric lifecycle assumptions.
- ScriptableObject runtime configuration as a core pillar.
- Inspector-heavy dependency injection.
- Scene and prefab wiring as the required composition path.
- Global gameplay singleton hubs.
