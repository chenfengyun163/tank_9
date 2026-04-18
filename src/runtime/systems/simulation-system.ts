import { APP_CONFIG } from '../../core/config';
import { ContentRegistry, UNIT_CONFIG_BY_KIND } from '../../core/content-registry';
import type { EntitySnapshot, FeedbackMarkerState, GameState, Vec3State } from '../../core/game-state';
import { TeamType } from '../../core/team-type';
import { getTeamModifiers } from '../../core/unlock-rules';

const RAD_TO_DEG = 180 / Math.PI;

export interface SimulationSystemDependencies {
  spawnEntity: (state: GameState, configKey: string, team: TeamType, position: Vec3State, built: boolean) => string;
  pushNotification: (state: GameState, message: string) => void;
  applyDamage: (state: GameState, targetId: string, amount: number) => void;
  addMarker: (state: GameState, kind: FeedbackMarkerState['kind'], position: Vec3State) => void;
}

export class SimulationSystem {
  public constructor(private readonly deps: SimulationSystemDependencies) {}

  public update(state: GameState, dt: number): void {
    if (state.session.phase !== 'playing') {
      return;
    }

    this.updatePassiveIncome(state, dt);
    this.updateResearch(state, dt);
    this.applyTechnologyModifiers(state);
    this.updateConstruction(state, dt);
    this.updateProduction(state, dt);
    this.updateEntities(state, dt);
    this.updateDefensiveBuildings(state, dt);
    this.resolveUnitSeparation(state);
  }

  private updatePassiveIncome(state: GameState, dt: number): void {
    for (const team of [TeamType.Player, TeamType.Enemy]) {
      state.economy.byTeam[team].manpower += APP_CONFIG.economy.incomePerSecond.manpower * dt;
      state.economy.byTeam[team].power += APP_CONFIG.economy.incomePerSecond.power * dt;
    }

    for (const id of state.entities.allIds) {
      const entity = state.entities.byId[id];
      if (!entity?.alive || !entity.built || entity.category !== 'building') {
        continue;
      }

      const income = ContentRegistry.getRule(entity.configKey).passiveIncome;
      if (!income) {
        continue;
      }

      const economy = state.economy.byTeam[entity.team];
      economy.manpower += (income.manpower ?? 0) * dt;
      economy.power += (income.power ?? 0) * dt;
    }
  }

  private updateResearch(state: GameState, dt: number): void {
    for (const team of [TeamType.Player, TeamType.Enemy]) {
      const activeResearch = state.research.byTeam[team].activeByBuildingId;
      for (const [buildingId, item] of Object.entries(activeResearch)) {
        const building = state.entities.byId[buildingId];
        if (!building?.alive || !building.built) {
          delete activeResearch[buildingId];
          continue;
        }

        const modifiers = getTeamModifiers(state, team);
        item.remainingTime -= dt * modifiers.productionSpeedMultiplier;
        if (item.remainingTime > 0) {
          continue;
        }

        delete activeResearch[buildingId];
        if (!state.research.byTeam[team].completedIds.includes(item.techId)) {
          state.research.byTeam[team].completedIds.push(item.techId);
        }

        const tech = ContentRegistry.getTechnology(item.techId);
        for (const effect of tech.effects) {
          if (effect.type === 'phaseUpgrade' && effect.tier) {
            state.research.byTeam[team].tier = effect.tier;
          }
        }

        this.deps.addMarker(state, 'research', building.position);
        this.deps.pushNotification(state, `${tech.name}研究完成。`);
      }
    }
  }

  private applyTechnologyModifiers(state: GameState): void {
    for (const id of state.entities.allIds) {
      const entity = state.entities.byId[id];
      if (!entity?.alive) {
        continue;
      }

      const modifiers = getTeamModifiers(state, entity.team);
      entity.attackDamage = entity.baseAttackDamage + (modifiers.damageBonusByConfig[entity.configKey] ?? 0);
      entity.attackRange = entity.baseAttackRange + (modifiers.rangeBonusByConfig[entity.configKey] ?? 0);
      entity.sightRange = entity.baseSightRange + (modifiers.sightBonusByConfig[entity.configKey] ?? 0);
      entity.armor = entity.baseArmor + (modifiers.armorBonusByConfig[entity.configKey] ?? 0);
      entity.gatherRate = entity.baseGatherRate * modifiers.gatherMultiplier;
    }
  }

