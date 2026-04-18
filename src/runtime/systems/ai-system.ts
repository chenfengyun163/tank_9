import { ContentRegistry } from '../../core/content-registry';
import type {
  EntitySnapshot,
  GameState,
  ProductionKind,
  TechnologyId,
  Vec3State
} from '../../core/game-state';
import type {
  AttackCommand,
  AttackMoveCommand,
  BuildCommand,
  GameCommand,
  GatherCommand,
  MoveCommand,
  ProduceCommand,
  ResearchCommand,
  SetRallyPointCommand
} from '../../core/command-types';
import { TeamType } from '../../core/team-type';
import {
  getProduceAvailability,
  getTechnologyAvailability,
  hasBuiltConfig,
  isTechCompleted
} from '../../core/unlock-rules';

export interface AiSystemDependencies {
  enqueueCommand: (command: GameCommand) => void;
  createCommandId: () => string;
}

const AI_TICK = 0.6;
const COMMAND_COOLDOWNS = {
  gather: 0.8,
  build: 2.8,
  produce: 1,
  research: 1.2,
  rally: 4,
  attack: 3
} as const;

type CooldownKey = keyof typeof COMMAND_COOLDOWNS;

export class AiSystem {
  private accumulator = 0;
  private cooldowns: Record<CooldownKey, number> = {
    gather: 0,
    build: 0,
    produce: 0,
    research: 0,
    rally: 0,
    attack: 0
  };

  public constructor(private readonly deps: AiSystemDependencies) {}

  public update(state: GameState, dt: number): void {
    if (state.session.phase !== 'playing') {
      return;
    }

    this.accumulator += dt;
    for (const key of Object.keys(this.cooldowns) as CooldownKey[]) {
      this.cooldowns[key] = Math.max(0, this.cooldowns[key] - dt);
    }

    if (this.accumulator < AI_TICK) {
      return;
    }

    this.accumulator = 0;
    this.runEnemyTurn(state);
  }

  public reset(): void {
    this.accumulator = 0;
    for (const key of Object.keys(this.cooldowns) as CooldownKey[]) {
      this.cooldowns[key] = 0;
    }
  }

  private runEnemyTurn(state: GameState): void {
    const ownBase = this.findMainBase(state, TeamType.Enemy);
    const enemyBase = this.findMainBase(state, TeamType.Player);
    if (!ownBase || !enemyBase) {
      return;
    }

    this.assignWorkersToGather(state);
    this.ensureRallyPoint(state, ownBase, enemyBase.position);
    this.ensureSupply(state);
    this.ensureBuildChain(state, ownBase);
    this.ensureResearch(state, ownBase);
    this.ensureProduction(state, ownBase);
    this.controlArmy(state, ownBase, enemyBase);
  }

  private assignWorkersToGather(state: GameState): void {
    if (!this.canIssue('gather')) {
      return;
    }
    const workers = this.getTeamEntities(state, TeamType.Enemy).filter((entity) => entity.kind === 'worker');
    let issued = false;
    for (const worker of workers) {
      if (worker.order.type !== 'idle') {
        continue;
      }
      const target = this.findNearestResource(state, worker.position);
      if (!target) {
        continue;
      }
      this.issueGather([worker.id], target.id);
      issued = true;
    }
    if (issued) {
      this.cooldowns.gather = COMMAND_COOLDOWNS.gather;
    }
  }

  private ensureRallyPoint(state: GameState, ownBase: EntitySnapshot, enemyPos: Vec3State): void {
    if (!this.canIssue('rally')) {
      return;
    }
    const buildings = this.getTeamEntities(state, TeamType.Enemy)
      .filter((entity) => entity.category === 'building' && entity.built && entity.productionKinds.length > 0);
    const target = this.getForwardPoint(ownBase.position, enemyPos, 7);
    const building = buildings.find((entity) => !entity.rallyPoint || this.distance(entity.rallyPoint, target) > 1);
    if (!building) {
      return;
    }
    this.issueSetRallyPoint(building.id, target);
    this.cooldowns.rally = COMMAND_COOLDOWNS.rally;
  }

