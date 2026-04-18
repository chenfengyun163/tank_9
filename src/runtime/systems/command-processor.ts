import { APP_CONFIG } from '../../core/config';
import { BUILDABLE_BUILDINGS, ContentRegistry, UNIT_CONFIG_BY_KIND } from '../../core/content-registry';
import type {
  BuildMode,
  EntitySnapshot,
  FeedbackMarkerState,
  GameState,
  OrderState,
  ProductionKind,
  TechnologyId,
  Vec3State
} from '../../core/game-state';
import { getAvailableSupply, spendResourceCost } from '../../core/game-state';
import { getAffordableReason, getBuildAvailability, getProduceAvailability, getTechnologyAvailability } from '../../core/unlock-rules';
import type { GameCommand } from '../../core/command-types';
import { TeamType } from '../../core/team-type';

export interface CommandProcessorDependencies {
  spawnEntity: (state: GameState, configKey: string, team: TeamType, position: Vec3State, built: boolean) => string;
  pushNotification: (state: GameState, message: string) => void;
  isPlacementValid: (state: GameState, position: Vec3State, configKey: string) => boolean;
  addMarker: (state: GameState, kind: FeedbackMarkerState['kind'], position: Vec3State) => void;
}

export interface CommandProcessorResult {
  shouldStart: boolean;
  shouldRestart: boolean;
}

export class CommandProcessor {
  public constructor(private readonly deps: CommandProcessorDependencies) {}

  public processCommands(state: GameState, commandQueue: GameCommand[]): CommandProcessorResult {
    let shouldStart = false;
    let shouldRestart = false;

    while (commandQueue.length > 0) {
      const command = commandQueue.shift();
      if (!command) {
        break;
      }

      if (command.type === 'start') {
        shouldStart = state.session.phase === 'boot';
        continue;
      }

      if (command.type === 'restart') {
        shouldRestart = true;
        continue;
      }

      if (command.type === 'toggleVisionDebug') {
        state.visibility.debugShowRanges = !state.visibility.debugShowRanges;
        this.deps.pushNotification(state, state.visibility.debugShowRanges ? '已开启视野调试显示。' : '已关闭视野调试显示。');
        continue;
      }

      if (state.session.phase !== 'playing') {
        continue;
      }

      switch (command.type) {
        case 'select':
          this.handleSelect(state, command.entityIds);
          break;
        case 'assignControlGroup':
          this.handleAssignControlGroup(state, command.groupIndex, command.entityIds);
          break;
        case 'recallControlGroup':
          this.handleRecallControlGroup(state, command.groupIndex);
          break;
        case 'move':
          this.handleMove(state, command.entityIds, command.target, command.queue ?? false);
          break;
        case 'attack':
          this.handleAttack(state, command.entityIds, command.targetEntityId, command.queue ?? false);
          break;
        case 'attackMove':
          this.handleAttackMove(state, command.entityIds, command.target, command.queue ?? false);
          break;
        case 'patrol':
          this.handlePatrol(state, command.entityIds, command.target, command.queue ?? false);
          break;
        case 'holdPosition':
          this.handleHoldPosition(state, command.entityIds);
          break;
        case 'stop':
          this.handleStop(state, command.entityIds);
          break;
        case 'gather':
          this.handleGather(state, command.entityIds, command.targetEntityId, command.queue ?? false);
          break;
        case 'repair':
          this.handleRepair(state, command.entityIds, command.targetEntityId);
          break;
        case 'build':
          this.handleBuild(state, command.entityIds, command.buildingConfigKey, command.target);
          break;
        case 'produce':
          this.handleProduce(state, command.buildingId, command.unitKind);
          break;
        case 'research':
          this.handleResearch(state, command.buildingId, command.techId);
          break;
        case 'setRallyPoint':
          this.handleSetRallyPoint(state, command.buildingId, command.target);
          break;
      }
    }

    return { shouldStart, shouldRestart };
  }

  private handleSelect(state: GameState, entityIds: string[]): void {
    state.selection.selectedIds = entityIds.filter((entityId) => {
      const entity = state.entities.byId[entityId];
      return Boolean(entity?.alive && entity.team === TeamType.Player);
    });

    if (
      state.orders.buildMode !== 'none'
      && state.selection.selectedIds.some((id) => state.entities.byId[id]?.kind !== 'worker')
    ) {
      state.orders.buildMode = 'none';
    }
  }