  private updateConstruction(state: GameState, dt: number): void {
    for (const id of state.entities.allIds) {
      const entity = state.entities.byId[id];
      if (!entity?.alive || entity.built || entity.category !== 'building' || entity.buildTime <= 0) {
        continue;
      }

      const builders = (entity.assignedBuilderIds ?? [])
        .map((builderId) => state.entities.byId[builderId])
        .filter((builder): builder is EntitySnapshot => Boolean(
          builder?.alive
          && builder.kind === 'worker'
          && builder.order.type === 'construct'
          && this.distanceXZ(builder.position, entity.position) <= APP_CONFIG.gameplay.constructRange + entity.selectionRadius
        ));

      if (builders.length === 0) {
        continue;
      }

      entity.buildProgress += dt * builders.length;
      entity.hp = Math.max(1, Math.round((entity.buildProgress / entity.buildTime) * entity.maxHp));
      if (entity.buildProgress < entity.buildTime) {
        continue;
      }

      entity.buildProgress = entity.buildTime;
      entity.hp = entity.maxHp;
      entity.built = true;
      entity.assignedBuilderIds = [];
      this.deps.pushNotification(state, `${this.getEntityLabel(entity.kind)}建造完成。`);

      builders.forEach((builder) => {
        if (builder.order.type === 'construct' && builder.order.targetEntityId === entity.id) {
          this.advanceOrderQueue(builder);
        }
      });
    }
  }

  private updateProduction(state: GameState, dt: number): void {
    for (const [buildingId, queue] of Object.entries(state.production.queuesByEntityId)) {
      const building = state.entities.byId[buildingId];
      if (!building?.alive || !building.built || queue.length === 0) {
        continue;
      }

      const modifiers = getTeamModifiers(state, building.team);
      queue[0].remainingTime -= dt * modifiers.productionSpeedMultiplier;
      if (queue[0].remainingTime > 0) {
        continue;
      }

      const item = queue.shift();
      if (!item) {
        continue;
      }

      const spawnOffset = item.kind === 'worker'
        ? { x: 2.8, y: 0, z: 1.8 }
        : item.kind === 'tank' || item.kind === 'artillery'
          ? { x: 4.6, y: 0, z: -2.4 }
          : { x: 3.2, y: 0, z: -1.8 };
      const spawnedId = this.deps.spawnEntity(state, UNIT_CONFIG_BY_KIND[item.kind], building.team, {
        x: building.position.x + spawnOffset.x,
        y: 0,
        z: building.position.z + spawnOffset.z
      }, true);
      const spawned = state.entities.byId[spawnedId];

      if (spawned && building.rallyPoint) {
        spawned.order = { type: 'move', targetPosition: { ...building.rallyPoint } };
        this.deps.addMarker(state, 'rally', building.rallyPoint);
      }

      this.deps.pushNotification(state, `${ContentRegistry.getRule(UNIT_CONFIG_BY_KIND[item.kind]).label}生产完成。`);
    }
  }

  private updateEntities(state: GameState, dt: number): void {
    for (const id of state.entities.allIds) {
      const entity = state.entities.byId[id];
      if (!entity?.alive) {
        continue;
      }

      entity.attackCooldownRemaining = Math.max(0, entity.attackCooldownRemaining - dt);
      if (!entity.built || entity.category !== 'unit') {
        continue;
      }

      switch (entity.order.type) {
        case 'move':
          if (this.moveTowards(state, entity, entity.order.targetPosition, dt, 0.15)) {
            this.advanceOrderQueue(entity);
          }
          break;
        case 'hold':
          this.updateHoldOrder(state, entity, dt);
          break;
        case 'attack':
          this.updateAttackOrder(state, entity, dt);
          break;
        case 'attack-move':
          this.updateAttackMoveOrder(state, entity, dt);
          break;
        case 'patrol':
          this.updatePatrolOrder(state, entity, dt);
          break;
        case 'gather':
          this.updateGatherOrder(state, entity, dt);
          break;
        case 'return-resource':
          this.updateReturnOrder(state, entity, dt);
          break;
        case 'construct':
          this.updateConstructOrder(state, entity, dt);
          break;
        case 'repair':
          this.updateRepairOrder(state, entity, dt);
          break;
        case 'idle':
          this.advanceOrderQueue(entity);
          break;
      }
    }
  }

  private updateHoldOrder(state: GameState, entity: EntitySnapshot, dt: number): void {
    if (entity.order.type !== 'hold') {
      return;
    }
    const target = this.findNearestEnemy(state, entity, entity.sightRange);
    if (!target?.alive) {
      if (this.distanceXZ(entity.position, entity.order.anchorPosition) > 0.15) {
        this.moveTowards(state, entity, entity.order.anchorPosition, dt, 0.1);
      }
      return;
    }
    if (this.distanceXZ(entity.position, entity.order.anchorPosition) > entity.order.chaseRadius) {
      this.moveTowards(state, entity, entity.order.anchorPosition, dt, 0.1);
      return;
    }
    this.resolveCombatEngagement(state, entity, target, dt);
  }

