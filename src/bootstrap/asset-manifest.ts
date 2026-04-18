export type EntityCategory = 'unit' | 'building' | 'resource';
export type PlaceholderGeometry = 'box' | 'capsule' | 'cylinder' | 'plane';

export interface Vec2Like { readonly x: number; readonly y: number; }
export interface Vec3Like { readonly x: number; readonly y: number; readonly z: number; }

export interface PlaceholderPresentation {
  readonly assetKey: string;
  readonly geometry: PlaceholderGeometry;
  readonly materialKey: string;
  readonly baseScale: Vec3Like;
  readonly anchor: Vec3Like;
  readonly glbUrl?: string;
  readonly modelOffset?: Vec3Like;
}

export interface FootprintRule {
  readonly tiles: Vec2Like;
  readonly colliderRadius: number;
  readonly selectionRadius: number;
}

export interface EntityContentDefinition {
  readonly id: string;
  readonly category: EntityCategory;
  readonly configKey: string;
  readonly presentation: PlaceholderPresentation;
  readonly footprint: FootprintRule;
}

export interface WorldContentDefinition {
  readonly id: string;
  readonly assetKey: string;
  readonly materialKey: string;
}

export interface GlbAssetEntry {
  readonly key: string;
  readonly url: string;
}

export interface AssetManifest {
  readonly world: {
    readonly ground: WorldContentDefinition;
    readonly referenceMarker: WorldContentDefinition;
  };
  readonly units: readonly EntityContentDefinition[];
  readonly buildings: readonly EntityContentDefinition[];
  readonly resources: readonly EntityContentDefinition[];
  readonly materials: readonly string[];
  readonly textures: readonly string[];
  readonly audio: readonly string[];
  readonly configs: readonly string[];
  readonly glbAssets: readonly GlbAssetEntry[];
}

