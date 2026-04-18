import type { Application } from 'playcanvas';
import { describe, expect, it } from 'vitest';

import { ASSET_MANIFEST } from '../../src/bootstrap/asset-manifest';
import { ContentRegistry } from '../../src/core/content-registry';
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

const tickUntil = (controller: GameController, predicate: () => boolean, maxTicks = 400, dt = 0.1): void => {
  for (let index = 0; index < maxTicks; index += 1) {
    if (predicate()) {
      return;
    }
    controller.tick(dt);
  }
  throw new Error('Timed out waiting for condition');
};

const findEntity = (state: GameState, filter: (entity: EntitySnapshot) => boolean): EntitySnapshot => {
  const entity = state.entities.allIds
    .map((id) => state.entities.byId[id])
    .find((candidate): candidate is EntitySnapshot => Boolean(candidate && filter(candidate)));
  if (!entity) {
    throw new Error('Expected entity');
  }
  return entity;
};

const addBuiltEntity = (
  state: GameState,
  configKey: string,
  team: TeamType,
  position: { x: number; y: number; z: number }
): string => {
  const rule = ContentRegistry.getRule(configKey);
  const definition = ASSET_MANIFEST.units.find((entry) => entry.configKey === configKey)
    ?? ASSET_MANIFEST.buildings.find((entry) => entry.configKey === configKey)
    ?? ASSET_MANIFEST.resources.find((entry) => entry.configKey === configKey);
  const id = `ent-${state.world.nextEntityId++}`;
  state.entities.byId[id] = {
    id,
    team,
    category: rule.category,
    kind: rule.kind,
    configKey,
    assetKey: configKey,
    position: { ...position },
    rotationY: 0,
    hp: rule.maxHp,
    maxHp: rule.maxHp,
    speed: rule.speed,
    attackRange: rule.attackRange,
    attackDamage: rule.attackDamage,
    armor: rule.armor,
    attackCooldown: rule.attackCooldown,
    attackCooldownRemaining: 0,
    sightRange: rule.sightRange,
    selectionRadius: definition?.footprint.selectionRadius ?? 0.6,
    engagementProfile: rule.engagementProfile,
    footprint: {
      tilesX: definition?.footprint.tiles.x ?? 1,
      tilesY: definition?.footprint.tiles.y ?? 1,
      colliderRadius: definition?.footprint.colliderRadius ?? 0.5,
      selectionRadius: definition?.footprint.selectionRadius ?? 0.6
    },
    alive: true,
    built: true,
    buildProgress: rule.buildTime,
    buildTime: rule.buildTime,
    order: { type: 'idle' },
    orderQueue: [],
    carryAmount: 0,
    carryCapacity: rule.carryCapacity,
    carryResourceType: null,
    gatherRate: rule.gatherRate,
    resourceAmount: rule.resourceAmount,
    resourceType: rule.resourceType,
    productionKinds: [...rule.productionKinds],
    researchKinds: [...rule.researchKinds],
    canDropOffResources: rule.canDropOffResources,
    rallyPoint: rule.productionKinds.length > 0 ? { x: position.x + 4, y: 0, z: position.z } : undefined,
    recentDamageSeconds: 0,
    assignedBuilderIds: [],
    baseAttackDamage: rule.attackDamage,
    baseAttackRange: rule.attackRange,
    baseArmor: rule.armor,
    baseSightRange: rule.sightRange,
    baseGatherRate: rule.gatherRate,
    baseBuildTime: rule.buildTime
  };
  state.entities.allIds.push(id);
  return id;
};

