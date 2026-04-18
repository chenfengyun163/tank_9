import type { Application } from 'playcanvas';

import type { AssetManifest } from '../bootstrap/asset-manifest';
import type { WorldFactoryResult } from '../bootstrap/world-factory';
import { ContentRegistry } from '../core/content-registry';
import type { GameCommand } from '../core/command-types';
import { GameEvents } from '../core/game-events';
import {
  createInitialAiRuntimeState,
  type BuildMode,
  type CommandMode,
  type EntitySnapshot,
  type FeedbackMarkerState,
  type GameState,
  type Vec3State
} from '../core/game-state';
import { StateStore } from '../core/state-store';
import { TeamType } from '../core/team-type';
import { createSeededMatchState } from './match-seeder';
import { isPlacementValid } from './placement-rules';
import { EntityRegistry } from './entity-registry';
import { FogOfWarSystem } from './systems/fog-of-war-system';
import { AiSystem } from './systems/ai-system';
import { CommandProcessor } from './systems/command-processor';
import { SimulationSystem } from './systems/simulation-system';
import type { RuntimeViewRegistry } from './view-registry';
import { updateVictoryState } from './victory-rules';

interface GameControllerOptions {
  app: Application;
  world: WorldFactoryResult;
  stateStore: StateStore;
  gameEvents: GameEvents;
  assetManifest: AssetManifest;
  registry?: RuntimeViewRegistry;
  autoBindUpdate?: boolean;
}

export class GameController {
  private readonly registry: RuntimeViewRegistry;
  private readonly commandQueue: GameCommand[] = [];
  private commandCounter = 0;
  private markerCounter = 0;
  private readonly commandProcessor: CommandProcessor;
  private readonly simulationSystem: SimulationSystem;
  private readonly aiSystem: AiSystem;
  private readonly fogOfWarSystem = new FogOfWarSystem();

  public constructor(private readonly options: GameControllerOptions) {
    this.registry = options.registry ?? new EntityRegistry(options.app, options.world.worldRoot, options.assetManifest);

    this.commandProcessor = new CommandProcessor({
      spawnEntity: (state, configKey, team, position, built) =>
        this.spawnEntity(state, configKey, team, position, built),
      pushNotification: (state, message) => this.pushNotification(state, message),
      isPlacementValid: (state, position, configKey) =>
        isPlacementValid(state, this.options.assetManifest, position, configKey),
      addMarker: (state, kind, position) => this.addMarker(state, kind, position)
    });

    this.simulationSystem = new SimulationSystem({
      spawnEntity: (state, configKey, team, position, built) =>
        this.spawnEntity(state, configKey, team, position, built),
      pushNotification: (state, message) => this.pushNotification(state, message),
      applyDamage: (state, targetId, amount) => this.applyDamage(state, targetId, amount),
      addMarker: (state, kind, position) => this.addMarker(state, kind, position)
    });

    this.aiSystem = new AiSystem({
      enqueueCommand: (command) => this.enqueueCommand(command),
      createCommandId: () => this.createCommandId()
    });

    this.seedMatch();

    if (options.autoBindUpdate ?? true) {
      this.options.app.on('update', this.tick, this);
    }
  }

  public tick(dt: number): void {
    const nextState = structuredClone(this.options.stateStore.getSnapshot()) as GameState;

    const commandResult = this.commandProcessor.processCommands(nextState, this.commandQueue);
    if (commandResult.shouldRestart) {
      this.restartMatch();
      return;
    }

    if (commandResult.shouldStart) {
      this.applyStartMatch(nextState);
    }

    if (nextState.session.phase === 'playing') {
      nextState.session.elapsedSeconds += dt;
      this.simulationSystem.update(nextState, dt);
      this.aiSystem.update(nextState, dt);
      this.cleanupDestroyedEntities(nextState);
      this.syncEconomyDerivedState(nextState);
      this.fogOfWarSystem.update(nextState);
      updateVictoryState(nextState);
    }

    this.updateFeedback(nextState, dt);
    nextState.orders.queuedCommands = this.commandQueue.length;
    this.commitState(nextState);
    this.registry.sync(nextState, new Set(nextState.selection.selectedIds));
    this.options.gameEvents.emit('state:changed', { state: nextState });
  }

  public enqueueCommand(command: GameCommand): void {
    this.commandQueue.push(command);
  }