  private handleAssignControlGroup(state: GameState, groupIndex: number, entityIds: string[]): void {
    const validIds = entityIds.filter((entityId) => {
      const entity = state.entities.byId[entityId];
      return Boolean(entity?.alive && entity.team === TeamType.Player);
    });
    state.controlGroups.groups[groupIndex] = validIds;
    state.controlGroups.lastSelectedGroup = groupIndex;
    this.deps.pushNotification(state, `已将 ${validIds.length} 个单位编入 ${groupIndex} 队。`);
  }

  private handleRecallControlGroup(state: GameState, groupIndex: number): void {
    const validIds = (state.controlGroups.groups[groupIndex] ?? []).filter((entityId) => {
      const entity = state.entities.byId[entityId];
      return Boolean(entity?.alive && entity.team === TeamType.Player);
    });
    state.controlGroups.groups[groupIndex] = validIds;
    state.controlGroups.lastSelectedGroup = groupIndex;
    state.selection.selectedIds = validIds;
  }

  private handleMove(state: GameState, entityIds: string[], target: Vec3State, queue: boolean): void {
    const movable = entityIds
      .map((id) => state.entities.byId[id])
      .filter((entity): entity is EntitySnapshot => Boolean(entity?.alive && entity.speed > 0));
    const formationTargets = this.getFormationTargets(movable, target);
    movable.forEach((entity, index) => this.applyOrder(entity, { type: 'move', targetPosition: formationTargets[index] }, queue));
    this.deps.addMarker(state, 'move', target);
  }

  private handleAttack(state: GameState, entityIds: string[], targetEntityId: string, queue: boolean): void {
    const target = state.entities.byId[targetEntityId];
    if (!target?.alive) {
      return;
    }

    for (const id of entityIds) {
      const entity = state.entities.byId[id];
      if (entity?.alive && entity.attackDamage > 0) {
        this.applyOrder(entity, { type: 'attack', targetEntityId }, queue);
      }
    }

    this.deps.addMarker(state, 'attack', target.position);
  }

  private handleAttackMove(state: GameState, entityIds: string[], target: Vec3State, queue: boolean): void {
    const movable = entityIds
      .map((id) => state.entities.byId[id])
      .filter((entity): entity is EntitySnapshot => Boolean(entity?.alive && entity.speed > 0 && entity.attackDamage > 0));
    const formationTargets = this.getFormationTargets(movable, target);
    movable.forEach((entity, index) => this.applyOrder(entity, { type: 'attack-move', targetPosition: formationTargets[index] }, queue));
    state.orders.commandMode = 'none';
    this.deps.addMarker(state, 'attackMove', target);
  }

  private handlePatrol(state: GameState, entityIds: string[], target: Vec3State, queue: boolean): void {
    const movable = entityIds
      .map((id) => state.entities.byId[id])
      .filter((entity): entity is EntitySnapshot => Boolean(entity?.alive && entity.speed > 0));
    movable.forEach((entity) => {
      const loopOrigin = queue ? this.inferQueuedPatrolOrigin(entity) : { ...entity.position };
      this.applyOrder(entity, {
        type: 'patrol',
        path: [{ ...loopOrigin }, { ...target }],
        segmentIndex: 1,
        loopOrigin
      }, queue);
    });
    state.orders.commandMode = 'none';
    this.deps.addMarker(state, 'patrol', target);
  }

  private handleHoldPosition(state: GameState, entityIds: string[]): void {
    for (const id of entityIds) {
      const entity = state.entities.byId[id];
      if (entity?.alive && entity.category === 'unit') {
        entity.order = {
          type: 'hold',
          anchorPosition: { ...entity.position },
          chaseRadius: APP_CONFIG.gameplay.holdPositionChaseRadius
        };
        entity.orderQueue = [];
      }
    }
    this.deps.addMarker(state, 'hold', this.getCenterPoint(state, entityIds));
    this.deps.pushNotification(state, '部队已执行原地警戒。');
  }

  private handleStop(state: GameState, entityIds: string[]): void {
    for (const id of entityIds) {
      const entity = state.entities.byId[id];
      if (entity?.alive && entity.category === 'unit') {
        entity.order = { type: 'idle' };
        entity.orderQueue = [];
      }
    }
    this.deps.addMarker(state, 'stop', this.getCenterPoint(state, entityIds));
    this.deps.pushNotification(state, '部队已停止当前命令。');
  }

  private handleGather(state: GameState, entityIds: string[], targetEntityId: string, queue: boolean): void {
    const target = state.entities.byId[targetEntityId];
    if (!target?.alive || target.category !== 'resource') {
      return;
    }
    for (const id of entityIds) {
      const entity = state.entities.byId[id];
      if (entity?.alive && entity.kind === 'worker') {
        this.applyOrder(entity, { type: 'gather', targetEntityId }, queue);
      }
    }
    this.deps.addMarker(state, 'gather', target.position);
  }

