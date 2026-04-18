import type { AssetManifest } from '../bootstrap/asset-manifest';
import { APP_CONFIG } from '../core/config';
import { ContentRegistry } from '../core/content-registry';
import {
  createInitialAiRuntimeState,
  createInitialGameState,
  type GameState,
  type Vec3State
} from '../core/game-state';
import { TeamType } from '../core/team-type';

const spawnSeedEntity = (
  state: GameState,
  assetManifest: AssetManifest,
  configKey: string,
  team: TeamType,
  position: Vec3State,
  built: boolean
): void => {
  const rule = ContentRegistry.getRule(configKey);
  const manifestUnits = assetManifest.units.find((entry) => entry.configKey === configKey);
  const manifestBuildings = assetManifest.buildings.find((entry) => entry.configKey === configKey);
  const manifestResources = assetManifest.resources.find((entry) => entry.configKey === configKey);
  const definition = manifestUnits || manifestBuildings || manifestResources;
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
    built,
    buildProgress: built ? rule.buildTime : 0,
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

export const createSeededMatchState = (assetManifest: AssetManifest): GameState => {
  const state = createInitialGameState();
  state.world.width = APP_CONFIG.ground.width;
  state.world.depth = APP_CONFIG.ground.depth;
  state.session.phase = 'boot';
  state.session.isLoading = false;
  state.session.aiPhase = 'boot';
  state.ai.enemy = createInitialAiRuntimeState('boot');
  state.session.message = '点击“开始游戏”后，本局才会正式开始。';
  state.orders.notifications = [state.session.message];

  spawnSeedEntity(state, assetManifest, 'buildings.mainBase', TeamType.Player, { x: -12, y: 0, z: 9 }, true);
  spawnSeedEntity(state, assetManifest, 'buildings.mainBase', TeamType.Enemy, { x: 12, y: 0, z: -9 }, true);

  spawnSeedEntity(state, assetManifest, 'units.worker', TeamType.Player, { x: -8.8, y: 0, z: 11 }, true);
  spawnSeedEntity(state, assetManifest, 'units.worker', TeamType.Player, { x: -9.8, y: 0, z: 7 }, true);
  spawnSeedEntity(state, assetManifest, 'units.worker', TeamType.Enemy, { x: 8.8, y: 0, z: -11 }, true);
  spawnSeedEntity(state, assetManifest, 'units.worker', TeamType.Enemy, { x: 9.8, y: 0, z: -7 }, true);

  spawnSeedEntity(state, assetManifest, 'resources.crystalField', TeamType.Neutral, { x: -5.2, y: 0, z: 12.5 }, true);
  spawnSeedEntity(state, assetManifest, 'resources.powerWell', TeamType.Neutral, { x: -2.6, y: 0, z: 6.4 }, true);
  spawnSeedEntity(state, assetManifest, 'resources.crystalField', TeamType.Neutral, { x: 5.2, y: 0, z: -12.5 }, true);
  spawnSeedEntity(state, assetManifest, 'resources.powerWell', TeamType.Neutral, { x: 2.6, y: 0, z: -6.4 }, true);
  spawnSeedEntity(state, assetManifest, 'resources.crystalField', TeamType.Neutral, { x: 0, y: 0, z: 0 }, true);
  spawnSeedEntity(state, assetManifest, 'resources.powerWell', TeamType.Neutral, { x: 0, y: 0, z: 7.5 }, true);

  return state;
};