  public createCommandId(): string {
    this.commandCounter += 1;
    return `cmd-${this.commandCounter}`;
  }

  public startMatch(): void {
    const nextState = structuredClone(this.options.stateStore.getSnapshot()) as GameState;
    if (nextState.session.phase !== 'boot') {
      return;
    }

    this.applyStartMatch(nextState);
    this.commitState(nextState);
    this.registry.sync(nextState, new Set(nextState.selection.selectedIds));
    this.options.gameEvents.emit('state:changed', { state: nextState });
  }

  public setBuildMode(buildMode: BuildMode): void {
    const nextState = structuredClone(this.options.stateStore.getSnapshot()) as GameState;
    nextState.orders.buildMode = buildMode;
    nextState.orders.commandMode = 'none';
    if (buildMode !== 'none') {
      this.pushNotification(nextState, `建造模式已开启：右键空地放置 ${ContentRegistry.getRule(buildMode).label}。`);
    }
    this.commitState(nextState);
  }

  public setCommandMode(commandMode: CommandMode): void {
    const nextState = structuredClone(this.options.stateStore.getSnapshot()) as GameState;
    nextState.orders.commandMode = commandMode;
    if (commandMode !== 'none') {
      nextState.orders.buildMode = 'none';
    }

    if (commandMode === 'attackMove') {
      this.pushNotification(nextState, '攻击移动已开启：右键指定落点，部队会沿途自动接敌。');
    } else if (commandMode === 'setRallyPoint') {
      this.pushNotification(nextState, '集合点模式已开启：右键设置生产建筑的集合点。');
    } else if (commandMode === 'patrol') {
      this.pushNotification(nextState, '巡逻模式已开启：右键指定巡逻终点。');
    }

    this.commitState(nextState);
  }

  public restartMatch(): void {
    this.commandQueue.length = 0;
    this.aiSystem.reset();
    this.seedMatch();
  }

  private applyStartMatch(state: GameState): void {
    if (state.session.phase !== 'boot') {
      return;
    }

    this.commandQueue.length = 0;
    this.aiSystem.reset();

    state.session.phase = 'playing';
    state.session.elapsedSeconds = 0;
    state.session.winner = null;
    state.session.aiPhase = 'opening';
    state.ai.enemy = createInitialAiRuntimeState('opening');
    state.session.message = '对局开始。';
    state.selection.selectedIds = [];
    state.orders.buildMode = 'none';
    state.orders.commandMode = 'none';
    state.orders.markers = [];
    state.orders.notifications = [state.session.message];
    state.orders.queuedCommands = 0;
    this.syncEconomyDerivedState(state);
    this.fogOfWarSystem.update(state);
  }

  private seedMatch(): void {
    this.registry.clear();
    const state = createSeededMatchState(this.options.assetManifest);
    this.syncEconomyDerivedState(state);
    this.fogOfWarSystem.update(state);
    this.commitState(state);
    this.registry.sync(state, new Set());
    this.options.gameEvents.emit('state:changed', { state });
  }

  private commitState(state: GameState): void {
    this.options.stateStore.replace(state);
  }