  private ensureSupply(state: GameState): void {
    const economy = state.economy.byTeam[TeamType.Enemy];
    if (economy.supplyCap - economy.supplyUsed > 2) {
      return;
    }
    const workers = this.getIdleOrGatheringWorkers(state);
    if (workers.length === 0 || !this.canIssue('build')) {
      return;
    }
    if (this.hasBuildingOrConstruction(state, 'buildings.supplyDepot')) {
      return;
    }
    if (!this.canAfford(state, 'buildings.supplyDepot')) {
      return;
    }
    const anchor = this.findMainBase(state, TeamType.Enemy);
    if (!anchor) {
      return;
    }
    const point = this.getBuildPoint(state, anchor.position, [{ x: -8, z: 8 }, { x: -11, z: 4 }, { x: -9, z: -4 }]);
    if (!point) {
      return;
    }
    this.issueBuild([workers[0].id], point, 'buildings.supplyDepot');
    this.cooldowns.build = COMMAND_COOLDOWNS.build;
  }

  private ensureBuildChain(state: GameState, ownBase: EntitySnapshot): void {
    const workers = this.getIdleOrGatheringWorkers(state);
    if (workers.length === 0 || !this.canIssue('build')) {
      return;
    }

    const plans: Array<{ configKey: BuildCommand['buildingConfigKey']; offsets: Array<{ x: number; z: number }> }> = [
      { configKey: 'buildings.powerPlant', offsets: [{ x: -8, z: 2 }, { x: -6, z: -4 }] },
      { configKey: 'buildings.barracks', offsets: [{ x: -10, z: 8 }, { x: -10, z: -6 }] },
      { configKey: 'buildings.techLab', offsets: [{ x: -15, z: 2 }, { x: -15, z: -6 }] },
      { configKey: 'buildings.vehicleFactory', offsets: [{ x: -19, z: 8 }, { x: -19, z: -6 }] }
    ];

    for (const plan of plans) {
      const needTierTwo = plan.configKey === 'buildings.techLab' || plan.configKey === 'buildings.vehicleFactory';
      if (needTierTwo && !isTechCompleted(state, TeamType.Enemy, 'phase.two')) {
        continue;
      }
      if (this.hasBuildingOrConstruction(state, plan.configKey)) {
        continue;
      }
      const rule = ContentRegistry.getRule(plan.configKey);
      const prereqReady = rule.prerequisiteBuildings.every((configKey) => hasBuiltConfig(state, TeamType.Enemy, configKey))
        && rule.prerequisiteTechIds.every((techId) => isTechCompleted(state, TeamType.Enemy, techId));
      if (!prereqReady || !this.canAfford(state, plan.configKey)) {
        continue;
      }
      const point = this.getBuildPoint(state, ownBase.position, plan.offsets);
      if (!point) {
        continue;
      }
      this.issueBuild([workers[0].id], point, plan.configKey);
      this.cooldowns.build = COMMAND_COOLDOWNS.build;
      return;
    }
  }

