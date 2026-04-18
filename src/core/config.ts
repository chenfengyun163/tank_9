export const APP_CONFIG = {
  title: '钢铁前线：RTS 试验场',
  shell: {
    appId: 'app-shell',
    canvasId: 'game-canvas',
    overlayId: 'hud-overlay',
    hudRootId: 'hud-root',
    marqueeId: 'selection-marquee'
  },
  clearColor: [0.1, 0.12, 0.16, 1] as const,
  camera: {
    position: { x: 0, y: 22, z: 20 },
    lookAt: { x: 0, y: 0, z: 0 },
    panSpeed: 16,
    zoomStep: 0.08,
    minZoom: 0.72,
    maxZoom: 1.45,
    boundsPadding: 5,
    edgePanThreshold: 24,
    edgePanStrength: 1.15,
    doubleClickMs: 260,
    controlGroupJumpSeconds: 0.45
  },
  ground: {
    width: 42,
    depth: 42,
    thickness: 0.25
  },
  visibility: {
    gridSize: 2,
    visionDebugColor: '#65d7ff'
  },
  economy: {
    initialManpower: 220,
    initialPower: 120,
    incomePerSecond: {
      manpower: 0.15,
      power: 0.08
    },
    initialSupplyCap: 0
  },
  gameplay: {
    mainBaseHp: 700,
    workerBuildTime: 4,
    scoutBuildTime: 5,
    infantryBuildTime: 5,
    lancerBuildTime: 6,
    tankBuildTime: 8,
    artilleryBuildTime: 10,
    barracksBuildTime: 12,
    vehicleFactoryBuildTime: 16,
    resourceDropoffBuildTime: 11,
    powerPlantBuildTime: 9,
    supplyDepotBuildTime: 8,
    defenseTowerBuildTime: 10,
    techLabBuildTime: 13,
    attackMoveAcquireRadius: 6.5,
    queueLimitPerBuilding: 4,
    holdPositionChaseRadius: 2.4,
    formationSpacing: 1.7,
    localAvoidanceRadius: 2.2,
    localAvoidanceStrength: 1.3,
    staticObstacleAvoidanceRadius: 4,
    staticObstacleAvoidanceStrength: 1.65,
    patrolAcquireRadius: 5.5,
    workerRepairRate: 16,
    constructRange: 1.5,
    repairRange: 1.4,
    costs: {
      worker: { manpower: 50, power: 0, supply: 1 },
      scout: { manpower: 60, power: 10, supply: 1 },
      infantry: { manpower: 70, power: 15, supply: 1 },
      lancer: { manpower: 90, power: 25, supply: 2 },
      tank: { manpower: 140, power: 90, supply: 3 },
      artillery: { manpower: 160, power: 110, supply: 3 },
      resourceDropoff: { manpower: 90, power: 20, supply: 0 },
      barracks: { manpower: 130, power: 35, supply: 0 },
      vehicleFactory: { manpower: 200, power: 110, supply: 0 },
      powerPlant: { manpower: 80, power: 0, supply: 0 },
      supplyDepot: { manpower: 70, power: 25, supply: 0 },
      defenseTower: { manpower: 120, power: 55, supply: 0 },
      techLab: { manpower: 150, power: 80, supply: 0 },
      phaseTwo: { manpower: 180, power: 120, supply: 0 },
      techCheap: { manpower: 80, power: 40, supply: 0 },
      techMedium: { manpower: 110, power: 70, supply: 0 },
      techHeavy: { manpower: 140, power: 90, supply: 0 }
    }
  }
} as const;

export type AppConfig = typeof APP_CONFIG;