  private handleRepair(state: GameState, entityIds: string[], targetEntityId: string): void {
    const target = state.entities.byId[targetEntityId];
    if (!target?.alive || target.team === TeamType.Neutral) {
      return;
    }
    const builders = entityIds
      .map((id) => state.entities.byId[id])
      .filter((entity): entity is EntitySnapshot => Boolean(entity?.alive && entity.kind === 'worker' && entity.team === target.team));
    if (builders.length === 0) {
      return;
    }
    builders.forEach((builder) => {
      builder.order = { type: 'repair', targetEntityId };
      builder.orderQueue = [];
    });
    this.deps.addMarker(state, 'repair', target.position);
    this.deps.pushNotification(state, `工程单位开始修理${this.getEntityLabel(target.kind)}。`);
  }

  private handleBuild(state: GameState, entityIds: string[], configKey: Exclude<BuildMode, 'none'>, target: Vec3State): void {
    const builders = entityIds
      .map((id) => state.entities.byId[id])
      .filter((entity): entity is EntitySnapshot => Boolean(entity?.alive && entity.kind === 'worker'));
    if (builders.length === 0) {
      this.deps.pushNotification(state, '请先选择至少一名工程单位。');
      return;
    }

    const team = builders[0].team;
    if (!BUILDABLE_BUILDINGS.includes(configKey)) {
      this.deps.pushNotification(state, '该建筑当前无法放置。');
      return;
    }

    const availability = getBuildAvailability(state, team, configKey);
    if (availability.reason) {
      this.deps.pushNotification(state, availability.reason);
      return;
    }

    const rule = ContentRegistry.getRule(configKey);
    const costReason = getAffordableReason(state, team, rule.resourceCost, false);
    if (costReason) {
      this.deps.pushNotification(state, costReason);
      return;
    }

    if (!this.deps.isPlacementValid(state, target, configKey)) {
      this.deps.pushNotification(state, `${rule.label}无法放置在这里。`);
      return;
    }

    if (!spendResourceCost(state, team, rule.resourceCost)) {
      this.deps.pushNotification(state, '资源不足，无法开始建造。');
      return;
    }

    const buildingId = this.deps.spawnEntity(state, configKey, team, target, false);
    const building = state.entities.byId[buildingId];
    if (building) {
      building.assignedBuilderIds = builders.map((builder) => builder.id);
    }
    builders.forEach((builder) => {
      builder.order = { type: 'construct', targetEntityId: buildingId };
      builder.orderQueue = [];
    });

    state.orders.buildMode = 'none';
    this.deps.pushNotification(state, `${rule.label}开始建造。`);
    this.deps.addMarker(state, 'build', target);
  }

  private handleProduce(state: GameState, buildingId: string, unitKind: ProductionKind): void {
    const building = state.entities.byId[buildingId];
    if (!building?.alive || !building.built) {
      return;
    }

    const availability = getProduceAvailability(state, building.team, building, unitKind);
    if (availability.reason) {
      this.deps.pushNotification(state, availability.reason);
      return;
    }

    const queue = state.production.queuesByEntityId[buildingId] ?? [];
    if (queue.length >= APP_CONFIG.gameplay.queueLimitPerBuilding) {
      this.deps.pushNotification(state, '生产队列已满。');
      return;
    }

    const unitConfigKey = UNIT_CONFIG_BY_KIND[unitKind];
    const rule = ContentRegistry.getRule(unitConfigKey);
    const costReason = getAffordableReason(state, building.team, rule.resourceCost);
    if (costReason) {
      this.deps.pushNotification(state, costReason);
      return;
    }

    if (!spendResourceCost(state, building.team, rule.resourceCost)) {
      this.deps.pushNotification(state, '资源不足，无法开始生产。');
      return;
    }

    queue.push({ kind: unitKind, totalTime: rule.buildTime, remainingTime: rule.buildTime });
    state.production.queuesByEntityId[buildingId] = queue;
    this.deps.pushNotification(state, `${rule.label}开始生产。`);
  }