  private ensureResearch(state: GameState, ownBase: EntitySnapshot): void {
    if (!this.canIssue('research')) {
      return;
    }

    const techLab = this.findCompletedBuilding(state, 'buildings.techLab');
    const barracks = this.findCompletedBuilding(state, 'buildings.barracks');
    const factory = this.findCompletedBuilding(state, 'buildings.vehicleFactory');
    const plan: Array<{ building: EntitySnapshot | null; techId: TechnologyId }> = [
      { building: barracks, techId: 'doctrine.scoutTraining' },
      { building: ownBase, techId: 'economy.harvestDrills' },
      { building: ownBase, techId: 'fortification.blueprint' },
      { building: ownBase, techId: 'phase.two' },
      { building: techLab, techId: 'industry.assemblyLines' },
      { building: techLab, techId: 'doctrine.lancerLoadout' },
      { building: techLab, techId: 'weapons.ballistics' },
      { building: techLab, techId: 'optics.targeting' },
      { building: techLab, techId: 'armor.plating' },
      { building: techLab && factory ? techLab : null, techId: 'doctrine.artilleryFrame' }
    ];

    for (const entry of plan) {
      if (!entry.building?.built) {
        continue;
      }
      const active = state.research.byTeam[TeamType.Enemy].activeByBuildingId[entry.building.id];
      if (active) {
        continue;
      }
      const availability = getTechnologyAvailability(state, TeamType.Enemy, entry.techId);
      if (availability.status !== 'available') {
        continue;
      }
      const tech = ContentRegistry.getTechnology(entry.techId);
      if (state.economy.byTeam[TeamType.Enemy].manpower < tech.cost.manpower || state.economy.byTeam[TeamType.Enemy].power < tech.cost.power) {
        continue;
      }
      this.issueResearch(entry.building.id, entry.techId);
      this.cooldowns.research = COMMAND_COOLDOWNS.research;
      return;
    }
  }

  private ensureProduction(state: GameState, ownBase: EntitySnapshot): void {
    if (!this.canIssue('produce')) {
      return;
    }

    const workers = this.getTeamEntities(state, TeamType.Enemy).filter((entity) => entity.kind === 'worker');
    const barracks = this.findCompletedBuilding(state, 'buildings.barracks');
    const factory = this.findCompletedBuilding(state, 'buildings.vehicleFactory');
    const targetWorkers = isTechCompleted(state, TeamType.Enemy, 'phase.two') ? 5 : 4;

    if (workers.length < targetWorkers && this.canQueueUnit(state, ownBase, 'worker')) {
      this.issueProduce(ownBase.id, 'worker');
      this.cooldowns.produce = COMMAND_COOLDOWNS.produce;
      return;
    }

    if (factory && isTechCompleted(state, TeamType.Enemy, 'doctrine.artilleryFrame') && this.countUnits(state, 'artillery') < 1 && this.canQueueUnit(state, factory, 'artillery')) {
      this.issueProduce(factory.id, 'artillery');
      this.cooldowns.produce = COMMAND_COOLDOWNS.produce;
      return;
    }

    if (factory && this.canQueueUnit(state, factory, 'tank')) {
      this.issueProduce(factory.id, 'tank');
      this.cooldowns.produce = COMMAND_COOLDOWNS.produce;
      return;
    }

    if (barracks && isTechCompleted(state, TeamType.Enemy, 'doctrine.lancerLoadout') && this.countUnits(state, 'lancer') < 2 && this.canQueueUnit(state, barracks, 'lancer')) {
      this.issueProduce(barracks.id, 'lancer');
      this.cooldowns.produce = COMMAND_COOLDOWNS.produce;
      return;
    }

    if (barracks && isTechCompleted(state, TeamType.Enemy, 'doctrine.scoutTraining') && this.countUnits(state, 'scout') < 1 && this.canQueueUnit(state, barracks, 'scout')) {
      this.issueProduce(barracks.id, 'scout');
      this.cooldowns.produce = COMMAND_COOLDOWNS.produce;
      return;
    }

    if (barracks && this.canQueueUnit(state, barracks, 'infantry')) {
      this.issueProduce(barracks.id, 'infantry');
      this.cooldowns.produce = COMMAND_COOLDOWNS.produce;
    }
  }

