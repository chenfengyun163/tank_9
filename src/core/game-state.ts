import { APP_CONFIG } from './config';
import { TeamType } from './team-type';

export interface Vec3State {
  x: number;
  y: number;
  z: number;
}

export type EconomyResourceType = 'manpower' | 'power';
export type TierLevel = 'T1' | 'T2';
export type TechnologyId =
  | 'phase.two'
  | 'fortification.blueprint'
  | 'doctrine.scoutTraining'
  | 'economy.harvestDrills'
  | 'industry.assemblyLines'
  | 'doctrine.lancerLoadout'
  | 'doctrine.artilleryFrame'
  | 'weapons.ballistics'
  | 'optics.targeting'
  | 'armor.plating';
export type TechEffectType =
  | 'unlockBuilding'
  | 'unlockUnit'
  | 'attributeBonus'
  | 'productionSpeed'
  | 'gatherEfficiency'
  | 'phaseUpgrade';
export type ResearchStatus = 'locked' | 'available' | 'researching' | 'completed';

export interface FeedbackMarkerState {
  id: string;
  kind: 'move' | 'attack' | 'attackMove' | 'gather' | 'build' | 'rally' | 'patrol' | 'stop' | 'hold' | 'repair' | 'research';
  position: Vec3State;
  ttl: number;
}

export interface FootprintState {
  tilesX: number;
  tilesY: number;
  colliderRadius: number;
  selectionRadius: number;
}

export interface ResourceCostState {
  manpower: number;
  power: number;
  supply: number;
}

export interface TeamEconomyState {
  manpower: number;
  power: number;
  supplyUsed: number;
  supplyCap: number;
}

export type SessionPhase = 'boot' | 'playing' | 'victory' | 'defeat';
export type AiPhase =
  | 'boot'
  | 'opening'
  | 'economy'
  | 'tech'
  | 'muster'
  | 'harass'
  | 'assault'
  | 'defend'
  | 'rebuild'
  | 'desperation';
export type BuildMode =
  | 'none'
  | 'buildings.resourceDropoff'
  | 'buildings.barracks'
  | 'buildings.vehicleFactory'
  | 'buildings.powerPlant'
  | 'buildings.supplyDepot'
  | 'buildings.defenseTower'
  | 'buildings.techLab';
export type EntityCategory = 'unit' | 'building' | 'resource';
export type EntityKind =
  | 'worker'
  | 'scout'
  | 'infantry'
  | 'lancer'
  | 'tank'
  | 'artillery'
  | 'mainBase'
  | 'resourceDropoff'
  | 'barracks'
  | 'vehicleFactory'
  | 'powerPlant'
  | 'supplyDepot'
  | 'defenseTower'
  | 'techLab'
  | 'resourceNode';
export type ProductionKind = 'worker' | 'scout' | 'infantry' | 'lancer' | 'tank' | 'artillery';
export type CommandMode = 'none' | 'attackMove' | 'setRallyPoint' | 'patrol';
export type EngagementProfile = 'melee' | 'ranged';

export type OrderState =
  | { type: 'idle' }
  | { type: 'move'; targetPosition: Vec3State }
  | { type: 'hold'; anchorPosition: Vec3State; chaseRadius: number }
  | { type: 'attack'; targetEntityId: string }
  | { type: 'attack-move'; targetPosition: Vec3State; targetEntityId?: string }
  | {
    type: 'patrol';
    path: [Vec3State, Vec3State];
    segmentIndex: 0 | 1;
    loopOrigin?: Vec3State;
    targetEntityId?: string;
  }
  | { type: 'gather'; targetEntityId: string }
  | { type: 'return-resource'; targetEntityId: string; followUpTargetId?: string }
  | { type: 'construct'; targetEntityId: string }
  | { type: 'repair'; targetEntityId: string };

export interface EntitySnapshot {
  id: string;
  team: TeamType;
  category: EntityCategory;
  kind: EntityKind;
  configKey: string;
  assetKey: string;
  position: Vec3State;
  rotationY: number;
  hp: number;
  maxHp: number;
  speed: number;
  attackRange: number;
  attackDamage: number;
  armor: number;
  attackCooldown: number;
  attackCooldownRemaining: number;
  sightRange: number;
  selectionRadius: number;
  engagementProfile: EngagementProfile;
  footprint: FootprintState;
  alive: boolean;
  built: boolean;
  buildProgress: number;
  buildTime: number;
  order: OrderState;
  orderQueue: OrderState[];
  carryAmount: number;
  carryCapacity: number;
  carryResourceType?: EconomyResourceType | null;
  gatherRate: number;
  resourceAmount: number;
  resourceType?: EconomyResourceType;
  productionKinds: ProductionKind[];
  researchKinds: TechnologyId[];
  canDropOffResources: boolean;
  rallyPoint?: Vec3State;
  recentDamageSeconds: number;
  formationSlot?: number;
  formationTarget?: Vec3State;
  assignedBuilderIds?: string[];
  baseAttackDamage: number;
  baseAttackRange: number;
  baseArmor: number;
  baseSightRange: number;
  baseGatherRate: number;
  baseBuildTime: number;
}

