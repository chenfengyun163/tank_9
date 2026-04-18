import type { Application } from 'playcanvas';
import { describe, expect, it } from 'vitest';

import { ASSET_MANIFEST } from '../../src/bootstrap/asset-manifest';
import { GameEvents } from '../../src/core/game-events';
import type { EntitySnapshot, GameState } from '../../src/core/game-state';
import { StateStore } from '../../src/core/state-store';
import { TeamType } from '../../src/core/team-type';
import { GameController } from '../../src/runtime/game-controller';
import type { RuntimeViewRegistry } from '../../src/runtime/view-registry';

class NoopRegistry implements RuntimeViewRegistry {
  public clear(): void {}
  public sync(_state: GameState, _selectedIds: Set<string>): void {}
  public unregister(_entityId: string): void {}
}

const createController = (): { controller: GameController; stateStore: StateStore } => {
  const stateStore = new StateStore();
  const controller = new GameController({
    app: { on() {} } as unknown as Application,
    world: { worldRoot: {} } as never,
    stateStore,
    gameEvents: new GameEvents(),
    assetManifest: ASSET_MANIFEST,
    registry: new NoopRegistry(),
    autoBindUpdate: false
  });
  return { controller, stateStore };
};

const tickFor = (controller: GameController, seconds: number, dt = 0.1): void => {
  const ticks = Math.ceil(seconds / dt);
  for (let index = 0; index < ticks; index += 1) {
    controller.tick(dt);
  }
};

const enemyUnits = (state: GameState): EntitySnapshot[] =>
  state.entities.allIds
    .map((id) => state.entities.byId[id])
    .filter((entity): entity is EntitySnapshot => Boolean(entity?.alive && entity.team === TeamType.Enemy && entity.category === 'unit'));

describe('AiSystem smoke stability', () => {
  it('resets AI runtime state cleanly after restart', () => {
    const { controller, stateStore } = createController();
    controller.startMatch();
    tickFor(controller, 20);
    controller.restartMatch();

    const state = stateStore.getSnapshot();
    expect(state.session.phase).toBe('boot');
    expect(state.ai.enemy.strategicPhase).toBe('boot');
    expect(state.ai.enemy.currentWave).toBeNull();
    expect(state.ai.enemy.waveHistory).toHaveLength(0);
  });

  it('stays active over a long smoke simulation without stalling command flow', () => {
    const { controller, stateStore } = createController();
    controller.startMatch();
    stateStore.update((draft) => {
      draft.economy.byTeam[TeamType.Enemy].manpower = 1800;
      draft.economy.byTeam[TeamType.Enemy].power = 1400;
      return draft;
    });

    let maxQueuedCommands = 0;
    for (let index = 0; index < 1800; index += 1) {
      controller.tick(0.1);
      maxQueuedCommands = Math.max(maxQueuedCommands, stateStore.getSnapshot().orders.queuedCommands);
    }

    const state = stateStore.getSnapshot();
    expect(maxQueuedCommands).toBeLessThan(20);
    expect(state.research.byTeam[TeamType.Enemy].completedIds.length).toBeGreaterThan(0);
    expect(enemyUnits(state).length).toBeGreaterThanOrEqual(4);
    expect(state.session.aiPhase).not.toBe('boot');
  });
});
