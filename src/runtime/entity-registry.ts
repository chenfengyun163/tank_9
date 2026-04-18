import {
  Color,
  Entity,
  StandardMaterial,
  type AppBase,
  type Asset,
  type RenderComponent
} from 'playcanvas';

import type { AssetManifest, EntityContentDefinition } from '../bootstrap/asset-manifest';
import type { EntitySnapshot, FeedbackMarkerState, GameState } from '../core/game-state';
import { TeamType } from '../core/team-type';
import { TeamColorManager } from '../platform/playcanvas/team-color-manager';
import type { RuntimeViewRegistry } from './view-registry';

interface ContainerResourceLike {
  instantiateRenderEntity(): Entity;
}

interface EntityView {
  root: Entity;
  selectionRing?: Entity;
  healthFill: Entity;
  healthBar: Entity;
  material?: StandardMaterial;
  isGlb: boolean;
  visualState: EntityVisualState;
}

const SELECTION_EDGE_THICKNESS = 0.12;
const SELECTION_EDGE_HEIGHT = 0.03;

interface MarkerView {
  root: Entity;
  material: StandardMaterial;
  visualState: MarkerVisualState;
}

interface EntityVisualState {
  isSelected: boolean;
  baseColorKey: string;
  emissiveKey: string;
  healthKey: string;
}

interface MarkerVisualState {
  ttlBucket: number;
  positionKey: string;
}

const TEAM_COLORS: Record<string, Color> = {
  [TeamType.Player as unknown as string]: new Color(0.2, 0.5, 1),
  [TeamType.Enemy as unknown as string]: new Color(1, 0.2, 0.2),
  [TeamType.Neutral as unknown as string]: new Color(0.6, 0.6, 0.8)
};

export class EntityRegistry implements RuntimeViewRegistry {
  private readonly views = new Map<string, EntityView>();
  private readonly markerViews = new Map<string, MarkerView>();
  private readonly definitionsByConfigKey = new Map<string, EntityContentDefinition>();

  public constructor(
    private readonly app: AppBase,
    private readonly worldRoot: Entity,
    manifest: AssetManifest,
    private readonly glbAssets: Map<string, Asset> = new Map()
  ) {
    void this.app;
    for (const definition of [...manifest.units, ...manifest.buildings, ...manifest.resources]) {
      this.definitionsByConfigKey.set(definition.configKey, definition);
    }
  }

  public clear(): void {
    for (const view of this.views.values()) {
      view.root.destroy();
    }
    for (const marker of this.markerViews.values()) {
      marker.root.destroy();
    }
    this.views.clear();
    this.markerViews.clear();
  }

  public sync(state: GameState, selectedIds: Set<string>): void {
    for (const entityId of state.entities.allIds) {
      const snapshot = state.entities.byId[entityId];
      if (!snapshot || !snapshot.alive) {
        continue;
      }

      const view = this.views.get(entityId) ?? this.createView(snapshot);
      this.updateView(view, snapshot, selectedIds.has(entityId), state);
    }

    for (const [entityId, view] of this.views.entries()) {
      const snapshot = state.entities.byId[entityId];
      if (!snapshot || !snapshot.alive) {
        view.root.destroy();
        this.views.delete(entityId);
      }
    }

    this.syncMarkers(state.orders.markers);
  }

  public unregister(entityId: string): void {
    const view = this.views.get(entityId);
    if (!view) {
      return;
    }

    view.root.destroy();
    this.views.delete(entityId);
  }

  private syncMarkers(markers: FeedbackMarkerState[]): void {
    const activeMarkerIds = new Set(markers.map((marker) => marker.id));

    for (const marker of markers) {
      const view = this.markerViews.get(marker.id) ?? this.createMarkerView(marker);
      view.root.enabled = true;
      const positionKey = `${marker.position.x.toFixed(2)}:${marker.position.z.toFixed(2)}`;
      if (positionKey !== view.visualState.positionKey) {
        view.root.setLocalPosition(marker.position.x, 0.08, marker.position.z);
        view.visualState.positionKey = positionKey;
      }

      const ttlBucket = this.quantize(marker.ttl / 0.55, 0.05);
      if (ttlBucket !== view.visualState.ttlBucket) {
        const scale = 0.85 + (1 - ttlBucket) * 0.8;
        view.root.setLocalScale(scale, 0.04, scale);
        view.material.opacity = Math.max(0.15, ttlBucket);
        view.material.update();
        view.visualState.ttlBucket = ttlBucket;
      }
    }

    for (const [id, view] of this.markerViews.entries()) {
      if (!activeMarkerIds.has(id)) {
        view.root.destroy();
        this.markerViews.delete(id);
      }
    }
  }

