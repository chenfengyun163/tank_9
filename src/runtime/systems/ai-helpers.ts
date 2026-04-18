import { getAvailableSupply, type EntitySnapshot, type GameState, type ProductionKind, type Vec3State } from '../../core/game-state';
import { TeamType } from '../../core/team-type';
import { AI_CONFIG } from './ai-config';
import type { AiArmyGroups, AiEconomyOverview, AiPerception, AiUnitRole, UnitRoleCounts } from './ai-types';

export const distanceXZ = (a: Vec3State, b: Vec3State): number =>
  Math.hypot(a.x - b.x, a.z - b.z);

export const getAliveEntities = (state: GameState): EntitySnapshot[] =>
  state.entities.allIds
    .map((id) => state.entities.byId[id])
    .filter((entity): entity is EntitySnapshot => Boolean(entity?.alive));

export const getOwnMainBase = (state: GameState, team: TeamType): EntitySnapshot | null =>
  getAliveEntities(state).find((entity) => entity.team === team && entity.kind === 'mainBase') ?? null;

export const getEnemyMainBase = (state: GameState, team: TeamType): EntitySnapshot | null =>
  getAliveEntities(state).find((entity) => entity.team !== team && entity.team !== TeamType.Neutral && entity.kind === 'mainBase') ?? null;

export const getBarracks = (state: GameState, team: TeamType): EntitySnapshot[] =>
  getAliveEntities(state).filter((entity) => entity.team === team && entity.kind === 'barracks');

export const getWorkers = (state: GameState, team: TeamType): EntitySnapshot[] =>
  getAliveEntities(state).filter((entity) => entity.team === team && entity.kind === 'worker');

export const getInfantry = (state: GameState, team: TeamType): EntitySnapshot[] =>
  getAliveEntities(state).filter((entity) => entity.team === team && entity.kind === 'infantry');

export const getTanks = (state: GameState, team: TeamType): EntitySnapshot[] =>
  getAliveEntities(state).filter((entity) => entity.team === team && entity.kind === 'tank');

export const getCombatUnits = (state: GameState, team: TeamType): EntitySnapshot[] =>
  getAliveEntities(state).filter((entity) =>
    entity.team === team && entity.category === 'unit' && (entity.kind === 'infantry' || entity.kind === 'tank')
  );

export const getIdleWorkers = (state: GameState, team: TeamType): EntitySnapshot[] =>
  getWorkers(state, team).filter((entity) => entity.order.type === 'idle');

export const getIdleInfantry = (state: GameState, team: TeamType): EntitySnapshot[] =>
  getInfantry(state, team).filter((entity) => entity.order.type === 'idle');

export const getIdleTanks = (state: GameState, team: TeamType): EntitySnapshot[] =>
  getTanks(state, team).filter((entity) => entity.order.type === 'idle');

export const getProductionBuildings = (state: GameState, team: TeamType): EntitySnapshot[] =>
  getAliveEntities(state).filter((entity) =>
    entity.team === team && entity.category === 'building' && entity.built && entity.productionKinds.length > 0
  );

export const getAvailableProductionBuildingsForKind = (
  state: GameState,
  team: TeamType,
  kind: ProductionKind
): EntitySnapshot[] =>
  getProductionBuildings(state, team).filter((entity) => entity.productionKinds.includes(kind));

export const getUnitRole = (entity: EntitySnapshot): AiUnitRole | null => {
  if (entity.kind === 'worker') {
    return 'worker';
  }
  if (entity.kind === 'infantry') {
    return 'frontline';
  }
  if (entity.kind === 'tank') {
    return 'heavy';
  }
  return null;
};

export const countUnitRoles = (units: EntitySnapshot[]): UnitRoleCounts =>
  units.reduce<UnitRoleCounts>((acc, unit) => {
    const role = getUnitRole(unit);
    if (role) {
      acc[role] += 1;
    }
    return acc;
  }, {
    worker: 0,
    frontline: 0,
    heavy: 0
  });

export const getEnemyUnits = (state: GameState, team: TeamType): EntitySnapshot[] =>
  getAliveEntities(state).filter((entity) => entity.team !== team && entity.team !== TeamType.Neutral && entity.category === 'unit');

