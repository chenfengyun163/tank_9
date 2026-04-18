import { APP_CONFIG } from '../../core/config';
import { ContentRegistry } from '../../core/content-registry';

const workerCost = ContentRegistry.getRule('units.worker').resourceCost;
const infantryCost = ContentRegistry.getRule('units.infantry').resourceCost;
const tankCost = ContentRegistry.getRule('units.tank').resourceCost;
const barracksCost = ContentRegistry.getRule('buildings.barracks').resourceCost;

export const AI_CONFIG = {
  tickInterval: 0.5,
  commandCooldowns: {
    gather: 0.6,
    build: 3,
    produce: 1.2,
    rally: 4,
    tactical: 2.5,
    regroup: 1.6
  },
  phase: {
    minimumStaySeconds: 4,
    switchCooldownSeconds: 2.5
  },
  economy: {
    openingWorkers: 2,
    standardWorkers: 4,
    minimumWorkers: 2,
    switchToMilitaryAt: {
      manpower: infantryCost.manpower * 2,
      power: infantryCost.power * 2
    }
  },
  military: {
    harassThreshold: 2,
    assaultThreshold: 5,
    suppressThreshold: 7,
    tankUnlockAfterSeconds: 42,
    minFrontlineBeforeTank: 3,
    targetHeavyRatio: 0.4,
    maxBarracksQueue: 2,
    preferredQueuePerBuilding: 1,
    maintainHomeGuard: 1,
    attackMoveFrontlineDistance: 5.5,
    directAssaultSwitchDistance: 6.8,
    retreatLossRatio: 0.45,
    retreatHealthRatio: 0.48,
    forceDisadvantageRatio: 0.72
  },
  defense: {
    alertRadius: 14,
    releaseRadius: 18,
    escalationThreatCount: 3,
    escalationDistance: 8
  },
  timings: {
    harassCooldown: 10,
    assaultCooldown: 14,
    retreatRegroupCooldown: 10,
    maxWaveDuration: 40
  },
  resources: {
    workerReserve: workerCost,
    infantryCost,
    tankCost,
    barracksCost
  },
  placements: {
    barracksOffsets: [
      { x: -8, y: 0, z: 6 },
      { x: -9, y: 0, z: 1 },
      { x: -4, y: 0, z: 8 },
      { x: -12, y: 0, z: 5 }
    ],
    fallbackOffsets: [
      { x: -6, y: 0, z: -2 },
      { x: -11, y: 0, z: -4 }
    ],
    rallyDistanceFromBarracks: 6.2,
    rallyForwardBias: 2.2
  },
  waveHistoryLimit: 8,
  income: APP_CONFIG.economy.incomePerSecond
} as const;
