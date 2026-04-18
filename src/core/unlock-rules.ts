import {
  ContentRegistry,
  TECHNOLOGY_IDS,
  UNIT_CONFIG_BY_KIND,
  type ContentRule,
  type TechnologyRule
} from './content-registry';
import type {
  ActiveResearchState,
  BuildMode,
  EntitySnapshot,
  GameState,
  ProductionKind,
  ResearchStatus,
  ResourceCostState,
  TechnologyId,
  TierLevel
} from './game-state';
import { canAffordResourceCost, getAvailableSupply } from './game-state';
import { TeamType } from './team-type';

export interface AvailabilityResult {
  status: ResearchStatus | 'available';
  reason: string | null;
}

export interface TeamModifierState {
  gatherMultiplier: number;
  productionSpeedMultiplier: number;
  damageBonusByConfig: Record<string, number>;
  rangeBonusByConfig: Record<string, number>;
  sightBonusByConfig: Record<string, number>;
  armorBonusByConfig: Record<string, number>;
}

export const hasBuiltConfig = (state: GameState, team: TeamType, configKey: string): boolean =>
  state.entities.allIds.some((id) => {
    const entity = state.entities.byId[id];
    return Boolean(entity?.alive && entity.team === team && entity.configKey === configKey && entity.built);
  });

export const getTeamTier = (state: GameState, team: TeamType): TierLevel =>
  state.research.byTeam[team].tier;

export const isTechCompleted = (state: GameState, team: TeamType, techId: TechnologyId): boolean =>
  state.research.byTeam[team].completedIds.includes(techId);

export const getActiveResearch = (
  state: GameState,
  team: TeamType,
  techId: TechnologyId
): ActiveResearchState | null =>
  Object.values(state.research.byTeam[team].activeByBuildingId).find((item) => item.techId === techId) ?? null;

export const getTeamModifiers = (state: GameState, team: TeamType): TeamModifierState => {
  const modifiers: TeamModifierState = {
    gatherMultiplier: 1,
    productionSpeedMultiplier: 1,
    damageBonusByConfig: {},
    rangeBonusByConfig: {},
    sightBonusByConfig: {},
    armorBonusByConfig: {}
  };

  for (const techId of state.research.byTeam[team].completedIds) {
    const tech = ContentRegistry.getTechnology(techId);
    for (const effect of tech.effects) {
      if (effect.type === 'gatherEfficiency') {
        modifiers.gatherMultiplier += effect.amount ?? 0;
        continue;
      }
      if (effect.type === 'productionSpeed') {
        modifiers.productionSpeedMultiplier += effect.amount ?? 0;
        continue;
      }
      if (effect.type !== 'attributeBonus' || !effect.stat || !effect.targetConfigKeys) {
        continue;
      }

      const bucket = effect.stat === 'damage'
        ? modifiers.damageBonusByConfig
        : effect.stat === 'range'
          ? modifiers.rangeBonusByConfig
          : effect.stat === 'sight'
            ? modifiers.sightBonusByConfig
            : modifiers.armorBonusByConfig;

      for (const configKey of effect.targetConfigKeys) {
        bucket[configKey] = (bucket[configKey] ?? 0) + (effect.amount ?? 0);
      }
    }
  }

  return modifiers;
};

const getContentPrerequisiteReason = (
  state: GameState,
  team: TeamType,
  rule: ContentRule
): string | null => {
  if (rule.requiredTier === 'T2' && getTeamTier(state, team) !== 'T2') {
    return '需要先完成 T2 阶段升级。';
  }

  const missingTech = rule.prerequisiteTechIds.find((techId) => !isTechCompleted(state, team, techId));
  if (missingTech) {
    return `需要先完成 ${ContentRegistry.getTechnology(missingTech).name}。`;
  }

  const missingBuilding = rule.prerequisiteBuildings.find((configKey) => !hasBuiltConfig(state, team, configKey));
  if (missingBuilding) {
    return `需要先完成 ${ContentRegistry.getRule(missingBuilding).label}。`;
  }

  return null;
};

export const getBuildAvailability = (
  state: GameState,
  team: TeamType,
  buildMode: Exclude<BuildMode, 'none'>
): AvailabilityResult => {
  const rule = ContentRegistry.getRule(buildMode);
  const reason = getContentPrerequisiteReason(state, team, rule);
  return reason ? { status: 'locked', reason } : { status: 'available', reason: null };
};

export const getProduceAvailability = (
  state: GameState,
  team: TeamType,
  building: EntitySnapshot,
  kind: ProductionKind
): AvailabilityResult => {
  if (!building.productionKinds.includes(kind)) {
    return { status: 'locked', reason: '该建筑不能生产这个单位。' };
  }

  const rule = ContentRegistry.getRule(UNIT_CONFIG_BY_KIND[kind]);
  const reason = getContentPrerequisiteReason(state, team, rule);
  return reason ? { status: 'locked', reason } : { status: 'available', reason: null };
};

export const getTechnologyAvailability = (
  state: GameState,
  team: TeamType,
  techId: TechnologyId
): AvailabilityResult => {
  if (isTechCompleted(state, team, techId)) {
    return { status: 'completed', reason: null };
  }

  if (getActiveResearch(state, team, techId)) {
    return { status: 'researching', reason: null };
  }

  const tech = ContentRegistry.getTechnology(techId);
  if (tech.phase === 'T2' && getTeamTier(state, team) !== 'T2') {
    return { status: 'locked', reason: '需要先完成 T2 阶段升级。' };
  }

  const missingTech = tech.prerequisiteTechIds.find((id) => !isTechCompleted(state, team, id));
  if (missingTech) {
    return { status: 'locked', reason: `需要先完成 ${ContentRegistry.getTechnology(missingTech).name}。` };
  }

  const missingBuilding = tech.prerequisiteBuildings.find((configKey) => !hasBuiltConfig(state, team, configKey));
  if (missingBuilding) {
    return { status: 'locked', reason: `需要先完成 ${ContentRegistry.getRule(missingBuilding).label}。` };
  }

  return { status: 'available', reason: null };
};

export const getAffordableReason = (
  state: GameState,
  team: TeamType,
  cost: ResourceCostState,
  includeSupply = true
): string | null => {
  const economy = state.economy.byTeam[team];
  if (economy.manpower < cost.manpower) {
    return '人力不足。';
  }
  if (economy.power < cost.power) {
    return '电力不足。';
  }
  if (includeSupply && getAvailableSupply(state, team) < cost.supply) {
    return '人口上限不足。';
  }
  return null;
};

export const canAffordForUi = (
  state: GameState,
  team: TeamType,
  cost: ResourceCostState,
  includeSupply = true
): boolean => {
  if (includeSupply) {
    return canAffordResourceCost(state, team, cost);
  }
  const economy = state.economy.byTeam[team];
  return economy.manpower >= cost.manpower && economy.power >= cost.power;
};

export const getTechnologyButtonsForBuilding = (
  state: GameState,
  building: EntitySnapshot
): Array<{ tech: TechnologyRule; availability: AvailabilityResult }> =>
  building.researchKinds.map((techId) => ({
    tech: ContentRegistry.getTechnology(techId),
    availability: getTechnologyAvailability(state, building.team, techId)
  }));

export const getAllCompletedTechnologies = (state: GameState, team: TeamType): TechnologyRule[] =>
  TECHNOLOGY_IDS
    .filter((techId) => isTechCompleted(state, team, techId))
    .map((techId) => ContentRegistry.getTechnology(techId));