export const ASSET_MANIFEST: AssetManifest = {
  world: {
    ground: { id: 'world-ground', assetKey: 'world/ground/box', materialKey: 'mat/ground-placeholder' },
    referenceMarker: { id: 'world-reference-marker', assetKey: 'world/reference-marker/box', materialKey: 'mat/reference-placeholder' }
  },
  units: [
    {
      id: 'unit-worker',
      category: 'unit',
      configKey: 'units.worker',
      presentation: { assetKey: 'units/worker/glb', geometry: 'capsule', materialKey: 'mat/unit-worker', baseScale: { x: 2.2, y: 2.2, z: 2.2 }, anchor: { x: 0, y: 0, z: 0 }, glbUrl: '/models/military_soldier.glb' },
      footprint: { tiles: { x: 1, y: 1 }, colliderRadius: 0.5, selectionRadius: 0.7 }
    },
    {
      id: 'unit-scout',
      category: 'unit',
      configKey: 'units.scout',
      presentation: { assetKey: 'units/scout/placeholder', geometry: 'box', materialKey: 'mat/unit-scout', baseScale: { x: 2.6, y: 1.4, z: 3.4 }, anchor: { x: 0, y: 0.7, z: 0 } },
      footprint: { tiles: { x: 1, y: 1 }, colliderRadius: 0.65, selectionRadius: 0.9 }
    },
    {
      id: 'unit-infantry',
      category: 'unit',
      configKey: 'units.infantry',
      presentation: { assetKey: 'units/infantry/glb', geometry: 'capsule', materialKey: 'mat/unit-infantry', baseScale: { x: 3.2, y: 3.2, z: 3.2 }, anchor: { x: 0, y: 0, z: 0 }, glbUrl: '/models/military_soldier.glb' },
      footprint: { tiles: { x: 1, y: 1 }, colliderRadius: 0.55, selectionRadius: 0.75 }
    },
    {
      id: 'unit-lancer',
      category: 'unit',
      configKey: 'units.lancer',
      presentation: { assetKey: 'units/lancer/glb', geometry: 'capsule', materialKey: 'mat/unit-lancer', baseScale: { x: 3.4, y: 3.4, z: 3.4 }, anchor: { x: 0, y: 0, z: 0 }, glbUrl: '/models/military_soldier.glb' },
      footprint: { tiles: { x: 1, y: 1 }, colliderRadius: 0.58, selectionRadius: 0.82 }
    },
    {
      id: 'unit-tank',
      category: 'unit',
      configKey: 'units.tank',
      presentation: { assetKey: 'units/tank/glb', geometry: 'box', materialKey: 'mat/unit-tank', baseScale: { x: 4.8, y: 4.8, z: 4.8 }, anchor: { x: 0, y: 0, z: 0 }, glbUrl: '/models/military_tank.glb' },
      footprint: { tiles: { x: 2, y: 2 }, colliderRadius: 1.1, selectionRadius: 1.5 }
    },
    {
      id: 'unit-artillery',
      category: 'unit',
      configKey: 'units.artillery',
      presentation: { assetKey: 'units/artillery/placeholder', geometry: 'box', materialKey: 'mat/unit-artillery', baseScale: { x: 4.2, y: 2.2, z: 5.4 }, anchor: { x: 0, y: 1.1, z: 0 } },
      footprint: { tiles: { x: 2, y: 2 }, colliderRadius: 1.05, selectionRadius: 1.45 }
    }
  ],
  buildings: [
    {
      id: 'building-main-base',
      category: 'building',
      configKey: 'buildings.mainBase',
      presentation: { assetKey: 'buildings/main-base/glb', geometry: 'box', materialKey: 'mat/building-main-base', baseScale: { x: 12, y: 12, z: 12 }, anchor: { x: 0, y: 0, z: 0 }, glbUrl: '/models/military_radar_building.glb' },
      footprint: { tiles: { x: 4, y: 4 }, colliderRadius: 5.5, selectionRadius: 6.5 }
    },
    {
      id: 'building-resource-dropoff',
      category: 'building',
      configKey: 'buildings.resourceDropoff',
      presentation: { assetKey: 'buildings/resource-dropoff/placeholder', geometry: 'box', materialKey: 'mat/building-resource-dropoff', baseScale: { x: 4.2, y: 3.1, z: 4.2 }, anchor: { x: 0, y: 1.55, z: 0 } },
      footprint: { tiles: { x: 3, y: 3 }, colliderRadius: 2.6, selectionRadius: 3.4 }
    },
    {
      id: 'building-barracks',
      category: 'building',
      configKey: 'buildings.barracks',
      presentation: { assetKey: 'buildings/barracks/placeholder', geometry: 'box', materialKey: 'mat/building-barracks', baseScale: { x: 8.5, y: 6.6, z: 8.5 }, anchor: { x: 0, y: 3.3, z: 0 } },
      footprint: { tiles: { x: 3, y: 3 }, colliderRadius: 3.1, selectionRadius: 4.2 }
    },
    {
      id: 'building-vehicle-factory',
      category: 'building',
      configKey: 'buildings.vehicleFactory',
      presentation: { assetKey: 'buildings/vehicle-factory/placeholder', geometry: 'box', materialKey: 'mat/building-vehicle-factory', baseScale: { x: 9.5, y: 5.6, z: 9.5 }, anchor: { x: 0, y: 2.8, z: 0 } },
      footprint: { tiles: { x: 4, y: 4 }, colliderRadius: 3.8, selectionRadius: 4.8 }
    },
    {
      id: 'building-power-plant',
      category: 'building',
      configKey: 'buildings.powerPlant',
      presentation: { assetKey: 'buildings/power-plant/placeholder', geometry: 'cylinder', materialKey: 'mat/building-power-plant', baseScale: { x: 5.8, y: 4.8, z: 5.8 }, anchor: { x: 0, y: 2.4, z: 0 } },
      footprint: { tiles: { x: 2, y: 2 }, colliderRadius: 2.2, selectionRadius: 3 }
    },
    {
      id: 'building-supply-depot',
      category: 'building',
      configKey: 'buildings.supplyDepot',
      presentation: { assetKey: 'buildings/supply-depot/placeholder', geometry: 'box', materialKey: 'mat/building-supply-depot', baseScale: { x: 4.8, y: 3.8, z: 4.8 }, anchor: { x: 0, y: 1.9, z: 0 } },
      footprint: { tiles: { x: 2, y: 2 }, colliderRadius: 2.1, selectionRadius: 2.8 }
    },
    {
      id: 'building-defense-tower',
      category: 'building',
      configKey: 'buildings.defenseTower',
      presentation: { assetKey: 'buildings/defense-tower/placeholder', geometry: 'cylinder', materialKey: 'mat/building-defense-tower', baseScale: { x: 3.2, y: 6.2, z: 3.2 }, anchor: { x: 0, y: 3.1, z: 0 } },
      footprint: { tiles: { x: 2, y: 2 }, colliderRadius: 1.8, selectionRadius: 2.6 }
    },
    {
      id: 'building-tech-lab',
      category: 'building',
      configKey: 'buildings.techLab',
      presentation: { assetKey: 'buildings/tech-lab/placeholder', geometry: 'box', materialKey: 'mat/building-tech-lab', baseScale: { x: 6.4, y: 5.2, z: 6.4 }, anchor: { x: 0, y: 2.6, z: 0 } },
      footprint: { tiles: { x: 3, y: 3 }, colliderRadius: 2.9, selectionRadius: 3.8 }
    }
  ],
  resources: [
    {
      id: 'resource-crystal-field',
      category: 'resource',
      configKey: 'resources.crystalField',
      presentation: { assetKey: 'resources/crystal-field/placeholder', geometry: 'cylinder', materialKey: 'mat/resource-crystal', baseScale: { x: 3.5, y: 2.5, z: 3.5 }, anchor: { x: 0, y: 1.25, z: 0 } },
      footprint: { tiles: { x: 2, y: 2 }, colliderRadius: 2, selectionRadius: 2.2 }
    },
    {
      id: 'resource-power-well',
      category: 'resource',
      configKey: 'resources.powerWell',
      presentation: { assetKey: 'resources/power-well/placeholder', geometry: 'cylinder', materialKey: 'mat/resource-power-well', baseScale: { x: 3.1, y: 2.1, z: 3.1 }, anchor: { x: 0, y: 1.05, z: 0 } },
      footprint: { tiles: { x: 2, y: 2 }, colliderRadius: 1.8, selectionRadius: 2 }
    }
  ],
  materials: [
    'mat/ground-placeholder',
    'mat/reference-placeholder',
    'mat/unit-worker',
    'mat/unit-scout',
    'mat/unit-infantry',
    'mat/unit-lancer',
    'mat/unit-tank',
    'mat/unit-artillery',
    'mat/building-main-base',
    'mat/building-resource-dropoff',
    'mat/building-barracks',
    'mat/building-vehicle-factory',
    'mat/building-power-plant',
    'mat/building-supply-depot',
    'mat/building-defense-tower',
    'mat/building-tech-lab',
    'mat/resource-crystal',
    'mat/resource-power-well'
  ],
  textures: [],
  audio: [],
  configs: [
    'units.worker',
    'units.scout',
    'units.infantry',
    'units.lancer',
    'units.tank',
    'units.artillery',
    'buildings.mainBase',
    'buildings.resourceDropoff',
    'buildings.barracks',
    'buildings.vehicleFactory',
    'buildings.powerPlant',
    'buildings.supplyDepot',
    'buildings.defenseTower',
    'buildings.techLab',
    'resources.crystalField',
    'resources.powerWell'
  ],
  glbAssets: [
    { key: '/models/military_tank.glb', url: '/models/military_tank.glb' },
    { key: '/models/military_soldier.glb', url: '/models/military_soldier.glb' },
    { key: '/models/military_radar_building.glb', url: '/models/military_radar_building.glb' }
  ]
};