export const getEnemyStructures = (state: GameState, team: TeamType): EntitySnapshot[] =>
  getAliveEntities(state).filter((entity) => entity.team !== team && entity.team !== TeamType.Neutral && entity.category === 'building');

export const getNearestResourceNode = (state: GameState, position: Vec3State): EntitySnapshot | null => {
  let nearest: EntitySnapshot | null = null;
  let bestDistance = Infinity;

  for (const entity of getAliveEntities(state)) {
    if (entity.category !== 'resource' || entity.resourceAmount <= 0) {
      continue;
    }

    const distance = distanceXZ(position, entity.position);
    if (distance < bestDistance) {
      bestDistance = distance;
      nearest = entity;
    }
  }

  return nearest;
};

export const getNearestEnemyUnit = (
  state: GameState,
  team: TeamType,
  position: Vec3State,
  maxDistance = Infinity
): EntitySnapshot | null => {
  let nearest: EntitySnapshot | null = null;
  let bestDistance = maxDistance;

  for (const entity of getEnemyUnits(state, team)) {
    const distance = distanceXZ(position, entity.position);
    if (distance < bestDistance) {
      bestDistance = distance;
      nearest = entity;
    }
  }

  return nearest;
};

export const sortByDistance = (reference: Vec3State, entities: EntitySnapshot[]): EntitySnapshot[] =>
  [...entities].sort((a, b) => distanceXZ(reference, a.position) - distanceXZ(reference, b.position));

export const getThreatsNearBase = (
  state: GameState,
  team: TeamType,
  radius = AI_CONFIG.defense.alertRadius
): EntitySnapshot[] => {
  const anchors = [getOwnMainBase(state, team), ...getBarracks(state, team)].filter(
    (entity): entity is EntitySnapshot => Boolean(entity)
  );
  if (anchors.length === 0) {
    return [];
  }

  const threats = getEnemyUnits(state, team).filter((entity) =>
    anchors.some((anchor) => distanceXZ(anchor.position, entity.position) <= radius)
  );

  const anchorCenter = anchors[0].position;
  return sortByDistance(anchorCenter, threats);
};

export const getSuitableBarracksBuildPoint = (state: GameState, team: TeamType): Vec3State | null => {
  const base = getOwnMainBase(state, team);
  if (!base) {
    return null;
  }

  const candidates = [...AI_CONFIG.placements.barracksOffsets, ...AI_CONFIG.placements.fallbackOffsets].map((offset) => ({
    x: base.position.x + offset.x,
    y: 0,
    z: base.position.z + offset.z
  }));

  for (const candidate of candidates) {
    const blocked = getAliveEntities(state).some((entity) =>
      distanceXZ(entity.position, candidate) < entity.footprint.colliderRadius + 3.4
    );

    if (!blocked) {
      return candidate;
    }
  }

  return null;
};

export const getEconomyOverview = (state: GameState, team: TeamType): AiEconomyOverview => {
  const barracks = getBarracks(state, team);
  const infantry = getInfantry(state, team);
  const tanks = getTanks(state, team);
  return {
    manpower: state.economy.byTeam[team].manpower,
    power: state.economy.byTeam[team].power,
    workerCount: getWorkers(state, team).length,
    infantryCount: infantry.length,
    tankCount: tanks.length,
    combatCount: infantry.length + tanks.length,
    hasBarracks: barracks.length > 0,
    hasCompletedBarracks: barracks.some((entity) => entity.built),
    barracksInProgress: barracks.some((entity) => !entity.built)
  };
};

export const getAiPerception = (state: GameState, team: TeamType): AiPerception => ({
  ownBase: getOwnMainBase(state, team),
  enemyBase: getEnemyMainBase(state, team),
  barracks: getBarracks(state, team),
  workers: getWorkers(state, team),
  infantry: getInfantry(state, team),
  tanks: getTanks(state, team),
  combatUnits: getCombatUnits(state, team),
  productionBuildings: getProductionBuildings(state, team),
  idleWorkers: getIdleWorkers(state, team),
  idleInfantry: getIdleInfantry(state, team),
  idleTanks: getIdleTanks(state, team),
  threats: getThreatsNearBase(state, team),
  overview: getEconomyOverview(state, team)
});