  private controlArmy(state: GameState, ownBase: EntitySnapshot, enemyBase: EntitySnapshot): void {
    if (!this.canIssue('attack')) {
      return;
    }
    const combatUnits = this.getTeamEntities(state, TeamType.Enemy)
      .filter((entity) => entity.category === 'unit' && entity.kind !== 'worker');
    if (combatUnits.length === 0) {
      return;
    }

    const threats = this.getTeamEntities(state, TeamType.Player)
      .filter((entity) => entity.category === 'unit' && this.distance(entity.position, ownBase.position) <= 12);
    if (threats.length > 0) {
      this.issueAttack(combatUnits.slice(0, Math.min(combatUnits.length, 4)).map((unit) => unit.id), threats[0].id);
      this.cooldowns.attack = COMMAND_COOLDOWNS.attack;
      state.ai.enemy.strategicPhase = 'defend';
      return;
    }

    const rally = this.getForwardPoint(ownBase.position, enemyBase.position, 9);
    const idleUnits = combatUnits.filter((entity) => entity.order.type === 'idle');
    if (idleUnits.length > 0) {
      this.issueMove(idleUnits.map((unit) => unit.id), rally);
    }

    const assaultThreshold = isTechCompleted(state, TeamType.Enemy, 'phase.two') ? 6 : 4;
    if (combatUnits.length >= assaultThreshold) {
      this.issueAttackMove(combatUnits.map((unit) => unit.id), enemyBase.position);
      this.cooldowns.attack = COMMAND_COOLDOWNS.attack;
      state.ai.enemy.strategicPhase = 'assault';
    } else if (!hasBuiltConfig(state, TeamType.Enemy, 'buildings.barracks')) {
      state.ai.enemy.strategicPhase = 'opening';
    } else if (!isTechCompleted(state, TeamType.Enemy, 'phase.two')) {
      state.ai.enemy.strategicPhase = 'tech';
    } else {
      state.ai.enemy.strategicPhase = 'muster';
    }
  }

  private canQueueUnit(state: GameState, building: EntitySnapshot, kind: ProductionKind): boolean {
    const availability = getProduceAvailability(state, TeamType.Enemy, building, kind);
    if (availability.status !== 'available') {
      return false;
    }
    const queue = state.production.queuesByEntityId[building.id] ?? [];
    if (queue.length >= 2) {
      return false;
    }
    const configKey = this.getUnitConfigKey(kind);
    const unitRule = ContentRegistry.getRule(configKey);
    const economy = state.economy.byTeam[TeamType.Enemy];
    return economy.manpower >= unitRule.resourceCost.manpower
      && economy.power >= unitRule.resourceCost.power
      && economy.supplyUsed + unitRule.resourceCost.supply <= economy.supplyCap;
  }

  private canAfford(state: GameState, configKey: string): boolean {
    const cost = ContentRegistry.getRule(configKey).resourceCost;
    const economy = state.economy.byTeam[TeamType.Enemy];
    return economy.manpower >= cost.manpower && economy.power >= cost.power;
  }

  private getUnitConfigKey(kind: ProductionKind): string {
    switch (kind) {
      case 'worker': return 'units.worker';
      case 'scout': return 'units.scout';
      case 'infantry': return 'units.infantry';
      case 'lancer': return 'units.lancer';
      case 'tank': return 'units.tank';
      case 'artillery': return 'units.artillery';
    }
  }

  private countUnits(state: GameState, kind: EntitySnapshot['kind']): number {
    return this.getTeamEntities(state, TeamType.Enemy).filter((entity) => entity.kind === kind).length;
  }

  private getIdleOrGatheringWorkers(state: GameState): EntitySnapshot[] {
    return this.getTeamEntities(state, TeamType.Enemy)
      .filter((entity) => entity.kind === 'worker' && (entity.order.type === 'idle' || entity.order.type === 'gather' || entity.order.type === 'return-resource'));
  }

  private hasBuildingOrConstruction(state: GameState, configKey: string): boolean {
    return this.getTeamEntities(state, TeamType.Enemy)
      .some((entity) => entity.configKey === configKey && entity.category === 'building');
  }

  private findCompletedBuilding(state: GameState, configKey: string): EntitySnapshot | null {
    return this.getTeamEntities(state, TeamType.Enemy)
      .find((entity) => entity.configKey === configKey && entity.category === 'building' && entity.built) ?? null;
  }

  private findMainBase(state: GameState, team: TeamType): EntitySnapshot | null {
    return this.getTeamEntities(state, team).find((entity) => entity.kind === 'mainBase') ?? null;
  }