  private updateAttackOrder(state: GameState, entity: EntitySnapshot, dt: number): void {
    if (entity.order.type !== 'attack') {
      return;
    }
    const target = state.entities.byId[entity.order.targetEntityId];
    if (!target?.alive) {
      this.advanceOrderQueue(entity);
      return;
    }
    this.resolveCombatEngagement(state, entity, target, dt);
  }

  private updateAttackMoveOrder(state: GameState, entity: EntitySnapshot, dt: number): void {
    if (entity.order.type !== 'attack-move') {
      return;
    }
    const target = entity.order.targetEntityId
      ? state.entities.byId[entity.order.targetEntityId]
      : this.findNearestEnemy(state, entity, APP_CONFIG.gameplay.attackMoveAcquireRadius);
    if (target?.alive) {
      entity.order.targetEntityId = target.id;
      this.resolveCombatEngagement(state, entity, target, dt);
      return;
    }
    entity.order.targetEntityId = undefined;
    if (this.moveTowards(state, entity, entity.order.targetPosition, dt, 0.25)) {
      this.advanceOrderQueue(entity);
    }
  }

  private updatePatrolOrder(state: GameState, entity: EntitySnapshot, dt: number): void {
    if (entity.order.type !== 'patrol') {
      return;
    }

    entity.order.loopOrigin ??= { ...entity.order.path[0] };
    entity.order.path[0] = { ...entity.order.loopOrigin };
    const target = entity.order.targetEntityId
      ? state.entities.byId[entity.order.targetEntityId]
      : this.findNearestEnemy(state, entity, APP_CONFIG.gameplay.patrolAcquireRadius);
    if (target?.alive) {
      entity.order.targetEntityId = target.id;
      this.resolveCombatEngagement(state, entity, target, dt);
      return;
    }
    entity.order.targetEntityId = undefined;
    const patrolTarget = entity.order.path[entity.order.segmentIndex];
    if (this.moveTowards(state, entity, patrolTarget, dt, 0.3)) {
      entity.order.segmentIndex = entity.order.segmentIndex === 0 ? 1 : 0;
    }
  }

  private updateGatherOrder(state: GameState, entity: EntitySnapshot, dt: number): void {
    if (entity.order.type !== 'gather') {
      return;
    }
    const target = state.entities.byId[entity.order.targetEntityId];
    if (!target?.alive || target.category !== 'resource' || target.resourceAmount <= 0) {
      this.advanceOrderQueue(entity);
      return;
    }
    if (entity.carryAmount >= entity.carryCapacity) {
      this.transitionToReturn(state, entity, target.id);
      return;
    }
    const gatherDistance = entity.selectionRadius + target.selectionRadius + 0.2;
    if (this.distanceXZ(entity.position, target.position) > gatherDistance) {
      this.moveTowards(state, entity, target.position, dt, gatherDistance - 0.05);
      return;
    }
    const gathered = Math.min(entity.gatherRate * dt, entity.carryCapacity - entity.carryAmount, target.resourceAmount);
    entity.carryAmount += gathered;
    entity.carryResourceType = target.resourceType ?? 'manpower';
    target.resourceAmount -= gathered;
    if (entity.carryAmount >= entity.carryCapacity || target.resourceAmount <= 0) {
      this.transitionToReturn(state, entity, target.resourceAmount > 0 ? target.id : undefined);
    }
  }

  private updateConstructOrder(state: GameState, entity: EntitySnapshot, dt: number): void {
    if (entity.order.type !== 'construct') {
      return;
    }
    const target = state.entities.byId[entity.order.targetEntityId];
    if (!target?.alive || target.built || target.category !== 'building') {
      this.advanceOrderQueue(entity);
      return;
    }
    target.assignedBuilderIds ??= [];
    if (!target.assignedBuilderIds.includes(entity.id)) {
      target.assignedBuilderIds.push(entity.id);
    }
    const buildDistance = APP_CONFIG.gameplay.constructRange + target.selectionRadius;
    if (this.distanceXZ(entity.position, target.position) > buildDistance) {
      this.moveTowards(state, entity, target.position, dt, buildDistance - 0.2);
    }
  }

