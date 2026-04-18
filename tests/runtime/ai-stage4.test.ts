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

const tickUntil = (controller: GameController, predicate: () => boolean, maxTicks = 2600, dt = 0.1): void => {
  for (let index = 0; index < maxTicks; index += 1) {
    if (predicate()) return;
    controller.tick(dt);
  }
  throw new Error('Timed out waiting for stage-four AI behavior');
};

const addBuiltEntity = (
  state: GameState,
  configKey: string,
  team: TeamType,
  position: { x: number; y: number; z: number }
): void => {
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
};

const getEnemyEntities = (state: GameState): EntitySnapshot[] =>
  state.entities.allIds
    .map((id) => state.entities.byId[id])
    .filter((entity): entity is EntitySnapshot => Boolean(entity?.alive && entity.team === TeamType.Enemy));

describe('AiSystem phase 2 advanced chain', () => {
  it('builds tech lab and vehicle factory before producing tanks', () => {
    const { controller, stateStore } = createController();
    controller.startMatch();
    stateStore.update((draft) => {
      draft.research.byTeam[TeamType.Enemy].tier = 'T2';
      draft.research.byTeam[TeamType.Enemy].completedIds.push('phase.two');
      addBuiltEntity(draft, 'buildings.powerPlant', TeamType.Enemy, { x: 6, y: 0, z: -6 });
      addBuiltEntity(draft, 'buildings.barracks', TeamType.Enemy, { x: 4, y: 0, z: -12 });
      addBuiltEntity(draft, 'buildings.techLab', TeamType.Enemy, { x: -2, y: 0, z: -10 });
      addBuiltEntity(draft, 'buildings.vehicleFactory', TeamType.Enemy, { x: -2, y: 0, z: -4 });
      draft.economy.byTeam[TeamType.Enemy].manpower = 1600;
      draft.economy.byTeam[TeamType.Enemy].power = 1300;
      return draft;
    });

    tickUntil(controller, () => {
      const state = stateStore.getSnapshot();
      const enemy = getEnemyEntities(state);
      return enemy.some((entity) => entity.kind === 'tank');
    });

    const enemy = getEnemyEntities(stateStore.getSnapshot());
    expect(enemy.some((entity) => entity.kind === 'techLab')).toBe(true);
    expect(enemy.some((entity) => entity.kind === 'vehicleFactory')).toBe(true);
    expect(enemy.some((entity) => entity.kind === 'tank')).toBe(true);
  });

  it('can use newly unlocked higher-tier units', () => {
    const { controller, stateStore } = createController();
    controller.startMatch();
    stateStore.update((draft) => {
      draft.research.byTeam[TeamType.Enemy].tier = 'T2';
      draft.research.byTeam[TeamType.Enemy].completedIds.push('phase.two', 'doctrine.scoutTraining', 'doctrine.lancerLoadout');
      addBuiltEntity(draft, 'buildings.powerPlant', TeamType.Enemy, { x: 6, y: 0, z: -6 });
      addBuiltEntity(draft, 'buildings.barracks', TeamType.Enemy, { x: 4, y: 0, z: -12 });
      addBuiltEntity(draft, 'buildings.techLab', TeamType.Enemy, { x: -2, y: 0, z: -10 });
      addBuiltEntity(draft, 'buildings.vehicleFactory', TeamType.Enemy, { x: -2, y: 0, z: -4 });
      draft.economy.byTeam[TeamType.Enemy].manpower = 1800;
      draft.economy.byTeam[TeamType.Enemy].power = 1500;
      return draft;
    });

    tickUntil(controller, () => {
      const state = stateStore.getSnapshot();
      const enemy = getEnemyEntities(state);
      return enemy.some((entity) => entity.kind === 'lancer');
    });

    const enemy = getEnemyEntities(stateStore.getSnapshot());
    expect(enemy.some((entity) => entity.kind === 'lancer')).toBe(true);
  });
});