  private getTeamEntities(state: GameState, team: TeamType): EntitySnapshot[] {
    return state.entities.allIds
      .map((id) => state.entities.byId[id])
      .filter((entity): entity is EntitySnapshot => Boolean(entity?.alive && entity.team === team));
  }

  private findNearestResource(state: GameState, position: Vec3State): EntitySnapshot | null {
    let nearest: EntitySnapshot | null = null;
    let best = Infinity;
    for (const id of state.entities.allIds) {
      const entity = state.entities.byId[id];
      if (!entity?.alive || entity.category !== 'resource' || entity.resourceAmount <= 0) {
        continue;
      }
      const distance = this.distance(position, entity.position);
      if (distance < best) {
        best = distance;
        nearest = entity;
      }
    }
    return nearest;
  }

  private getBuildPoint(
    state: GameState,
    anchor: Vec3State,
    offsets: Array<{ x: number; z: number }>
  ): Vec3State | null {
    for (const offset of offsets) {
      const candidate = { x: anchor.x + offset.x, y: 0, z: anchor.z + offset.z };
      const blocked = state.entities.allIds.some((id) => {
        const entity = state.entities.byId[id];
        return Boolean(entity?.alive && this.distance(entity.position, candidate) < entity.footprint.colliderRadius + 3.5);
      });
      if (!blocked) {
        return candidate;
      }
    }
    return null;
  }

  private getForwardPoint(from: Vec3State, to: Vec3State, distance: number): Vec3State {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const length = Math.hypot(dx, dz) || 1;
    return { x: from.x + (dx / length) * distance, y: 0, z: from.z + (dz / length) * distance };
  }

  private distance(a: Vec3State, b: Vec3State): number {
    return Math.hypot(a.x - b.x, a.z - b.z);
  }

  private canIssue(key: CooldownKey): boolean {
    return this.cooldowns[key] <= 0;
  }

  private issueMove(entityIds: string[], target: Vec3State): void {
    const command: MoveCommand = { id: this.deps.createCommandId(), source: 'ai', type: 'move', entityIds, target };
    this.deps.enqueueCommand(command);
  }

  private issueAttack(entityIds: string[], targetEntityId: string): void {
    const command: AttackCommand = { id: this.deps.createCommandId(), source: 'ai', type: 'attack', entityIds, targetEntityId };
    this.deps.enqueueCommand(command);
  }

  private issueAttackMove(entityIds: string[], target: Vec3State): void {
    const command: AttackMoveCommand = { id: this.deps.createCommandId(), source: 'ai', type: 'attackMove', entityIds, target };
    this.deps.enqueueCommand(command);
  }

  private issueGather(entityIds: string[], targetEntityId: string): void {
    const command: GatherCommand = { id: this.deps.createCommandId(), source: 'ai', type: 'gather', entityIds, targetEntityId };
    this.deps.enqueueCommand(command);
  }

  private issueBuild(entityIds: string[], target: Vec3State, buildingConfigKey: BuildCommand['buildingConfigKey']): void {
    const command: BuildCommand = { id: this.deps.createCommandId(), source: 'ai', type: 'build', entityIds, buildingConfigKey, target };
    this.deps.enqueueCommand(command);
  }

  private issueProduce(buildingId: string, unitKind: ProductionKind): void {
    const command: ProduceCommand = { id: this.deps.createCommandId(), source: 'ai', type: 'produce', buildingId, unitKind };
    this.deps.enqueueCommand(command);
  }

  private issueResearch(buildingId: string, techId: TechnologyId): void {
    const command: ResearchCommand = { id: this.deps.createCommandId(), source: 'ai', type: 'research', buildingId, techId };
    this.deps.enqueueCommand(command);
  }

  private issueSetRallyPoint(buildingId: string, target: Vec3State): void {
    const command: SetRallyPointCommand = { id: this.deps.createCommandId(), source: 'ai', type: 'setRallyPoint', buildingId, target };
    this.deps.enqueueCommand(command);
  }
}
