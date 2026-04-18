import { APP_CONFIG } from './config';
import type {
  BuildMode,
  EconomyResourceType,
  EngagementProfile,
  EntitySnapshot,
  ProductionKind,
  ResourceCostState,
  TechEffectType,
  TechnologyId,
  TierLevel
} from './game-state';

export interface TechnologyEffect {
  type: TechEffectType;
  targetConfigKeys?: string[];
  amount?: number;
  tier?: TierLevel;
  unlockId?: string;
  stat?: 'damage' | 'range' | 'sight' | 'armor';
}

export interface ContentRule {
  label: string;
  kind: EntitySnapshot['kind'];
  category: EntitySnapshot['category'];
  maxHp: number;
  speed: number;
  attackRange: number;
  attackDamage: number;
  armor: number;
  attackCooldown: number;
  sightRange: number;
  engagementProfile: EngagementProfile;
  carryCapacity: number;
  gatherRate: number;
  buildTime: number;
  productionKinds: ProductionKind[];
  researchKinds: TechnologyId[];
  canDropOffResources: boolean;
  resourceAmount: number;
  resourceType?: EconomyResourceType;
  prerequisiteBuildings: string[];
  prerequisiteTechIds: TechnologyId[];
  requiredTier: TierLevel;
  providesSupplyCap: number;
  passiveIncome?: Partial<Record<EconomyResourceType, number>>;
  resourceCost: ResourceCostState;
}

export interface TechnologyRule {
  id: TechnologyId;
  name: string;
  cost: ResourceCostState;
  researchTime: number;
  prerequisiteTechIds: TechnologyId[];
  prerequisiteBuildings: string[];
  phase: TierLevel;
  effects: TechnologyEffect[];
}

