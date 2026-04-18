import type { Application } from 'playcanvas';
import { describe, expect, it } from 'vitest';

import { ASSET_MANIFEST } from '../../src/bootstrap/asset-manifest';
import { GameEvents } from '../../src/core/game-events';
import { ContentRegistry } from '../../src/core/content-registry';
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

const getEntities = (state: GameState): EntitySnapshot[] =>
  state.entities.allIds
    .map((entityId) => state.entities.byId[entityId])
    .filter((entity): entity is EntitySnapshot => Boolean(entity));

const countKind = (state: GameState, team: TeamType, kind: EntitySnapshot['kind']): number =>
  getEntities(state).filter((entity) => entity.team === team && entity.kind === kind).length;

const findEntity = (state: GameState, team: TeamType, kind: EntitySnapshot['kind']): EntitySnapshot => {
  const entity = getEntities(state).find((snapshot) => snapshot.team === team && snapshot.kind === kind);
  if (!entity) {
    throw new Error(`Expected entity ${team}:${kind}`);
  }
  return entity;
};

describe('GameController phase 1 economy flow', () => {
  it('seeds a playable boot layout with base, workers and mixed resources', () => {
    const { stateStore } = createController();
    const state = stateStore.getSnapshot();

    expect(state.session.phase).toBe('boot');
    expect(countKind(state, TeamType.Player, 'mainBase')).toBe(1);
    expect(countKind(state, TeamType.Enemy, 'mainBase')).toBe(1);
    expect(countKind(state, TeamType.Player, 'worker')).toBe(2);
    expect(countKind(state, TeamType.Enemy, 'worker')).toBe(2);
    expect(getEntities(state).filter((entity) => entity.category === 'resource' && entity.resourceType === 'manpower').length).toBeGreaterThan(0);
    expect(getEntities(state).filter((entity) => entity.category === 'resource' && entity.resourceType === 'power').length).toBeGreaterThan(0);
  });

  it('keeps the boot match frozen before start', () => {
    const { controller, stateStore } = createController();
    const before = structuredClone(stateStore.getSnapshot()) as GameState;

    controller.tick(3);

    const after = stateStore.getSnapshot();
    expect(after.session.phase).toBe('boot');
    expect(after.session.elapsedSeconds).toBe(0);
    expect(after.economy.byTeam[TeamType.Player].manpower).toBe(before.economy.byTeam[TeamType.Player].manpower);
    expect(after.economy.byTeam[TeamType.Player].power).toBe(before.economy.byTeam[TeamType.Player].power);
    expect(after.session.aiPhase).toBe('boot');
  });

  it('starts from 00:00 and applies reduced passive income', () => {
    const { controller, stateStore } = createController();

    controller.enqueueCommand({
      id: controller.createCommandId(),
      source: 'player',
      type: 'start'
    });
    controller.tick(2);

    const after = stateStore.getSnapshot();
    expect(after.session.phase).toBe('playing');
    expect(after.session.elapsedSeconds).toBeCloseTo(2, 5);
    expect(after.economy.byTeam[TeamType.Player].manpower).toBeCloseTo(220.3, 5);
    expect(after.economy.byTeam[TeamType.Player].power).toBeCloseTo(120.16, 5);
  });

  it('lets the main base produce a worker and spend resources', () => {
    const { controller, stateStore } = createController();
    const playerBase = findEntity(stateStore.getSnapshot(), TeamType.Player, 'mainBase');
    const workerCost = ContentRegistry.getRule('units.worker').resourceCost;

    controller.startMatch();
    controller.enqueueCommand({
      id: controller.createCommandId(),
      source: 'player',
      type: 'produce',
      buildingId: playerBase.id,
      unitKind: 'worker'
    });
    controller.tick(0.1);

    const queued = stateStore.getSnapshot();
    expect(queued.production.queuesByEntityId[playerBase.id]).toHaveLength(1);
    expect(queued.economy.byTeam[TeamType.Player].manpower).toBeCloseTo(220 - workerCost.manpower + 0.015, 3);

    for (let index = 0; index < 40; index += 1) {
      controller.tick(0.25);
    }

    const completed = stateStore.getSnapshot();
    expect(countKind(completed, TeamType.Player, 'worker')).toBe(3);
    expect(completed.economy.byTeam[TeamType.Player].supplyUsed).toBe(3);
  });

  it('blocks unit production when supply cap is reached', () => {
    const { controller, stateStore } = createController();
    const playerBase = findEntity(stateStore.getSnapshot(), TeamType.Player, 'mainBase');

    controller.startMatch();
    stateStore.update((draft) => {
      draft.economy.byTeam[TeamType.Player].supplyCap = 0;
      return draft;
    });

    controller.enqueueCommand({
      id: controller.createCommandId(),
      source: 'player',
      type: 'produce',
      buildingId: playerBase.id,
      unitKind: 'worker'
    });
    controller.tick(0.1);

    const after = stateStore.getSnapshot();
    expect(after.production.queuesByEntityId[playerBase.id] ?? []).toHaveLength(0);
    expect(after.session.message).toContain('人口上限不足');
  });

  it('restarts back to a fresh boot layout', () => {
    const { controller, stateStore } = createController();

    controller.startMatch();
    controller.tick(1);
    controller.restartMatch();

    const after = stateStore.getSnapshot();
    expect(after.session.phase).toBe('boot');
    expect(after.session.elapsedSeconds).toBe(0);
    expect(after.selection.selectedIds).toEqual([]);
    expect(after.orders.buildMode).toBe('none');
    expect(after.orders.commandMode).toBe('none');
    expect(after.session.aiPhase).toBe('boot');
    expect(after.ai.enemy.strategicPhase).toBe('boot');
    expect(countKind(after, TeamType.Player, 'mainBase')).toBe(1);
    expect(countKind(after, TeamType.Player, 'worker')).toBe(2);
  });

  it('settles on base destruction and freezes after victory', () => {
    const { controller, stateStore } = createController();

    controller.startMatch();
    stateStore.update((draft) => {
      const enemyBase = findEntity(draft, TeamType.Enemy, 'mainBase');
      enemyBase.alive = false;
      enemyBase.hp = 0;
      return draft;
    });

    controller.tick(0.1);
    const settled = stateStore.getSnapshot();
    expect(settled.session.phase).toBe('victory');
    expect(settled.session.winner).toBe(TeamType.Player);

    const elapsedAfterVictory = settled.session.elapsedSeconds;
    const manpowerAfterVictory = settled.economy.byTeam[TeamType.Player].manpower;
    controller.tick(2);

    const frozen = stateStore.getSnapshot();
    expect(frozen.session.phase).toBe('victory');
    expect(frozen.session.elapsedSeconds).toBe(elapsedAfterVictory);
    expect(frozen.economy.byTeam[TeamType.Player].manpower).toBe(manpowerAfterVictory);
  });
});