export const getRallyPointForBarracks = (
  barracks: EntitySnapshot,
  enemyBase: EntitySnapshot | null
): Vec3State => {
  const target = enemyBase?.position ?? barracks.position;
  const dx = target.x - barracks.position.x;
  const dz = target.z - barracks.position.z;
  const length = Math.hypot(dx, dz) || 1;

  return {
    x: barracks.position.x + (dx / length) * AI_CONFIG.placements.rallyDistanceFromBarracks,
    y: 0,
    z: barracks.position.z + (dz / length) * AI_CONFIG.placements.rallyDistanceFromBarracks + AI_CONFIG.placements.rallyForwardBias
  };
};

export const getAttackFrontlinePoint = (
  ownAnchor: Vec3State,
  enemyAnchor: Vec3State
): Vec3State => {
  const dx = enemyAnchor.x - ownAnchor.x;
  const dz = enemyAnchor.z - ownAnchor.z;
  const length = Math.hypot(dx, dz) || 1;

  return {
    x: enemyAnchor.x - (dx / length) * AI_CONFIG.military.attackMoveFrontlineDistance,
    y: 0,
    z: enemyAnchor.z - (dz / length) * AI_CONFIG.military.attackMoveFrontlineDistance
  };
};

export const getArmyGroups = (
  combatUnits: EntitySnapshot[],
  rallyPoint: Vec3State | null,
  ownBase: EntitySnapshot | null
): AiArmyGroups => {
  const defenseGroup = ownBase
    ? combatUnits.filter((unit) => distanceXZ(unit.position, ownBase.position) <= AI_CONFIG.defense.releaseRadius)
    : [];

  const rallyGroup = rallyPoint
    ? combatUnits.filter((unit) => distanceXZ(unit.position, rallyPoint) > AI_CONFIG.military.attackMoveFrontlineDistance)
    : [];

  const attackGroup = combatUnits.filter((unit) => !rallyPoint || distanceXZ(unit.position, rallyPoint) <= AI_CONFIG.military.attackMoveFrontlineDistance);

  return {
    defenseGroup,
    rallyGroup,
    attackGroup
  };
};

export const getAverageHealthRatio = (units: EntitySnapshot[]): number => {
  if (units.length === 0) {
    return 1;
  }

  const ratioSum = units.reduce((sum, unit) => sum + unit.hp / Math.max(1, unit.maxHp), 0);
  return ratioSum / units.length;
};

export const countEnemyUnitsNear = (
  state: GameState,
  team: TeamType,
  center: Vec3State,
  radius: number
): number =>
  getEnemyUnits(state, team).filter((unit) => distanceXZ(unit.position, center) <= radius).length;

export const getAliveUnitsFromIds = (state: GameState, ids: string[]): EntitySnapshot[] =>
  ids
    .map((id) => state.entities.byId[id])
    .filter((entity): entity is EntitySnapshot => Boolean(entity?.alive && entity.category === 'unit'));

export const chooseLeastQueuedBuilding = (
  state: GameState,
  buildings: EntitySnapshot[]
): EntitySnapshot | null => {
  if (buildings.length === 0) {
    return null;
  }

  return [...buildings].sort((a, b) => {
    const queueA = state.production.queuesByEntityId[a.id]?.length ?? 0;
    const queueB = state.production.queuesByEntityId[b.id]?.length ?? 0;
    if (queueA !== queueB) {
      return queueA - queueB;
    }
    return a.id.localeCompare(b.id);
  })[0] ?? null;
};

export const hasResourceBuffer = (
  state: GameState,
  team: TeamType,
  reserveManpower: number,
  reservePower: number
): boolean => {
  const economy = state.economy.byTeam[team];
  return economy.manpower >= reserveManpower && economy.power >= reservePower;
};

export const getAvailableSupplyForTeam = (state: GameState, team: TeamType): number =>
  getAvailableSupply(state, team);