export const CONTENT_RULES: Record<string, ContentRule> = {
  'units.worker': {
    label: '工程单位',
    kind: 'worker',
    category: 'unit',
    maxHp: 52,
    speed: 3.1,
    attackRange: 1.05,
    attackDamage: 3,
    armor: 0,
    attackCooldown: 1.2,
    sightRange: 6.5,
    engagementProfile: 'melee',
    carryCapacity: 60,
    gatherRate: 22,
    buildTime: APP_CONFIG.gameplay.workerBuildTime,
    productionKinds: [],
    researchKinds: [],
    canDropOffResources: false,
    resourceAmount: 0,
    prerequisiteBuildings: ['buildings.mainBase'],
    prerequisiteTechIds: [],
    requiredTier: 'T1',
    providesSupplyCap: 0,
    resourceCost: APP_CONFIG.gameplay.costs.worker
  },
  'units.scout': {
    label: '侦察车',
    kind: 'scout',
    category: 'unit',
    maxHp: 72,
    speed: 4.1,
    attackRange: 3.2,
    attackDamage: 8,
    armor: 0,
    attackCooldown: 0.8,
    sightRange: 9,
    engagementProfile: 'ranged',
    carryCapacity: 0,
    gatherRate: 0,
    buildTime: APP_CONFIG.gameplay.scoutBuildTime,
    productionKinds: [],
    researchKinds: [],
    canDropOffResources: false,
    resourceAmount: 0,
    prerequisiteBuildings: ['buildings.barracks'],
    prerequisiteTechIds: ['doctrine.scoutTraining'],
    requiredTier: 'T1',
    providesSupplyCap: 0,
    resourceCost: APP_CONFIG.gameplay.costs.scout
  },
  'units.infantry': {
    label: '步兵',
    kind: 'infantry',
    category: 'unit',
    maxHp: 90,
    speed: 2.8,
    attackRange: 3.6,
    attackDamage: 12,
    armor: 0,
    attackCooldown: 0.95,
    sightRange: 7.5,
    engagementProfile: 'ranged',
    carryCapacity: 0,
    gatherRate: 0,
    buildTime: APP_CONFIG.gameplay.infantryBuildTime,
    productionKinds: [],
    researchKinds: [],
    canDropOffResources: false,
    resourceAmount: 0,
    prerequisiteBuildings: ['buildings.barracks'],
    prerequisiteTechIds: [],
    requiredTier: 'T1',
    providesSupplyCap: 0,
    resourceCost: APP_CONFIG.gameplay.costs.infantry
  },
  'units.lancer': {
    label: '反甲步兵',
    kind: 'lancer',
    category: 'unit',
    maxHp: 108,
    speed: 2.5,
    attackRange: 4.4,
    attackDamage: 20,
    armor: 1,
    attackCooldown: 1.3,
    sightRange: 7.8,
    engagementProfile: 'ranged',
    carryCapacity: 0,
    gatherRate: 0,
    buildTime: APP_CONFIG.gameplay.lancerBuildTime,
    productionKinds: [],
    researchKinds: [],
    canDropOffResources: false,
    resourceAmount: 0,
    prerequisiteBuildings: ['buildings.barracks', 'buildings.techLab'],
    prerequisiteTechIds: ['doctrine.lancerLoadout'],
    requiredTier: 'T2',
    providesSupplyCap: 0,
    resourceCost: APP_CONFIG.gameplay.costs.lancer
  },
  'units.tank': {
    label: '前线坦克',
    kind: 'tank',
    category: 'unit',
    maxHp: 215,
    speed: 2,
    attackRange: 5.8,
    attackDamage: 24,
    armor: 2,
    attackCooldown: 1.55,
    sightRange: 8.5,
    engagementProfile: 'ranged',
    carryCapacity: 0,
    gatherRate: 0,
    buildTime: APP_CONFIG.gameplay.tankBuildTime,
    productionKinds: [],
    researchKinds: [],
    canDropOffResources: false,
    resourceAmount: 0,
    prerequisiteBuildings: ['buildings.vehicleFactory'],
    prerequisiteTechIds: ['phase.two'],
    requiredTier: 'T2',
    providesSupplyCap: 0,
    resourceCost: APP_CONFIG.gameplay.costs.tank
  },
  'units.artillery': {
    label: '远程火炮',
    kind: 'artillery',
    category: 'unit',
    maxHp: 165,
    speed: 1.7,
    attackRange: 8.8,
    attackDamage: 34,
    armor: 1,
    attackCooldown: 1.8,
    sightRange: 9.5,
    engagementProfile: 'ranged',
    carryCapacity: 0,
    gatherRate: 0,
    buildTime: APP_CONFIG.gameplay.artilleryBuildTime,
    productionKinds: [],
    researchKinds: [],
    canDropOffResources: false,
    resourceAmount: 0,
    prerequisiteBuildings: ['buildings.vehicleFactory', 'buildings.techLab'],
    prerequisiteTechIds: ['doctrine.artilleryFrame'],
    requiredTier: 'T2',
    providesSupplyCap: 0,
    resourceCost: APP_CONFIG.gameplay.costs.artillery
  },
  'buildings.mainBase': {
    label: '主基地',
    kind: 'mainBase',
    category: 'building',
    maxHp: APP_CONFIG.gameplay.mainBaseHp,
    speed: 0,
    attackRange: 0,
    attackDamage: 0,
    armor: 1,
    attackCooldown: 0,
    sightRange: 10,
    engagementProfile: 'ranged',
    carryCapacity: 0,
    gatherRate: 0,
    buildTime: 0,
    productionKinds: ['worker'],
    researchKinds: ['phase.two', 'fortification.blueprint', 'economy.harvestDrills'],
    canDropOffResources: true,
    resourceAmount: 0,
    prerequisiteBuildings: [],
    prerequisiteTechIds: [],
    requiredTier: 'T1',
    providesSupplyCap: 10,
    resourceCost: { manpower: 0, power: 0, supply: 0 }
  },
  'buildings.resourceDropoff': {
    label: '回收站',
    kind: 'resourceDropoff',
    category: 'building',
    maxHp: 280,
    speed: 0,
    attackRange: 0,
    attackDamage: 0,
    armor: 1,
    attackCooldown: 0,
    sightRange: 8,
    engagementProfile: 'ranged',
    carryCapacity: 0,
    gatherRate: 0,
    buildTime: APP_CONFIG.gameplay.resourceDropoffBuildTime,
    productionKinds: [],
    researchKinds: [],
    canDropOffResources: true,
    resourceAmount: 0,
    prerequisiteBuildings: [],
    prerequisiteTechIds: [],
    requiredTier: 'T1',
    providesSupplyCap: 0,
    resourceCost: APP_CONFIG.gameplay.costs.resourceDropoff
  },
  'buildings.barracks': {
    label: '兵营',
    kind: 'barracks',
    category: 'building',
    maxHp: 320,
    speed: 0,
    attackRange: 0,
    attackDamage: 0,
    armor: 1,
    attackCooldown: 0,
    sightRange: 9,
    engagementProfile: 'ranged',
    carryCapacity: 0,
    gatherRate: 0,
    buildTime: APP_CONFIG.gameplay.barracksBuildTime,
    productionKinds: ['infantry', 'scout', 'lancer'],
    researchKinds: ['doctrine.scoutTraining'],
    canDropOffResources: false,
    resourceAmount: 0,
    prerequisiteBuildings: ['buildings.powerPlant'],
    prerequisiteTechIds: [],
    requiredTier: 'T1',
    providesSupplyCap: 0,
    resourceCost: APP_CONFIG.gameplay.costs.barracks
  },
  'buildings.vehicleFactory': {
    label: '载具工厂',
    kind: 'vehicleFactory',
    category: 'building',
    maxHp: 380,
    speed: 0,
    attackRange: 0,
    attackDamage: 0,
    armor: 2,
    attackCooldown: 0,
    sightRange: 9,
    engagementProfile: 'ranged',
    carryCapacity: 0,
    gatherRate: 0,
    buildTime: APP_CONFIG.gameplay.vehicleFactoryBuildTime,
    productionKinds: ['tank', 'artillery'],
    researchKinds: [],
    canDropOffResources: false,
    resourceAmount: 0,
    prerequisiteBuildings: ['buildings.techLab'],
    prerequisiteTechIds: ['phase.two'],
    requiredTier: 'T2',
    providesSupplyCap: 0,
    resourceCost: APP_CONFIG.gameplay.costs.vehicleFactory
  },
  'buildings.powerPlant': {
    label: '电站',
    kind: 'powerPlant',
    category: 'building',
    maxHp: 220,
    speed: 0,
    attackRange: 0,
    attackDamage: 0,
    armor: 0,
    attackCooldown: 0,
    sightRange: 7,
    engagementProfile: 'ranged',
    carryCapacity: 0,
    gatherRate: 0,
    buildTime: APP_CONFIG.gameplay.powerPlantBuildTime,
    productionKinds: [],
    researchKinds: [],
    canDropOffResources: false,
    resourceAmount: 0,
    prerequisiteBuildings: [],
    prerequisiteTechIds: [],
    requiredTier: 'T1',
    providesSupplyCap: 0,
    passiveIncome: { power: 0.35 },
    resourceCost: APP_CONFIG.gameplay.costs.powerPlant
  },
  'buildings.supplyDepot': {
    label: '补给站',
    kind: 'supplyDepot',
    category: 'building',
    maxHp: 210,
    speed: 0,
    attackRange: 0,
    attackDamage: 0,
    armor: 1,
    attackCooldown: 0,
    sightRange: 7,
    engagementProfile: 'ranged',
    carryCapacity: 0,
    gatherRate: 0,
    buildTime: APP_CONFIG.gameplay.supplyDepotBuildTime,
    productionKinds: [],
    researchKinds: [],
    canDropOffResources: false,
    resourceAmount: 0,
    prerequisiteBuildings: [],
    prerequisiteTechIds: [],
    requiredTier: 'T1',
    providesSupplyCap: 6,
    resourceCost: APP_CONFIG.gameplay.costs.supplyDepot
  },
  'buildings.defenseTower': {
    label: '防御塔',
    kind: 'defenseTower',
    category: 'building',
    maxHp: 280,
    speed: 0,
    attackRange: 6.4,
    attackDamage: 16,
    armor: 2,
    attackCooldown: 0.9,
    sightRange: 8,
    engagementProfile: 'ranged',
    carryCapacity: 0,
    gatherRate: 0,
    buildTime: APP_CONFIG.gameplay.defenseTowerBuildTime,
    productionKinds: [],
    researchKinds: [],
    canDropOffResources: false,
    resourceAmount: 0,
    prerequisiteBuildings: ['buildings.powerPlant'],
    prerequisiteTechIds: ['fortification.blueprint'],
    requiredTier: 'T1',
    providesSupplyCap: 0,
    resourceCost: APP_CONFIG.gameplay.costs.defenseTower
  },
  'buildings.techLab': {
    label: '科技中心',
    kind: 'techLab',
    category: 'building',
    maxHp: 260,
    speed: 0,
    attackRange: 0,
    attackDamage: 0,
    armor: 1,
    attackCooldown: 0,
    sightRange: 8,
    engagementProfile: 'ranged',
    carryCapacity: 0,
    gatherRate: 0,
    buildTime: APP_CONFIG.gameplay.techLabBuildTime,
    productionKinds: [],
    researchKinds: [
      'industry.assemblyLines',
      'doctrine.lancerLoadout',
      'doctrine.artilleryFrame',
      'weapons.ballistics',
      'optics.targeting',
      'armor.plating'
    ],
    canDropOffResources: false,
    resourceAmount: 0,
    prerequisiteBuildings: ['buildings.barracks'],
    prerequisiteTechIds: ['phase.two'],
    requiredTier: 'T2',
    providesSupplyCap: 0,
    resourceCost: APP_CONFIG.gameplay.costs.techLab
  },
  'resources.crystalField': {
    label: '晶矿',
    kind: 'resourceNode',
    category: 'resource',
    maxHp: 1,
    speed: 0,
    attackRange: 0,
    attackDamage: 0,
    armor: 0,
    attackCooldown: 0,
    sightRange: 0,
    engagementProfile: 'ranged',
    carryCapacity: 0,
    gatherRate: 0,
    buildTime: 0,
    productionKinds: [],
    researchKinds: [],
    canDropOffResources: false,
    resourceAmount: 1800,
    resourceType: 'manpower',
    prerequisiteBuildings: [],
    prerequisiteTechIds: [],
    requiredTier: 'T1',
    providesSupplyCap: 0,
    resourceCost: { manpower: 0, power: 0, supply: 0 }
  },
  'resources.powerWell': {
    label: '能井',
    kind: 'resourceNode',
    category: 'resource',
    maxHp: 1,
    speed: 0,
    attackRange: 0,
    attackDamage: 0,
    armor: 0,
    attackCooldown: 0,
    sightRange: 0,
    engagementProfile: 'ranged',
    carryCapacity: 0,
    gatherRate: 0,
    buildTime: 0,
    productionKinds: [],
    researchKinds: [],
    canDropOffResources: false,
    resourceAmount: 1500,
    resourceType: 'power',
    prerequisiteBuildings: [],
    prerequisiteTechIds: [],
    requiredTier: 'T1',
    providesSupplyCap: 0,
    resourceCost: { manpower: 0, power: 0, supply: 0 }
  }
};

