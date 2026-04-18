import type { AiPhase, AiWaveResult, AiWaveStatus, EntitySnapshot, GameState, Vec3State } from '../../core/game-state';

export type AiUnitRole = 'worker' | 'frontline' | 'heavy';
export type AiStructureRole = 'productionBuilding' | 'economyCore';

export interface AiEconomyOverview {
  manpower: number;
  power: number;
  workerCount: number;
  infantryCount: number;
  tankCount: number;
  combatCount: number;
  hasBarracks: boolean;
  hasCompletedBarracks: boolean;
  barracksInProgress: boolean;
}

export interface AiPerception {
  ownBase: EntitySnapshot | null;
  enemyBase: EntitySnapshot | null;
  barracks: EntitySnapshot[];
  workers: EntitySnapshot[];
  infantry: EntitySnapshot[];
  tanks: EntitySnapshot[];
  combatUnits: EntitySnapshot[];
  productionBuildings: EntitySnapshot[];
  idleWorkers: EntitySnapshot[];
  idleInfantry: EntitySnapshot[];
  idleTanks: EntitySnapshot[];
  threats: EntitySnapshot[];
  overview: AiEconomyOverview;
}

export interface AiArmyGroups {
  defenseGroup: EntitySnapshot[];
  rallyGroup: EntitySnapshot[];
  attackGroup: EntitySnapshot[];
}

export interface StrategicAssessment {
  phase: AiPhase;
  targetWorkerCount: number;
  targetAttackForce: number;
  rallyPoint: Vec3State | null;
}

export interface WavePlan {
  mode: 'harass' | 'assault' | 'suppress' | 'desperation';
  unitIds: string[];
  targetEntityId: string | null;
  targetPosition: Vec3State;
  status: AiWaveStatus;
  result: AiWaveResult;
}

export interface AiHelperContext {
  state: GameState;
  team: EntitySnapshot['team'];
}

export interface UnitRoleCounts {
  worker: number;
  frontline: number;
  heavy: number;
}