export interface EntityState {
  byId: Record<string, EntitySnapshot>;
  allIds: string[];
}

export interface SessionState {
  phase: SessionPhase;
  elapsedSeconds: number;
  winner: TeamType | null;
  message: string;
  aiPhase: AiPhase;
  isLoading: boolean;
  loadingProgress: number;
}

export type AiWaveStatus = 'staging' | 'engaging' | 'retreating' | 'ended';
export type AiWaveResult = 'success' | 'failed' | 'aborted' | 'unknown';

export interface AiWaveState {
  waveId: number;
  launchTime: number;
  unitIds: string[];
  targetEntityId: string | null;
  targetPosition: Vec3State | null;
  status: AiWaveStatus;
  result: AiWaveResult;
  originUnitCount: number;
}

export interface AiRuntimeState {
  strategicPhase: AiPhase;
  isEmergencyDefense: boolean;
  attackWave: number;
  currentTargetEntityId: string | null;
  currentTargetPosition: Vec3State | null;
  rallyPoint: Vec3State | null;
  lastHarassTime: number;
  lastAttackTime: number;
  lastDefenseTime: number;
  targetWorkerCount: number;
  targetAttackForce: number;
  previousPhaseBeforeDefense: AiPhase;
  phaseEnteredAt: number;
  lastPhaseChangeAt: number;
  attackCooldownUntil: number;
  harassCooldownUntil: number;
  retreatCooldownUntil: number;
  currentWave: AiWaveState | null;
  waveHistory: AiWaveState[];
}

export interface AiState {
  enemy: AiRuntimeState;
}

export interface SelectionState {
  selectedIds: string[];
}

export interface ControlGroupState {
  groups: Record<number, string[]>;
  lastSelectedGroup: number | null;
}

export interface OrdersState {
  queuedCommands: number;
  buildMode: BuildMode;
  commandMode: CommandMode;
  notifications: string[];
  markers: FeedbackMarkerState[];
}

export interface EconomyState {
  byTeam: Record<TeamType, TeamEconomyState>;
}

export interface ProductionQueueItem {
  kind: ProductionKind;
  totalTime: number;
  remainingTime: number;
}

export interface ProductionState {
  queuesByEntityId: Record<string, ProductionQueueItem[]>;
}

export interface ActiveResearchState {
  techId: TechnologyId;
  buildingId: string;
  totalTime: number;
  remainingTime: number;
}

export interface TeamResearchState {
  tier: TierLevel;
  completedIds: TechnologyId[];
  activeByBuildingId: Record<string, ActiveResearchState>;
}

export interface ResearchState {
  byTeam: Record<TeamType, TeamResearchState>;
}

export interface WorldState {
  width: number;
  depth: number;
  nextEntityId: number;
}

export interface VisibleCellState {
  x: number;
  z: number;
  status: 'unseen' | 'explored' | 'visible';
}

export interface VisionMemoryState {
  entityId: string;
  kind: EntityKind;
  category: EntityCategory;
  team: TeamType;
  position: Vec3State;
  hp: number;
  maxHp: number;
  visible: boolean;
  lastSeenAt: number;
  alive: boolean;
}

export interface VisibilityState {
  gridSize: number;
  width: number;
  depth: number;
  cells: VisibleCellState[];
  visibleCellKeys: string[];
  exploredCellKeys: string[];
  enemyMemories: Record<string, VisionMemoryState>;
  debugShowRanges: boolean;
}

export interface GameState {
  session: SessionState;
  selection: SelectionState;
  controlGroups: ControlGroupState;
  entities: EntityState;
  orders: OrdersState;
  economy: EconomyState;
  production: ProductionState;
  research: ResearchState;
  ai: AiState;
  world: WorldState;
  visibility: VisibilityState;
}