  private createView(snapshot: EntitySnapshot): EntityView {
    const definition = this.requireDefinition(snapshot.configKey);
    const root = new Entity(snapshot.id);
    this.worldRoot.addChild(root);

    let material: StandardMaterial | undefined;
    let isGlb = false;

    if (definition.presentation.glbUrl) {
      const asset = this.glbAssets.get(definition.presentation.glbUrl);
      if (this.isContainerResource(asset?.resource)) {
        const modelEntity = asset.resource.instantiateRenderEntity();
        const offset = definition.presentation.modelOffset || { x: 0, y: 0, z: 0 };
        modelEntity.setLocalPosition(offset.x, offset.y, offset.z);
        root.addChild(modelEntity);

        TeamColorManager.applyTeamColor(modelEntity, this.getTeamColor(snapshot.team));
        const renders = modelEntity.findComponents('render') as RenderComponent[];
        for (const render of renders) {
          render.castShadows = true;
          render.receiveShadows = true;
        }
        isGlb = true;
      }
    }

    if (!isGlb) {
      root.addComponent('render', {
        type: definition.presentation.geometry,
        castShadows: true,
        receiveShadows: true
      });

      material = new StandardMaterial();
      material.diffuse = this.getBaseColor(snapshot);
      material.emissive = new Color(0, 0, 0);
      material.update();
      root.render!.material = material;
    }

    const selectionRing = this.createSelectionOutline(definition);
    selectionRing.enabled = false;
    root.addChild(selectionRing);

    const healthBar = new Entity('HealthBar');
    const healthBg = new Entity('HealthBarBg');
    const healthFill = new Entity('HealthBarFill');
    healthBar.setLocalPosition(0, definition.presentation.baseScale.y * (snapshot.category === 'building' ? 0.2 : 0.42), 0);
    healthBg.addComponent('render', { type: 'box' });
    healthBg.setLocalScale(1.2, 0.06, 0.12);
    const healthBgMat = new StandardMaterial();
    healthBgMat.diffuse = new Color(0.04, 0.06, 0.08);
    healthBgMat.opacity = 0.9;
    healthBgMat.update();
    healthBg.render!.material = healthBgMat;
    healthFill.addComponent('render', { type: 'box' });
    healthFill.setLocalPosition(-0.6, 0.001, 0);
    const healthFillMat = new StandardMaterial();
    healthFillMat.diffuse = new Color(0.4, 0.86, 0.62);
    healthFillMat.update();
    healthFill.render!.material = healthFillMat;
    healthBar.addChild(healthBg);
    healthBar.addChild(healthFill);
    root.addChild(healthBar);

    const view: EntityView = {
      root,
      selectionRing,
      healthBar,
      healthFill,
      material,
      isGlb,
      visualState: {
        isSelected: false,
        baseColorKey: '',
        emissiveKey: '',
        healthKey: ''
      }
    };
    this.views.set(snapshot.id, view);
    return view;
  }

  private createMarkerView(marker: FeedbackMarkerState): MarkerView {
    const root = new Entity(`Marker-${marker.id}`);
    root.addComponent('render', { type: marker.kind === 'attack' ? 'sphere' : 'cylinder' });
    const material = new StandardMaterial();
    material.diffuse = this.getMarkerColor(marker.kind);
    material.opacity = 0.8;
    material.update();
    root.render!.material = material;
    this.worldRoot.addChild(root);

    const view = {
      root,
      material,
      visualState: {
        ttlBucket: -1,
        positionKey: ''
      }
    };
    this.markerViews.set(marker.id, view);
    return view;
  }