  private spawnEntity(
    state: GameState,
    configKey: string,
    team: TeamType,
    position: Vec3State,
    built: boolean
  ): string {
    const rule = ContentRegistry.getRule(configKey);
    const id = `ent-${state.world.nextEntityId++}`;
    const manifestUnits = this.options.assetManifest.units.find((entry) => entry.configKey === configKey);
    const manifestBuildings = this.options.assetManifest.buildings.find((entry) => entry.configKey === configKey);
    const manifestResources = this.options.assetManifest.resources.find((entry) => entry.configKey === configKey);
    const definition = manifestUnits || manifestBuildings || manifestResources;

    state.entities.byId[id] = {
      id,
      team,
      category: rule.category,
      kind: rule.kind,
      configKey,
      assetKey: configKey,
      position: { ...position },
      rotationY: 0,
      hp: built ? rule.maxHp : Math.max(1, Math.round(rule.maxHp * 0.2)),
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
    this.syncEconomyDerivedState(state);
    return id;
  }

  private applyDamage(state: GameState, targetId: string, amount: number): void {
    const target = state.entities.byId[targetId];
    if (!target?.alive) {
      return;
    }

    target.hp = Math.max(0, target.hp - amount);
    target.recentDamageSeconds = 0.25;
    this.addMarker(state, 'attack', target.position);

    if (target.hp <= 0) {
      target.alive = false;
      this.pushNotification(state, `${this.getEntityLabel(target)}被摧毁。`);
    }
  }

  private cleanupDestroyedEntities(state: GameState): void {
    const deadIds = state.entities.allIds.filter((id) => !state.entities.byId[id]?.alive);
    if (deadIds.length === 0) {
      return;
    }

    state.selection.selectedIds = state.selection.selectedIds.filter((id) => !deadIds.includes(id));
    for (const groupIndex of Object.keys(state.controlGroups.groups)) {
      const numericIndex = Number(groupIndex);
      state.controlGroups.groups[numericIndex] = state.controlGroups.groups[numericIndex]
        .filter((id) => !deadIds.includes(id));
    }

    for (const entityId of state.entities.allIds) {
      const entity = state.entities.byId[entityId];
      if (!entity?.assignedBuilderIds) {
        continue;
      }
      entity.assignedBuilderIds = entity.assignedBuilderIds.filter((builderId) => !deadIds.includes(builderId));
    }

    for (const deadId of deadIds) {
      delete state.entities.byId[deadId];
      delete state.production.queuesByEntityId[deadId];
      delete state.research.byTeam[TeamType.Player].activeByBuildingId[deadId];
      delete state.research.byTeam[TeamType.Enemy].activeByBuildingId[deadId];
      delete state.research.byTeam[TeamType.Neutral].activeByBuildingId[deadId];
      delete state.visibility.enemyMemories[deadId];
      this.registry.unregister(deadId);
    }

    state.entities.allIds = state.entities.allIds.filter((id) => !deadIds.includes(id));
    this.syncEconomyDerivedState(state);
  }

  private syncEconomyDerivedState(state: GameState): void {
    for (const team of [TeamType.Player, TeamType.Enemy, TeamType.Neutral]) {
      state.economy.byTeam[team].supplyUsed = 0;
      state.economy.byTeam[team].supplyCap = 0;
    }

    for (const id of state.entities.allIds) {
      const entity = state.entities.byId[id];
      if (!entity?.alive) {
        continue;
      }

      const rule = ContentRegistry.getRule(entity.configKey);
      if (entity.category === 'unit') {
        state.economy.byTeam[entity.team].supplyUsed += rule.resourceCost.supply;
      }

      if (entity.category === 'building' && entity.built) {
        state.economy.byTeam[entity.team].supplyCap += rule.providesSupplyCap;
      }
    }
  }

  private updateFeedback(state: GameState, dt: number): void {
    state.orders.markers = state.orders.markers
      .map((marker) => ({ ...marker, ttl: marker.ttl - dt }))
      .filter((marker) => marker.ttl > 0);

    for (const id of state.entities.allIds) {
      const entity = state.entities.byId[id];
      if (!entity?.alive) {
        continue;
      }
      entity.recentDamageSeconds = Math.max(0, entity.recentDamageSeconds - dt);
    }
  }

  private pushNotification(state: GameState, message: string): void {
    state.orders.notifications.push(message);
    state.session.message = message;
    if (state.orders.notifications.length > 8) {
      state.orders.notifications.shift();
    }
  }

  private addMarker(state: GameState, kind: FeedbackMarkerState['kind'], position: Vec3State): void {
    this.markerCounter += 1;
    state.orders.markers.push({
      id: `marker-${this.markerCounter}`,
      kind,
      position: { ...position },
      ttl: kind === 'attackMove' || kind === 'patrol' ? 0.85 : 0.55
    });
  }

  private getEntityLabel(entity: EntitySnapshot): string {
    switch (entity.kind) {
      case 'mainBase':
        return entity.team === TeamType.Player ? '我方主基地' : '敌方主基地';
      case 'resourceDropoff':
        return '回收站';
      case 'barracks':
        return '兵营';
      case 'vehicleFactory':
        return '载具工厂';
      case 'powerPlant':
        return '电站';
      case 'supplyDepot':
        return '补给站';
      case 'defenseTower':
        return '防御塔';
      case 'techLab':
        return '科技中心';
      case 'worker':
        return '工程单位';
      case 'scout':
        return '侦察车';
      case 'infantry':
        return '步兵';
      case 'lancer':
        return '反甲步兵';
      case 'tank':
        return '前线坦克';
      case 'artillery':
        return '远程火炮';
      case 'resourceNode':
        return '资源点';
      default:
        return entity.kind;
    }
  }
}