describe('phase 1 economy loop', () => {
  it('returns gathered manpower to the nearest drop-off', () => {
    const { controller, stateStore } = createController();
    controller.startMatch();
    const initial = stateStore.getSnapshot().economy.byTeam[TeamType.Player].manpower;
    const worker = findEntity(stateStore.getSnapshot(), (entity) => entity.team === TeamType.Player && entity.kind === 'worker');
    const crystal = findEntity(stateStore.getSnapshot(), (entity) => entity.category === 'resource' && entity.resourceType === 'manpower');

    controller.enqueueCommand({
      id: controller.createCommandId(),
      source: 'player',
      type: 'gather',
      entityIds: [worker.id],
      targetEntityId: crystal.id
    });

    tickUntil(controller, () => stateStore.getSnapshot().economy.byTeam[TeamType.Player].manpower > initial + 20, 500, 0.1);

    const after = stateStore.getSnapshot();
    expect(after.economy.byTeam[TeamType.Player].manpower).toBeGreaterThan(initial + 20);
  });

  it('lets workers construct a barracks and then produce infantry', () => {
    const { controller, stateStore } = createController();
    controller.startMatch();

    const workers = stateStore.getSnapshot().entities.allIds
      .map((id) => stateStore.getSnapshot().entities.byId[id])
      .filter((entity): entity is EntitySnapshot => Boolean(entity?.team === TeamType.Player && entity.kind === 'worker'));
    const barracksCost = ContentRegistry.getRule('buildings.barracks').resourceCost;
    stateStore.update((draft) => {
      addBuiltEntity(draft, 'buildings.powerPlant', TeamType.Player, { x: -16, y: 0, z: 5 });
      draft.economy.byTeam[TeamType.Player].manpower = Math.max(draft.economy.byTeam[TeamType.Player].manpower, barracksCost.manpower + 200);
      draft.economy.byTeam[TeamType.Player].power = Math.max(draft.economy.byTeam[TeamType.Player].power, barracksCost.power + 100);
      return draft;
    });

    controller.enqueueCommand({
      id: controller.createCommandId(),
      source: 'player',
      type: 'build',
      entityIds: workers.map((worker) => worker.id),
      buildingConfigKey: 'buildings.barracks',
      target: { x: -20, y: 0, z: 1 }
    });
    controller.tick(0.1);

    const barracks = findEntity(stateStore.getSnapshot(), (entity) => entity.team === TeamType.Player && entity.kind === 'barracks');
    expect(barracks.built).toBe(false);

    tickUntil(controller, () => {
      const current = stateStore.getSnapshot().entities.byId[barracks.id];
      return Boolean(current?.built);
    }, 400, 0.1);

    controller.enqueueCommand({
      id: controller.createCommandId(),
      source: 'player',
      type: 'produce',
      buildingId: barracks.id,
      unitKind: 'infantry'
    });
    controller.tick(0.1);

    tickUntil(controller, () => stateStore.getSnapshot().entities.allIds
      .map((id) => stateStore.getSnapshot().entities.byId[id])
      .some((entity) => entity?.team === TeamType.Player && entity.kind === 'infantry'), 400, 0.1);

    const hasInfantry = stateStore.getSnapshot().entities.allIds
      .map((id) => stateStore.getSnapshot().entities.byId[id])
      .some((entity) => entity?.team === TeamType.Player && entity.kind === 'infantry');
    expect(hasInfantry).toBe(true);
  });

  it('increases supply cap after a supply depot completes', () => {
    const { controller, stateStore } = createController();
    controller.startMatch();
    const workers = stateStore.getSnapshot().entities.allIds
      .map((id) => stateStore.getSnapshot().entities.byId[id])
      .filter((entity): entity is EntitySnapshot => Boolean(entity?.team === TeamType.Player && entity.kind === 'worker'));
    const beforeCap = stateStore.getSnapshot().economy.byTeam[TeamType.Player].supplyCap;

    controller.enqueueCommand({
      id: controller.createCommandId(),
      source: 'player',
      type: 'build',
      entityIds: workers.map((worker) => worker.id),
      buildingConfigKey: 'buildings.supplyDepot',
      target: { x: -18, y: 0, z: 14 }
    });
    controller.tick(0.1);

    const depot = findEntity(stateStore.getSnapshot(), (entity) => entity.team === TeamType.Player && entity.kind === 'supplyDepot');
    tickUntil(controller, () => Boolean(stateStore.getSnapshot().entities.byId[depot.id]?.built), 400, 0.1);

    expect(stateStore.getSnapshot().economy.byTeam[TeamType.Player].supplyCap).toBe(beforeCap + 6);
  });
});