const createInitialVisibilityState = (): VisibilityState => {
  const gridSize = APP_CONFIG.visibility.gridSize;
  const width = Math.ceil(APP_CONFIG.ground.width / gridSize);
  const depth = Math.ceil(APP_CONFIG.ground.depth / gridSize);
  const cells: VisibleCellState[] = [];

  for (let z = 0; z < depth; z += 1) {
    for (let x = 0; x < width; x += 1) {
      cells.push({ x, z, status: 'unseen' });
    }
  }

  return {
    gridSize,
    width,
    depth,
    cells,
    visibleCellKeys: [],
    exploredCellKeys: [],
    enemyMemories: {},
    debugShowRanges: false
  };
};

export const createInitialAiRuntimeState = (
  strategicPhase: AiPhase = 'boot'
): AiRuntimeState => ({
  strategicPhase,
  isEmergencyDefense: false,
  attackWave: 0,
  currentTargetEntityId: null,
  currentTargetPosition: null,
  rallyPoint: null,
  lastHarassTime: Number.NEGATIVE_INFINITY,
  lastAttackTime: Number.NEGATIVE_INFINITY,
  lastDefenseTime: Number.NEGATIVE_INFINITY,
  targetWorkerCount: 0,
  targetAttackForce: 0,
  previousPhaseBeforeDefense: strategicPhase,
  phaseEnteredAt: 0,
  lastPhaseChangeAt: Number.NEGATIVE_INFINITY,
  attackCooldownUntil: 0,
  harassCooldownUntil: 0,
  retreatCooldownUntil: 0,
  currentWave: null,
  waveHistory: []
});

export const createTeamEconomyState = (
  overrides: Partial<TeamEconomyState> = {}
): TeamEconomyState => ({
  manpower: APP_CONFIG.economy.initialManpower,
  power: APP_CONFIG.economy.initialPower,
  supplyUsed: 0,
  supplyCap: APP_CONFIG.economy.initialSupplyCap,
  ...overrides
});

export const createTeamResearchState = (
  overrides: Partial<TeamResearchState> = {}
): TeamResearchState => ({
  tier: 'T1',
  completedIds: [],
  activeByBuildingId: {},
  ...overrides
});

export const getTeamEconomy = (state: GameState, team: TeamType): TeamEconomyState =>
  state.economy.byTeam[team];

export const getAvailableSupply = (state: GameState, team: TeamType): number => {
  const economy = getTeamEconomy(state, team);
  return Math.max(0, economy.supplyCap - economy.supplyUsed);
};

export const canAffordResourceCost = (
  state: GameState,
  team: TeamType,
  cost: ResourceCostState
): boolean => {
  const economy = getTeamEconomy(state, team);
  return economy.manpower >= cost.manpower
    && economy.power >= cost.power
    && getAvailableSupply(state, team) >= cost.supply;
};

export const spendResourceCost = (
  state: GameState,
  team: TeamType,
  cost: ResourceCostState
): boolean => {
  if (!canAffordResourceCost(state, team, cost)) {
    return false;
  }

  const economy = getTeamEconomy(state, team);
  economy.manpower -= cost.manpower;
  economy.power -= cost.power;
  return true;
};

export const createInitialGameState = (): GameState => ({
  session: {
    phase: 'boot',
    elapsedSeconds: 0,
    winner: null,
    message: '正在准备战场...',
    aiPhase: 'boot',
    isLoading: true,
    loadingProgress: 0
  },
  selection: {
    selectedIds: []
  },
  controlGroups: {
    groups: {
      0: [],
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
      6: [],
      7: [],
      8: [],
      9: []
    },
    lastSelectedGroup: null
  },
  entities: {
    byId: {},
    allIds: []
  },
  orders: {
    queuedCommands: 0,
    buildMode: 'none',
    commandMode: 'none',
    notifications: [],
    markers: []
  },
  economy: {
    byTeam: {
      [TeamType.Neutral]: createTeamEconomyState({
        manpower: 0,
        power: 0,
        supplyCap: 0
      }),
      [TeamType.Player]: createTeamEconomyState(),
      [TeamType.Enemy]: createTeamEconomyState()
    }
  },
  production: {
    queuesByEntityId: {}
  },
  research: {
    byTeam: {
      [TeamType.Neutral]: createTeamResearchState(),
      [TeamType.Player]: createTeamResearchState(),
      [TeamType.Enemy]: createTeamResearchState()
    }
  },
  ai: {
    enemy: createInitialAiRuntimeState()
  },
  world: {
    width: APP_CONFIG.ground.width,
    depth: APP_CONFIG.ground.depth,
    nextEntityId: 1
  },
  visibility: createInitialVisibilityState()
});