  private createSelectionOutline(definition: EntityContentDefinition): Entity {
    const outline = new Entity('SelectionOutline');
    const width = definition.footprint.selectionRadius * 2;
    const depth = definition.footprint.selectionRadius * 2;
    const ringMaterial = new StandardMaterial();
    ringMaterial.diffuse = new Color(0.42, 0.85, 1);
    ringMaterial.emissive = new Color(0.12, 0.28, 0.34);
    ringMaterial.opacity = 0.95;
    ringMaterial.update();

    const edges = [
      { name: 'Top', x: 0, z: depth * 0.5, sx: width, sz: SELECTION_EDGE_THICKNESS },
      { name: 'Bottom', x: 0, z: -depth * 0.5, sx: width, sz: SELECTION_EDGE_THICKNESS },
      { name: 'Left', x: -width * 0.5, z: 0, sx: SELECTION_EDGE_THICKNESS, sz: depth },
      { name: 'Right', x: width * 0.5, z: 0, sx: SELECTION_EDGE_THICKNESS, sz: depth }
    ];

    for (const edge of edges) {
      const segment = new Entity(`Selection${edge.name}`);
      segment.addComponent('render', { type: 'box' });
      segment.setLocalScale(edge.sx, SELECTION_EDGE_HEIGHT, edge.sz);
      segment.setLocalPosition(edge.x, 0.05, edge.z);
      segment.render!.material = ringMaterial;
      outline.addChild(segment);
    }

    return outline;
  }

  private updateView(view: EntityView, snapshot: EntitySnapshot, isSelected: boolean, state: GameState): void {
    const definition = this.requireDefinition(snapshot.configKey);
    const scale = definition.presentation.baseScale;
    const anchor = definition.presentation.anchor;
    const buildScale = snapshot.built
      ? 1
      : Math.max(0.25, snapshot.buildTime > 0 ? snapshot.buildProgress / snapshot.buildTime : 1);
    const isVisible = snapshot.team !== TeamType.Enemy || this.isVisibleToPlayer(state, snapshot.position);

    view.root.enabled = snapshot.alive && isVisible;
    view.root.setLocalPosition(snapshot.position.x, snapshot.position.y + anchor.y * buildScale, snapshot.position.z);
    view.root.setLocalEulerAngles(0, snapshot.rotationY, 0);

    if (view.isGlb) {
      const uniformScale = scale.x * buildScale;
      view.root.setLocalScale(uniformScale, uniformScale, uniformScale);
    } else {
      const fallbackScale = snapshot.category === 'building'
        ? { x: 2.7, y: 1.7, z: 2.7 }
        : { x: 1.1, y: 1.35, z: 1.1 };
      view.root.setLocalScale(fallbackScale.x, fallbackScale.y * buildScale, fallbackScale.z);
    }

    if (view.selectionRing && view.visualState.isSelected !== isSelected) {
      view.selectionRing.enabled = isSelected;
      view.visualState.isSelected = isSelected;
    }

    if (view.material) {
      const baseColorKey = this.getBaseColorKey(snapshot);
      const emissiveKey = this.getEmissiveKey(snapshot, isSelected);
      if (baseColorKey !== view.visualState.baseColorKey || emissiveKey !== view.visualState.emissiveKey) {
        view.material.diffuse = this.getBaseColor(snapshot);
        view.material.emissive = this.getEmissiveColor(emissiveKey);
        view.material.update();
        view.visualState.baseColorKey = baseColorKey;
        view.visualState.emissiveKey = emissiveKey;
      }
    }

    const healthKey = this.getHealthKey(snapshot);
    if (healthKey !== view.visualState.healthKey) {
      const ratio = this.getHealthRatio(snapshot);
      const barWidth = 1.2 * ratio;
      view.healthFill.setLocalScale(barWidth, 0.05, 0.1);
      view.healthFill.setLocalPosition(-0.6 + barWidth * 0.5, 0.001, 0);
      const healthFillMaterial = view.healthFill.render?.material as StandardMaterial;
      healthFillMaterial.diffuse = this.getHealthColor(snapshot, ratio);
      healthFillMaterial.update();
      view.visualState.healthKey = healthKey;
    }
  }

  private getBaseColorKey(snapshot: EntitySnapshot): string {
    if (snapshot.category === 'resource') {
      return snapshot.resourceAmount > 0 ? 'resource:active' : 'resource:empty';
    }

    if (!snapshot.built) {
      return `construction:${snapshot.category}`;
    }

    return `${snapshot.category}:${snapshot.team}`;
  }