  private handleResearch(state: GameState, buildingId: string, techId: TechnologyId): void {
    const building = state.entities.byId[buildingId];
    if (!building?.alive || !building.built || !(building.researchKinds ?? []).includes(techId)) {
      return;
    }

    const availability = getTechnologyAvailability(state, building.team, techId);
    if (availability.reason) {
      this.deps.pushNotification(state, availability.reason);
      return;
    }

    const activeResearch = state.research.byTeam[building.team].activeByBuildingId[buildingId];
    if (activeResearch) {
      this.deps.pushNotification(state, '该建筑正在研究中。');
      return;
    }

    const tech = ContentRegistry.getTechnology(techId);
    const costReason = getAffordableReason(state, building.team, tech.cost, false);
    if (costReason) {
      this.deps.pushNotification(state, costReason);
      return;
    }

    if (!spendResourceCost(state, building.team, tech.cost)) {
      this.deps.pushNotification(state, '资源不足，无法开始研究。');
      return;
    }

    state.research.byTeam[building.team].activeByBuildingId[buildingId] = {
      techId,
      buildingId,
      totalTime: tech.researchTime,
      remainingTime: tech.researchTime
    };
    this.deps.addMarker(state, 'research', building.position);
    this.deps.pushNotification(state, `${tech.name}开始研究。`);
  }

  private handleSetRallyPoint(state: GameState, buildingId: string, target: Vec3State): void {
    const building = state.entities.byId[buildingId];
    if (!building?.alive || building.category !== 'building' || building.productionKinds.length === 0) {
      this.deps.pushNotification(state, '请先选择一个可生产的建筑。');
      return;
    }

    building.rallyPoint = { ...target };
    state.orders.commandMode = 'none';
    this.deps.pushNotification(state, '集合点已更新。');
    this.deps.addMarker(state, 'rally', target);
  }

  private applyOrder(entity: EntitySnapshot, order: OrderState, queue: boolean): void {
    entity.orderQueue ??= [];
    if (queue && entity.order.type !== 'idle') {
      entity.orderQueue.push(order);
      return;
    }
    entity.order = order;
    entity.orderQueue = [];
  }

  private inferQueuedPatrolOrigin(entity: EntitySnapshot): Vec3State {
    const queuedTail = entity.orderQueue.at(-1);
    const candidate = queuedTail ?? entity.order;
    return this.getOrderTerminalPosition(candidate) ?? { ...entity.position };
  }

  private getOrderTerminalPosition(order: OrderState): Vec3State | null {
    switch (order.type) {
      case 'move':
      case 'attack-move':
        return { ...order.targetPosition };
      case 'hold':
        return { ...order.anchorPosition };
      case 'patrol':
        return order.loopOrigin ? { ...order.loopOrigin } : { ...order.path[0] };
      default:
        return null;
    }
  }

  private getFormationTargets(entities: EntitySnapshot[], target: Vec3State): Vec3State[] {
    if (entities.length <= 1) {
      return [{ ...target }];
    }
    const spacing = APP_CONFIG.gameplay.formationSpacing;
    const columns = Math.ceil(Math.sqrt(entities.length));
    return entities.map((entity, index) => {
      const row = Math.floor(index / columns);
      const column = index % columns;
      const offsetX = (column - (columns - 1) * 0.5) * spacing;
      const offsetZ = (row - (Math.ceil(entities.length / columns) - 1) * 0.5) * spacing;
      entity.formationSlot = index;
      entity.formationTarget = { x: target.x + offsetX, y: target.y, z: target.z + offsetZ };
      return entity.formationTarget;
    });
  }

  private getCenterPoint(state: GameState, entityIds: string[]): Vec3State {
    const entities = entityIds
      .map((id) => state.entities.byId[id])
      .filter((entity): entity is EntitySnapshot => Boolean(entity?.alive));
    if (entities.length === 0) {
      return { x: 0, y: 0, z: 0 };
    }
    const center = entities.reduce((sum, entity) => ({
      x: sum.x + entity.position.x,
      y: 0,
      z: sum.z + entity.position.z
    }), { x: 0, y: 0, z: 0 });
    return { x: center.x / entities.length, y: 0, z: center.z / entities.length };
  }

  private getEntityLabel(kind: EntitySnapshot['kind']): string {
    switch (kind) {
      case 'worker': return '工程单位';
      case 'scout': return '侦察车';
      case 'infantry': return '步兵';
      case 'lancer': return '反甲步兵';
      case 'tank': return '前线坦克';
      case 'artillery': return '远程火炮';
      case 'mainBase': return '主基地';
      case 'resourceDropoff': return '回收站';
      case 'barracks': return '兵营';
      case 'vehicleFactory': return '载具工厂';
      case 'powerPlant': return '电站';
      case 'supplyDepot': return '补给站';
      case 'defenseTower': return '防御塔';
      case 'techLab': return '科技中心';
      case 'resourceNode': return '资源点';
      default: return kind;
    }
  }
}