  private updateRepairOrder(state: GameState, entity: EntitySnapshot, dt: number): void {
    if (entity.order.type !== 'repair') {
      return;
    }
    const target = state.entities.byId[entity.order.targetEntityId];
    if (!target?.alive || target.team !== entity.team || target.hp >= target.maxHp) {
      this.advanceOrderQueue(entity);
      return;
    }
    const repairDistance = APP_CONFIG.gameplay.repairRange + target.selectionRadius;
    if (this.distanceXZ(entity.position, target.position) > repairDistance) {
      this.moveTowards(state, entity, target.position, dt, repairDistance - 0.15);
      return;
    }
    target.hp = Math.min(target.maxHp, target.hp + APP_CONFIG.gameplay.workerRepairRate * dt);
    if (target.hp >= target.maxHp) {
      this.advanceOrderQueue(entity);
    }
  }

  private transitionToReturn(state: GameState, entity: EntitySnapshot, followUpId?: string): void {
    const dropOff = this.findNearestDropOff(state, entity.team, entity.position);
    if (!dropOff) {
      entity.order = { type: 'idle' };
      return;
    }
    entity.order = { type: 'return-resource', targetEntityId: dropOff.id, followUpTargetId: followUpId };
  }

  private updateReturnOrder(state: GameState, entity: EntitySnapshot, dt: number): void {
    if (entity.order.type !== 'return-resource') {
      return;
    }
    const target = state.entities.byId[entity.order.targetEntityId];
    if (!target?.alive) {
      entity.order = { type: 'idle' };
      return;
    }
    const dropDistance = entity.selectionRadius + target.selectionRadius + 0.25;
    if (this.distanceXZ(entity.position, target.position) > dropDistance) {
      this.moveTowards(state, entity, target.position, dt, dropDistance - 0.1);
      return;
    }

    const resourceType = entity.carryResourceType ?? 'manpower';
    state.economy.byTeam[entity.team][resourceType] += entity.carryAmount;
    this.deps.addMarker(state, 'gather', target.position);
    entity.carryAmount = 0;
    entity.carryResourceType = null;

    if (entity.order.followUpTargetId) {
      const next = state.entities.byId[entity.order.followUpTargetId];
      if (next?.alive && next.resourceAmount > 0) {
        entity.order = { type: 'gather', targetEntityId: next.id };
        return;
      }
    }
    this.advanceOrderQueue(entity);
  }

  private updateDefensiveBuildings(state: GameState, dt: number): void {
    for (const id of state.entities.allIds) {
      const entity = state.entities.byId[id];
      if (!entity?.alive || !entity.built || entity.category !== 'building' || entity.attackDamage <= 0) {
        continue;
      }
      entity.attackCooldownRemaining = Math.max(0, entity.attackCooldownRemaining - dt);
      const target = this.findNearestEnemy(state, entity, entity.attackRange);
      if (target && entity.attackCooldownRemaining <= 0) {
        entity.attackCooldownRemaining = entity.attackCooldown;
        this.deps.applyDamage(state, target.id, Math.max(1, entity.attackDamage - target.armor));
      }
    }
  }

  private resolveCombatEngagement(state: GameState, entity: EntitySnapshot, target: EntitySnapshot, dt: number): void {
    const stopDistance = entity.engagementProfile === 'melee' ? 0.4 : Math.max(0.55, entity.attackRange * 0.85);
    if (this.distanceXZ(entity.position, target.position) > entity.attackRange) {
      this.moveTowards(state, entity, target.position, dt, stopDistance);
      return;
    }
    if (entity.attackCooldownRemaining <= 0) {
      entity.attackCooldownRemaining = entity.attackCooldown;
      this.deps.applyDamage(state, target.id, Math.max(1, entity.attackDamage - target.armor));
    }
  }

