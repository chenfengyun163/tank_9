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

const getPlayerWorker = (stateStore: StateStore): EntitySnapshot => {
  const worker = stateStore.getSnapshot().entities.allIds
    .map((id) => stateStore.getSnapshot().entities.byId[id])
    .find((entity): entity is EntitySnapshot => Boolean(entity?.team === TeamType.Player && entity.kind === 'worker'));
  if (!worker) {
    throw new Error('Missing worker');
  }
  return worker;
};

const spawnWorker = (controller: GameController, stateStore: StateStore): EntitySnapshot => {
  controller.startMatch();
  return getPlayerWorker(stateStore);
};

const tickUntil = (controller: GameController, predicate: () => boolean, maxTicks = 400, dt = 0.1): void => {
  for (let index = 0; index < maxTicks; index += 1) {
    if (predicate()) {
      return;
    }
    controller.tick(dt);
  }
  throw new Error('Timed out waiting for condition');
};

describe('stage 1 command extensions', () => {
  it('assigns and recalls control groups through commands', () => {
    const { controller, stateStore } = createController();
    const worker = spawnWorker(controller, stateStore);

    controller.enqueueCommand({
      id: controller.createCommandId(),
      source: 'player',
      type: 'assignControlGroup',
      groupIndex: 1,
      entityIds: [worker.id]
    });
    controller.tick(0.1);

    expect(stateStore.getSnapshot().controlGroups.groups[1]).toEqual([worker.id]);

    controller.enqueueCommand({
      id: controller.createCommandId(),
      source: 'player',
      type: 'recallControlGroup',
      groupIndex: 1
    });
    controller.tick(0.1);

    expect(stateStore.getSnapshot().selection.selectedIds).toEqual([worker.id]);
  });

  it('queues commands when queue flag is enabled', () => {
    const { controller, stateStore } = createController();
    const worker = spawnWorker(controller, stateStore);

    controller.enqueueCommand({
      id: controller.createCommandId(),
      source: 'player',
      type: 'move',
      entityIds: [worker.id],
      target: { x: -2, y: 0, z: 6 }
    });
    controller.enqueueCommand({
      id: controller.createCommandId(),
      source: 'player',
      type: 'move',
      entityIds: [worker.id],
      target: { x: -1, y: 0, z: 10 },
      queue: true
    });
    controller.tick(0.1);

    const after = stateStore.getSnapshot().entities.byId[worker.id];
    expect(after.order.type).toBe('move');
    expect(after.orderQueue).toHaveLength(1);
  });

  it('uses the completed move destination as patrol loop origin when shift-queued', () => {
    const { controller, stateStore } = createController();
    const worker = spawnWorker(controller, stateStore);
    const moveTarget = { x: -18, y: 0, z: 16 };
    const patrolTarget = { x: -14, y: 0, z: 18 };

    controller.enqueueCommand({
      id: controller.createCommandId(),
      source: 'player',
      type: 'move',
      entityIds: [worker.id],
      target: moveTarget
    });
    controller.tick(0.1);

    controller.enqueueCommand({
      id: controller.createCommandId(),
      source: 'player',
      type: 'patrol',
      entityIds: [worker.id],
      target: patrolTarget,
      queue: true
    });
    controller.tick(0.1);

    tickUntil(controller, () => stateStore.getSnapshot().entities.byId[worker.id]?.order.type === 'patrol');

    const after = stateStore.getSnapshot().entities.byId[worker.id];
    if (after.order.type !== 'patrol') {
      throw new Error('Expected patrol order');
    }
    expect(after.order.path[0].x).toBeCloseTo(moveTarget.x, 3);
    expect(after.order.path[0].z).toBeCloseTo(moveTarget.z, 3);
    expect(after.order.loopOrigin?.x).toBeCloseTo(moveTarget.x, 3);
    expect(after.order.loopOrigin?.z).toBeCloseTo(moveTarget.z, 3);
  });

  it('uses the last queued movement destination as patrol loop origin', () => {
    const { controller, stateStore } = createController();
    const worker = spawnWorker(controller, stateStore);
    const firstMove = { x: -5, y: 0, z: 6 };
    const secondMove = { x: -8, y: 0, z: 10 };
    const patrolTarget = { x: -3, y: 0, z: 12 };

    controller.enqueueCommand({
      id: controller.createCommandId(),
      source: 'player',
      type: 'move',
      entityIds: [worker.id],
      target: firstMove
    });
    controller.tick(0.1);

    controller.enqueueCommand({
      id: controller.createCommandId(),
      source: 'player',
      type: 'move',
      entityIds: [worker.id],
      target: secondMove,
      queue: true
    });
    controller.enqueueCommand({
      id: controller.createCommandId(),
      source: 'player',
      type: 'patrol',
      entityIds: [worker.id],
      target: patrolTarget,
      queue: true
    });
    controller.tick(0.1);

    const queuedPatrol = stateStore.getSnapshot().entities.byId[worker.id].orderQueue.at(-1);
    if (!queuedPatrol || queuedPatrol.type !== 'patrol') {
      throw new Error('Expected queued patrol order');
    }

    expect(queuedPatrol.path[0].x).toBeCloseTo(secondMove.x, 3);
    expect(queuedPatrol.path[0].z).toBeCloseTo(secondMove.z, 3);
    expect(queuedPatrol.loopOrigin?.x).toBeCloseTo(secondMove.x, 3);
    expect(queuedPatrol.loopOrigin?.z).toBeCloseTo(secondMove.z, 3);
  });

  it('updates fog of war visibility and enemy memory', () => {
    const { controller, stateStore } = createController();
    controller.startMatch();
    controller.tick(0.1);

    const state = stateStore.getSnapshot();
    expect(state.visibility.visibleCellKeys.length).toBeGreaterThan(0);
    expect(state.visibility.enemyMemories).toBeDefined();
  });
});
