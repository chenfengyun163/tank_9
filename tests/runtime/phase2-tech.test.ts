import type { Application } from 'playcanvas';
import { describe, expect, it } from 'vitest';

import { ASSET_MANIFEST } from '../../src/bootstrap/asset-manifest';
import { ContentRegistry } from '../../src/core/content-registry';
import { GameEvents } from '../../src/core/game-events';
import type { EntitySnapshot, GameState } from '../../src/core/game-state';
import { StateStore } from '../../src/core/state-store';
import { TeamType } from '../../src/core/team-type';
import { getBuildAvailability } from '../../src/core/unlock-rules';
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

const tickUntil = (controller: GameController, predicate: () => boolean, maxTicks = 1000, dt = 0.1): void => {
  for (let index = 0; index < maxTicks; index += 1) {
    if (predicate()) return;
    controller.tick(dt);
  }
  throw new Error('Timed out waiting for technology result');
};

describe('phase 2 technology system', () => {
  it('blocks phase upgrade research before prerequisite buildings exist', () => {
    const { controller, stateStore } = createController();
    controller.startMatch();
    const base = stateStore.getSnapshot().entities.allIds
      .map((id) => stateStore.getSnapshot().entities.byId[id])
      .find((entity): entity is EntitySnapshot => Boolean(entity?.team === TeamType.Player && entity.kind === 'mainBase'));
    if (!base) throw new Error('Missing base');

    controller.enqueueCommand({
      id: controller.createCommandId(),
      source: 'player',
      type: 'research',
      buildingId: base.id,
      techId: 'phase.two'
    });
    controller.tick(0.1);

    const state = stateStore.getSnapshot();
    expect(state.research.byTeam[TeamType.Player].activeByBuildingId[base.id]).toBeUndefined();
    expect(state.session.message).toContain('兵营');
  });

  it('starts and completes T2 research, then unlocks tech lab construction', () => {
    const { controller, stateStore } = createController();
    controller.startMatch();
    const base = stateStore.getSnapshot().entities.allIds
      .map((id) => stateStore.getSnapshot().entities.byId[id])
      .find((entity): entity is EntitySnapshot => Boolean(entity?.team === TeamType.Player && entity.kind === 'mainBase'));
    if (!base) throw new Error('Missing base');

    stateStore.update((draft) => {
      addBuiltEntity(draft, 'buildings.powerPlant', TeamType.Player, { x: -18, y: 0, z: 4 });
      addBuiltEntity(draft, 'buildings.barracks', TeamType.Player, { x: -18, y: 0, z: 10 });
      draft.economy.byTeam[TeamType.Player].manpower = 1000;
      draft.economy.byTeam[TeamType.Player].power = 1000;
      return draft;
    });

    controller.enqueueCommand({
      id: controller.createCommandId(),
      source: 'player',
      type: 'research',
      buildingId: base.id,
      techId: 'phase.two'
    });
    controller.tick(0.1);

    expect(stateStore.getSnapshot().research.byTeam[TeamType.Player].activeByBuildingId[base.id]?.techId).toBe('phase.two');

    tickUntil(controller, () => stateStore.getSnapshot().research.byTeam[TeamType.Player].completedIds.includes('phase.two'));

    const state = stateStore.getSnapshot();
    expect(state.research.byTeam[TeamType.Player].tier).toBe('T2');
    expect(getBuildAvailability(state, TeamType.Player, 'buildings.techLab').status).toBe('available');
  });

  it('applies attribute upgrades to simulation stats', () => {
    const { controller, stateStore } = createController();
    controller.startMatch();

    stateStore.update((draft) => {
      draft.research.byTeam[TeamType.Player].tier = 'T2';
      draft.research.byTeam[TeamType.Player].completedIds.push('phase.two');
      addBuiltEntity(draft, 'buildings.techLab', TeamType.Player, { x: -16, y: 0, z: 4 });
      addBuiltEntity(draft, 'units.infantry', TeamType.Player, { x: -10, y: 0, z: 4 });
      draft.economy.byTeam[TeamType.Player].manpower = 1000;
      draft.economy.byTeam[TeamType.Player].power = 1000;
      return draft;
    });

    const techLab = stateStore.getSnapshot().entities.allIds
      .map((id) => stateStore.getSnapshot().entities.byId[id])
      .find((entity): entity is EntitySnapshot => Boolean(entity?.team === TeamType.Player && entity.kind === 'techLab'));
    const infantry = stateStore.getSnapshot().entities.allIds
      .map((id) => stateStore.getSnapshot().entities.byId[id])
      .find((entity): entity is EntitySnapshot => Boolean(entity?.team === TeamType.Player && entity.kind === 'infantry'));
    if (!techLab || !infantry) throw new Error('Missing test entities');

    const baseDamage = infantry.attackDamage;
    controller.enqueueCommand({
      id: controller.createCommandId(),
      source: 'player',
      type: 'research',
      buildingId: techLab.id,
      techId: 'weapons.ballistics'
    });

    tickUntil(controller, () => stateStore.getSnapshot().research.byTeam[TeamType.Player].completedIds.includes('weapons.ballistics'));

    const updatedInfantry = stateStore.getSnapshot().entities.byId[infantry.id];
    expect(updatedInfantry.attackDamage).toBeGreaterThan(baseDamage);
  });

  it('unlocks new units after the matching technology completes', () => {
    const { controller, stateStore } = createController();
    controller.startMatch();

    stateStore.update((draft) => {
      draft.research.byTeam[TeamType.Player].tier = 'T2';
      draft.research.byTeam[TeamType.Player].completedIds.push('phase.two');
      const barracksId = addBuiltEntity(draft, 'buildings.barracks', TeamType.Player, { x: -17, y: 0, z: 9 });
      addBuiltEntity(draft, 'buildings.techLab', TeamType.Player, { x: -17, y: 0, z: 3 });
      draft.economy.byTeam[TeamType.Player].manpower = 1000;
      draft.economy.byTeam[TeamType.Player].power = 1000;
      draft.production.queuesByEntityId[barracksId] = [];
      return draft;
    });

    const barracks = stateStore.getSnapshot().entities.allIds
      .map((id) => stateStore.getSnapshot().entities.byId[id])
      .find((entity): entity is EntitySnapshot => Boolean(entity?.team === TeamType.Player && entity.kind === 'barracks'));
    const techLab = stateStore.getSnapshot().entities.allIds
      .map((id) => stateStore.getSnapshot().entities.byId[id])
      .find((entity): entity is EntitySnapshot => Boolean(entity?.team === TeamType.Player && entity.kind === 'techLab'));
    if (!barracks || !techLab) throw new Error('Missing production chain');

    controller.enqueueCommand({
      id: controller.createCommandId(),
      source: 'player',
      type: 'research',
      buildingId: techLab.id,
      techId: 'doctrine.lancerLoadout'
    });
    tickUntil(controller, () => stateStore.getSnapshot().research.byTeam[TeamType.Player].completedIds.includes('doctrine.lancerLoadout'));

    controller.enqueueCommand({
      id: controller.createCommandId(),
      source: 'player',
      type: 'produce',
      buildingId: barracks.id,
      unitKind: 'lancer'
    });
    controller.tick(0.1);

    expect((stateStore.getSnapshot().production.queuesByEntityId[barracks.id] ?? []).at(0)?.kind).toBe('lancer');
  });
});