  private moveTowards(state: GameState, entity: EntitySnapshot, target: Vec3State, dt: number, stopDistance: number): boolean {
    const dx = target.x - entity.position.x;
    const dz = target.z - entity.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance <= stopDistance) {
      return true;
    }
    const desiredX = dx / distance;
    const desiredZ = dz / distance;
    const steering = this.getSteeringVector(state, entity, target, desiredX, desiredZ);
    const steeringLength = Math.hypot(steering.x, steering.z) || 1;
    const step = Math.min(entity.speed * dt, distance - stopDistance);
    entity.position.x += (steering.x / steeringLength) * step;
    entity.position.z += (steering.z / steeringLength) * step;
    entity.rotationY = Math.atan2(steering.x, steering.z) * RAD_TO_DEG;
    return this.distanceXZ(entity.position, target) <= stopDistance;
  }

  private getSteeringVector(state: GameState, entity: EntitySnapshot, target: Vec3State, desiredX: number, desiredZ: number): { x: number; z: number } {
    let steerX = desiredX;
    let steerZ = desiredZ;
    for (const otherId of state.entities.allIds) {
      const other = state.entities.byId[otherId];
      if (!other?.alive || other.id === entity.id) {
        continue;
      }
      const dx = entity.position.x - other.position.x;
      const dz = entity.position.z - other.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance === 0) {
        steerX += 0.1;
        steerZ += 0.1;
        continue;
      }
      const isStaticObstacle = other.category !== 'unit';
      const radius = isStaticObstacle ? APP_CONFIG.gameplay.staticObstacleAvoidanceRadius : APP_CONFIG.gameplay.localAvoidanceRadius;
      if (distance >= radius) {
        continue;
      }
      const strength = isStaticObstacle ? APP_CONFIG.gameplay.staticObstacleAvoidanceStrength : APP_CONFIG.gameplay.localAvoidanceStrength;
      const falloff = (radius - distance) / radius;
      steerX += (dx / distance) * falloff * strength;
      steerZ += (dz / distance) * falloff * strength;
    }
    const targetBiasX = target.x - entity.position.x;
    const targetBiasZ = target.z - entity.position.z;
    const targetBiasLength = Math.hypot(targetBiasX, targetBiasZ) || 1;
    steerX += (targetBiasX / targetBiasLength) * 0.25;
    steerZ += (targetBiasZ / targetBiasLength) * 0.25;
    return { x: steerX, z: steerZ };
  }

  private resolveUnitSeparation(state: GameState): void {
    const units = state.entities.allIds
      .map((id) => state.entities.byId[id])
      .filter((entity): entity is EntitySnapshot => Boolean(entity?.alive && entity.category === 'unit'));
    for (let i = 0; i < units.length; i += 1) {
      for (let j = i + 1; j < units.length; j += 1) {
        const a = units[i];
        const b = units[j];
        const minDistance = a.footprint.colliderRadius + b.footprint.colliderRadius;
        const dx = b.position.x - a.position.x;
        const dz = b.position.z - a.position.z;
        const distance = Math.hypot(dx, dz);
        if (distance === 0 || distance >= minDistance) {
          continue;
        }
        const push = (minDistance - distance) * 0.55;
        a.position.x -= (dx / distance) * push;
        a.position.z -= (dz / distance) * push;
        b.position.x += (dx / distance) * push;
        b.position.z += (dz / distance) * push;
      }
    }
  }

  private advanceOrderQueue(entity: EntitySnapshot): void {
    entity.orderQueue ??= [];
    const nextOrder = entity.orderQueue.shift();
    entity.order = nextOrder ?? { type: 'idle' };
  }

  private distanceXZ(a: Vec3State, b: Vec3State): number {
    return Math.hypot(a.x - b.x, a.z - b.z);
  }

  private findNearestDropOff(state: GameState, team: TeamType, position: Vec3State): EntitySnapshot | null {
    let nearest: EntitySnapshot | null = null;
    let minDistance = Infinity;
    for (const id of state.entities.allIds) {
      const entity = state.entities.byId[id];
      if (!entity?.alive || !entity.built || entity.team !== team || !entity.canDropOffResources) {
        continue;
      }
      const distance = this.distanceXZ(position, entity.position);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = entity;
      }
    }
    return nearest;
  }

  private findNearestEnemy(state: GameState, source: EntitySnapshot, maxDistance: number): EntitySnapshot | null {
    let nearest: EntitySnapshot | null = null;
    let bestDistance = maxDistance;
    for (const id of state.entities.allIds) {
      const entity = state.entities.byId[id];
      if (!entity?.alive || entity.team === source.team || entity.category === 'resource') {
        continue;
      }
      const distance = this.distanceXZ(source.position, entity.position);
      if (distance < bestDistance) {
        bestDistance = distance;
        nearest = entity;
      }
    }
    return nearest;
  }

  private getEntityLabel(kind: EntitySnapshot['kind']): string {
    switch (kind) {
      case 'mainBase': return '主基地';
      case 'resourceDropoff': return '回收站';
      case 'barracks': return '兵营';
      case 'vehicleFactory': return '载具工厂';
      case 'powerPlant': return '电站';
      case 'supplyDepot': return '补给站';
      case 'defenseTower': return '防御塔';
      case 'techLab': return '科技中心';
      case 'worker': return '工程单位';
      case 'scout': return '侦察车';
      case 'infantry': return '步兵';
      case 'lancer': return '反甲步兵';
      case 'tank': return '前线坦克';
      case 'artillery': return '远程火炮';
      case 'resourceNode': return '资源点';
      default: return kind;
    }
  }
}