  private getBaseColor(snapshot: EntitySnapshot): Color {
    if (snapshot.category === 'resource') {
      return snapshot.resourceAmount > 0 ? new Color(0.14, 0.66, 0.76) : new Color(0.23, 0.28, 0.31);
    }

    if (!snapshot.built) {
      return new Color(0.58, 0.56, 0.41);
    }

    switch (snapshot.team) {
      case TeamType.Player:
        return snapshot.category === 'building' ? new Color(0.27, 0.47, 0.84) : new Color(0.36, 0.72, 0.96);
      case TeamType.Enemy:
        return snapshot.category === 'building' ? new Color(0.72, 0.28, 0.26) : new Color(0.9, 0.42, 0.32);
      default:
        return new Color(0.62, 0.66, 0.68);
    }
  }

  private getEmissiveKey(snapshot: EntitySnapshot, isSelected: boolean): string {
    if (snapshot.recentDamageSeconds > 0) {
      return 'damage';
    }
    void isSelected;
    return 'idle';
  }

  private getEmissiveColor(emissiveKey: string): Color {
    switch (emissiveKey) {
      case 'damage':
        return new Color(0.35, 0.08, 0.08);
      default:
        return new Color(0, 0, 0);
    }
  }

  private getHealthKey(snapshot: EntitySnapshot): string {
    const ratio = this.getHealthRatio(snapshot);
    const bucket = this.quantize(ratio, 0.02).toFixed(2);
    if (snapshot.category === 'resource') {
      return `resource:${bucket}`;
    }
    if (!snapshot.built && snapshot.buildTime > 0) {
      return `build:${bucket}`;
    }
    return `hp:${snapshot.team}:${bucket}`;
  }

  private getHealthRatio(snapshot: EntitySnapshot): number {
    const ratio = snapshot.category === 'resource'
      ? snapshot.resourceAmount / 1200
      : !snapshot.built && snapshot.buildTime > 0
        ? snapshot.buildProgress / snapshot.buildTime
        : snapshot.hp / snapshot.maxHp;
    return Math.max(0.08, Math.min(1, ratio));
  }

  private getMarkerColor(kind: FeedbackMarkerState['kind']): Color {
    switch (kind) {
      case 'attack':
        return new Color(1, 0.48, 0.32);
      case 'attackMove':
        return new Color(1, 0.75, 0.25);
      case 'gather':
        return new Color(0.2, 0.84, 0.9);
      case 'build':
        return new Color(0.95, 0.72, 0.22);
      case 'rally':
        return new Color(0.58, 0.78, 1);
      case 'patrol':
        return new Color(0.78, 0.94, 0.42);
      case 'stop':
        return new Color(0.86, 0.86, 0.86);
      case 'hold':
        return new Color(0.68, 0.88, 1);
      default:
        return new Color(0.5, 0.82, 1);
    }
  }

  private isVisibleToPlayer(state: GameState, position: EntitySnapshot['position']): boolean {
    const visibility = state.visibility;
    const cellX = Math.max(0, Math.min(
      visibility.width - 1,
      Math.floor((position.x + state.world.width * 0.5) / visibility.gridSize)
    ));
    const cellZ = Math.max(0, Math.min(
      visibility.depth - 1,
      Math.floor((position.z + state.world.depth * 0.5) / visibility.gridSize)
    ));
    return visibility.visibleCellKeys.includes(`${cellX}:${cellZ}`);
  }

  private getHealthColor(snapshot: EntitySnapshot, ratio: number): Color {
    if (snapshot.category === 'resource') {
      return new Color(0.2, 0.82, 0.9);
    }
    if (!snapshot.built && snapshot.buildTime > 0) {
      return new Color(0.95, 0.7, 0.24);
    }
    if (ratio > 0.65) {
      return snapshot.team === TeamType.Enemy ? new Color(1, 0.62, 0.5) : new Color(0.46, 0.9, 0.72);
    }
    if (ratio > 0.3) {
      return new Color(0.95, 0.78, 0.28);
    }
    return new Color(1, 0.36, 0.34);
  }

  private quantize(value: number, step: number): number {
    return Math.max(0, Math.min(1, Math.round(value / step) * step));
  }

  private getTeamColor(team: TeamType): Color {
    return TEAM_COLORS[team as unknown as string] || TEAM_COLORS[TeamType.Neutral as unknown as string];
  }

  private requireDefinition(configKey: string): EntityContentDefinition {
    const definition = this.definitionsByConfigKey.get(configKey);
    if (!definition) {
      throw new Error(`Missing entity content definition for "${configKey}".`);
    }
    return definition;
  }

  private isContainerResource(resource: unknown): resource is ContainerResourceLike {
    return typeof resource === 'object' && resource !== null && 'instantiateRenderEntity' in resource;
  }
}