export const TECHNOLOGY_RULES: Record<TechnologyId, TechnologyRule> = {
  'phase.two': {
    id: 'phase.two',
    name: '阶段升级 T2',
    cost: APP_CONFIG.gameplay.costs.phaseTwo,
    researchTime: 20,
    prerequisiteTechIds: [],
    prerequisiteBuildings: ['buildings.barracks', 'buildings.powerPlant'],
    phase: 'T1',
    effects: [
      { type: 'phaseUpgrade', tier: 'T2' },
      { type: 'unlockBuilding', unlockId: 'buildings.techLab' },
      { type: 'unlockBuilding', unlockId: 'buildings.vehicleFactory' }
    ]
  },
  'fortification.blueprint': {
    id: 'fortification.blueprint',
    name: '防御蓝图',
    cost: APP_CONFIG.gameplay.costs.techCheap,
    researchTime: 10,
    prerequisiteTechIds: [],
    prerequisiteBuildings: ['buildings.powerPlant'],
    phase: 'T1',
    effects: [{ type: 'unlockBuilding', unlockId: 'buildings.defenseTower' }]
  },
  'doctrine.scoutTraining': {
    id: 'doctrine.scoutTraining',
    name: '侦察训练',
    cost: APP_CONFIG.gameplay.costs.techCheap,
    researchTime: 8,
    prerequisiteTechIds: [],
    prerequisiteBuildings: ['buildings.barracks'],
    phase: 'T1',
    effects: [{ type: 'unlockUnit', unlockId: 'units.scout' }]
  },
  'economy.harvestDrills': {
    id: 'economy.harvestDrills',
    name: '采集钻头',
    cost: APP_CONFIG.gameplay.costs.techMedium,
    researchTime: 11,
    prerequisiteTechIds: [],
    prerequisiteBuildings: ['buildings.mainBase'],
    phase: 'T1',
    effects: [{ type: 'gatherEfficiency', amount: 0.25 }]
  },
  'industry.assemblyLines': {
    id: 'industry.assemblyLines',
    name: '流水装配',
    cost: APP_CONFIG.gameplay.costs.techMedium,
    researchTime: 12,
    prerequisiteTechIds: ['phase.two'],
    prerequisiteBuildings: ['buildings.techLab'],
    phase: 'T2',
    effects: [{ type: 'productionSpeed', amount: 0.2 }]
  },
  'doctrine.lancerLoadout': {
    id: 'doctrine.lancerLoadout',
    name: '反甲弹组',
    cost: APP_CONFIG.gameplay.costs.techMedium,
    researchTime: 12,
    prerequisiteTechIds: ['phase.two'],
    prerequisiteBuildings: ['buildings.techLab', 'buildings.barracks'],
    phase: 'T2',
    effects: [{ type: 'unlockUnit', unlockId: 'units.lancer' }]
  },
  'doctrine.artilleryFrame': {
    id: 'doctrine.artilleryFrame',
    name: '火炮底盘',
    cost: APP_CONFIG.gameplay.costs.techHeavy,
    researchTime: 15,
    prerequisiteTechIds: ['phase.two'],
    prerequisiteBuildings: ['buildings.techLab', 'buildings.vehicleFactory'],
    phase: 'T2',
    effects: [{ type: 'unlockUnit', unlockId: 'units.artillery' }]
  },
  'weapons.ballistics': {
    id: 'weapons.ballistics',
    name: '弹道强化',
    cost: APP_CONFIG.gameplay.costs.techMedium,
    researchTime: 13,
    prerequisiteTechIds: ['phase.two'],
    prerequisiteBuildings: ['buildings.techLab'],
    phase: 'T2',
    effects: [{
      type: 'attributeBonus',
      stat: 'damage',
      amount: 3,
      targetConfigKeys: ['units.scout', 'units.infantry', 'units.lancer', 'units.tank', 'units.artillery', 'buildings.defenseTower']
    }]
  },
  'optics.targeting': {
    id: 'optics.targeting',
    name: '光学瞄准',
    cost: APP_CONFIG.gameplay.costs.techMedium,
    researchTime: 12,
    prerequisiteTechIds: ['phase.two'],
    prerequisiteBuildings: ['buildings.techLab'],
    phase: 'T2',
    effects: [
      {
        type: 'attributeBonus',
        stat: 'sight',
        amount: 1.4,
        targetConfigKeys: ['units.scout', 'units.infantry', 'units.lancer', 'units.tank', 'units.artillery', 'buildings.defenseTower']
      },
      {
        type: 'attributeBonus',
        stat: 'range',
        amount: 0.5,
        targetConfigKeys: ['units.infantry', 'units.lancer', 'units.tank', 'units.artillery', 'buildings.defenseTower']
      }
    ]
  },
  'armor.plating': {
    id: 'armor.plating',
    name: '复合装甲',
    cost: APP_CONFIG.gameplay.costs.techHeavy,
    researchTime: 14,
    prerequisiteTechIds: ['phase.two'],
    prerequisiteBuildings: ['buildings.techLab'],
    phase: 'T2',
    effects: [{
      type: 'attributeBonus',
      stat: 'armor',
      amount: 1,
      targetConfigKeys: ['units.lancer', 'units.tank', 'units.artillery', 'buildings.defenseTower']
    }]
  }
};

export const TECHNOLOGY_IDS = Object.keys(TECHNOLOGY_RULES) as TechnologyId[];

export const UNIT_CONFIG_BY_KIND: Record<ProductionKind, string> = {
  worker: 'units.worker',
  scout: 'units.scout',
  infantry: 'units.infantry',
  lancer: 'units.lancer',
  tank: 'units.tank',
  artillery: 'units.artillery'
};

export const BUILDABLE_BUILDINGS: Exclude<BuildMode, 'none'>[] = [
  'buildings.resourceDropoff',
  'buildings.powerPlant',
  'buildings.supplyDepot',
  'buildings.barracks',
  'buildings.defenseTower',
  'buildings.techLab',
  'buildings.vehicleFactory'
];

export class ContentRegistry {
  public static getRule(configKey: string): ContentRule {
    const rule = CONTENT_RULES[configKey];
    if (!rule) {
      throw new Error(`Missing content rule for "${configKey}"`);
    }
    return rule;
  }

  public static getTechnology(id: TechnologyId): TechnologyRule {
    const rule = TECHNOLOGY_RULES[id];
    if (!rule) {
      throw new Error(`Missing technology rule for "${id}"`);
    }
    return rule;
  }
}
