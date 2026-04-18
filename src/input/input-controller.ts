import { Vec3, type Application, type Entity } from 'playcanvas';

import type { DomShellResult } from '../bootstrap/dom-shell';
import { APP_CONFIG } from '../core/config';
import type { GameCommand } from '../core/command-types';
import type { BuildMode, CommandMode, EntitySnapshot, GameState, Vec3State } from '../core/game-state';
import { TeamType } from '../core/team-type';
import type { HudCameraState } from '../ui/hud-controller';

interface InputControllerOptions {
  app: Application;
  shell: DomShellResult;
  camera: Entity;
  getState(): Readonly<GameState>;
  dispatchCommand(command: GameCommand): void;
  setBuildMode(mode: BuildMode): void;
  setCommandMode(mode: CommandMode): void;
  createCommandId(): string;
  onCameraChanged?(cameraState: HudCameraState): void;
}

export class InputController {
  private readonly pressedKeys = new Set<string>();
  private readonly baseCameraOffset: Vec3State = {
    x: APP_CONFIG.camera.position.x - APP_CONFIG.camera.lookAt.x,
    y: APP_CONFIG.camera.position.y - APP_CONFIG.camera.lookAt.y,
    z: APP_CONFIG.camera.position.z - APP_CONFIG.camera.lookAt.z
  };
  private isDraggingSelection = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragCurrentX = 0;
  private dragCurrentY = 0;
  private cameraFocus: { x: number; z: number } = {
    x: APP_CONFIG.camera.lookAt.x,
    z: APP_CONFIG.camera.lookAt.z
  };
  private cameraZoom = 1;
  private pointerClientX = 0;
  private pointerClientY = 0;
  private lastClickedEntityId: string | null = null;
  private lastClickTime = 0;
  private lastControlGroupTap: { groupIndex: number; time: number } | null = null;
  private readonly onContextMenu = (event: Event): void => event.preventDefault();

  public constructor(private readonly options: InputControllerOptions) {
    if (!this.options.app.mouse) {
      throw new Error('Mouse input is required for the RTS input controller.');
    }

    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointerleave', this.onPointerLeave);
    this.canvas.addEventListener('contextmenu', this.onContextMenu);
    this.options.shell.appRoot.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('pointerup', this.onWindowPointerUp);
    window.addEventListener('blur', this.clearTransientInput);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.options.app.on('update', this.onUpdate, this);
    this.syncCameraTransform();
  }

  public dispose(): void {
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    this.options.shell.appRoot.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('pointerup', this.onWindowPointerUp);
    window.removeEventListener('blur', this.clearTransientInput);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.options.app.off('update', this.onUpdate, this);
  }

  private get canvas(): HTMLCanvasElement {
    return this.options.shell.canvas;
  }

  private onPointerDown = (event: PointerEvent): void => {
    this.pointerClientX = event.clientX;
    this.pointerClientY = event.clientY;
    if (event.button !== 0) {
      return;
    }

    this.dragStartX = event.offsetX;
    this.dragStartY = event.offsetY;
    this.dragCurrentX = event.offsetX;
    this.dragCurrentY = event.offsetY;
    this.isDraggingSelection = true;
    this.updateMarquee();
  };

  private onPointerMove = (event: PointerEvent): void => {
    this.pointerClientX = event.clientX;
    this.pointerClientY = event.clientY;
    if (!this.isDraggingSelection) {
      return;
    }

    this.dragCurrentX = event.offsetX;
    this.dragCurrentY = event.offsetY;
    this.updateMarquee();
  };

  private onPointerUp = (event: PointerEvent): void => {
    this.pointerClientX = event.clientX;
    this.pointerClientY = event.clientY;

    if (event.button === 0 && this.isDraggingSelection) {
      this.handleLeftPointerUp(event);
    }

    if (event.button === 2) {
      this.handleRightPointerUp(event);
    }
  };

  private onPointerLeave = (event: PointerEvent): void => {
    this.pointerClientX = event.clientX;
    this.pointerClientY = event.clientY;
    if (this.isDraggingSelection) {
      this.handleLeftPointerUp(event);
    }
  };

  private handleLeftPointerUp(event: PointerEvent): void {
    if (!this.isDraggingSelection) {
      return;
    }

    this.dragCurrentX = event.offsetX;
    this.dragCurrentY = event.offsetY;
    this.isDraggingSelection = false;
    this.options.shell.marquee.style.display = 'none';

    const dragDistance = Math.hypot(this.dragCurrentX - this.dragStartX, this.dragCurrentY - this.dragStartY);
    if (dragDistance < 6) {
      const state = this.options.getState();
      const target = this.findEntityNearPointer(event.offsetX, event.offsetY, state);
      if (target && target.team === TeamType.Player) {
        const now = performance.now();
        const isDoubleClick = this.lastClickedEntityId === target.id
          && now - this.lastClickTime <= APP_CONFIG.camera.doubleClickMs;
        this.lastClickedEntityId = target.id;
        this.lastClickTime = now;

        const entityIds = isDoubleClick
          ? this.findVisibleFriendlyByKind(state, target.kind).map((entity) => entity.id)
          : [target.id];

        this.options.dispatchCommand({
          id: this.options.createCommandId(),
          source: 'player',
          type: 'select',
          entityIds
        });
      } else {
        this.options.dispatchCommand({
          id: this.options.createCommandId(),
          source: 'player',
          type: 'select',
          entityIds: []
        });
      }
      return;
    }

    const state = this.options.getState();
    const rect = this.createSelectionRect();
    const selectedIds: string[] = [];

    for (const entityId of state.entities.allIds) {
      const entity = state.entities.byId[entityId];
      if (!entity?.alive || !entity.built || entity.team !== TeamType.Player) {
        continue;
      }

      const screenPoint = this.options.camera.camera?.worldToScreen(
        new Vec3(entity.position.x, entity.position.y + 0.5, entity.position.z)
      );
      if (!screenPoint) {
        continue;
      }

      if (
        screenPoint.x >= rect.left &&
        screenPoint.x <= rect.right &&
        screenPoint.y >= rect.top &&
        screenPoint.y <= rect.bottom
      ) {
        selectedIds.push(entity.id);
      }
    }

    this.options.dispatchCommand({
      id: this.options.createCommandId(),
      source: 'player',
      type: 'select',
      entityIds: selectedIds
    });
  }

  private handleRightPointerUp(event: PointerEvent): void {
    const state = this.options.getState();
    if (state.session.phase !== 'playing') {
      return;
    }

    const selectedIds = state.selection.selectedIds.filter((id) => {
      const entity = state.entities.byId[id];
      return Boolean(entity?.alive && entity.team === TeamType.Player);
    });
    if (selectedIds.length === 0) {
      return;
    }

    const groundPoint = this.screenToGround(event.offsetX, event.offsetY);
    if (!groundPoint) {
      return;
    }

    const isQueueing = event.shiftKey || this.pressedKeys.has('ShiftLeft') || this.pressedKeys.has('ShiftRight');

    if (state.orders.commandMode === 'setRallyPoint') {
      const buildingId = selectedIds.find((id) => {
        const entity = state.entities.byId[id];
        return entity?.category === 'building' && entity.productionKinds.length > 0;
      });
      if (!buildingId) {
        this.options.setCommandMode('none');
        return;
      }

      this.options.dispatchCommand({
        id: this.options.createCommandId(),
        source: 'player',
        type: 'setRallyPoint',
        buildingId,
        target: groundPoint
      });
      return;
    }

    if (state.orders.buildMode !== 'none') {
      const workerIds = selectedIds.filter((id) => state.entities.byId[id]?.kind === 'worker');
      if (workerIds.length === 0) {
        this.options.setBuildMode('none');
        return;
      }

      this.options.dispatchCommand({
        id: this.options.createCommandId(),
        source: 'player',
        type: 'build',
        entityIds: workerIds,
        buildingConfigKey: state.orders.buildMode,
        target: groundPoint
      });
      return;
    }

    if (state.orders.commandMode === 'patrol') {
      this.options.dispatchCommand({
        id: this.options.createCommandId(),
        source: 'player',
        type: 'patrol',
        entityIds: selectedIds,
        target: groundPoint,
        queue: isQueueing
      });
      return;
    }

    const target = this.findEntityNearWorldPoint(groundPoint, state);
    if (state.orders.commandMode === 'attackMove') {
      this.options.dispatchCommand({
        id: this.options.createCommandId(),
        source: 'player',
        type: 'attackMove',
        entityIds: selectedIds,
        target: target?.team === TeamType.Enemy ? target.position : groundPoint,
        queue: isQueueing
      });
      return;
    }

    if (target?.team === TeamType.Enemy) {
      this.options.dispatchCommand({
        id: this.options.createCommandId(),
        source: 'player',
        type: 'attack',
        entityIds: selectedIds,
        targetEntityId: target.id,
        queue: isQueueing
      });
      return;
    }

    const workersSelected = selectedIds.some((id) => state.entities.byId[id]?.kind === 'worker');
    if (target?.category === 'resource' && workersSelected) {
      this.options.dispatchCommand({
        id: this.options.createCommandId(),
        source: 'player',
        type: 'gather',
        entityIds: selectedIds,
        targetEntityId: target.id,
        queue: isQueueing
      });
      return;
    }

    if (target?.team === TeamType.Player && workersSelected && target.hp < target.maxHp) {
      this.options.dispatchCommand({
        id: this.options.createCommandId(),
        source: 'player',
        type: 'repair',
        entityIds: selectedIds,
        targetEntityId: target.id
      });
      return;
    }

    this.options.dispatchCommand({
      id: this.options.createCommandId(),
      source: 'player',
      type: 'move',
      entityIds: selectedIds,
      target: groundPoint,
      queue: isQueueing
    });
  }

  private onUpdate(dt: number): void {
    this.syncBuildModeWithSelection();

    const horizontal = this.getKeyAxis(['KeyD', 'ArrowRight']) - this.getKeyAxis(['KeyA', 'ArrowLeft']);
    const vertical = this.getKeyAxis(['KeyS', 'ArrowDown']) - this.getKeyAxis(['KeyW', 'ArrowUp']);
    const edge = this.getEdgePanVector();
    const combinedX = horizontal + edge.x;
    const combinedZ = vertical + edge.z;
    if (combinedX === 0 && combinedZ === 0) {
      return;
    }

    const distance = Math.hypot(combinedX, combinedZ) || 1;
    const moveSpeed = APP_CONFIG.camera.panSpeed * this.cameraZoom * dt;
    this.cameraFocus.x += (combinedX / distance) * moveSpeed;
    this.cameraFocus.z += (combinedZ / distance) * moveSpeed;
    this.clampCameraFocus();
    this.syncCameraTransform();
  }

  private onWindowPointerUp = (event: PointerEvent): void => {
    if (!this.isDraggingSelection || event.button !== 0) {
      return;
    }

    if (event.target instanceof Node && this.options.shell.appRoot.contains(event.target)) {
      return;
    }

    this.cancelSelectionDrag();
  };

  private onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const direction = Math.sign(event.deltaY);
    const nextZoom = this.cameraZoom + direction * APP_CONFIG.camera.zoomStep;
    this.cameraZoom = Math.min(APP_CONFIG.camera.maxZoom, Math.max(APP_CONFIG.camera.minZoom, nextZoom));
    this.syncCameraTransform();
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    this.pressedKeys.add(event.code);

    if (event.repeat) {
      return;
    }

    if (this.tryHandleControlGroupHotkey(event)) {
      event.preventDefault();
      return;
    }

    if (event.code === 'KeyA') {
      this.options.setCommandMode('attackMove');
      event.preventDefault();
      return;
    }

    if (event.code === 'KeyP') {
      this.options.setCommandMode('patrol');
      event.preventDefault();
      return;
    }

    if (event.code === 'KeyR') {
      const state = this.options.getState();
      const hasProductionBuilding = state.selection.selectedIds.some((id) => {
        const entity = state.entities.byId[id];
        return entity?.alive && entity.category === 'building' && entity.productionKinds.length > 0;
      });
      if (hasProductionBuilding) {
        this.options.setCommandMode('setRallyPoint');
        event.preventDefault();
      }
      return;
    }

    if (event.code === 'KeyS') {
      this.issueUnitCommand('stop');
      event.preventDefault();
      return;
    }

    if (event.code === 'KeyH') {
      this.issueUnitCommand('holdPosition');
      event.preventDefault();
      return;
    }

    if (event.code === 'KeyV') {
      this.options.dispatchCommand({
        id: this.options.createCommandId(),
        source: 'player',
        type: 'toggleVisionDebug'
      });
      event.preventDefault();
      return;
    }

    if (event.code === 'Escape') {
      this.options.setCommandMode('none');
      this.options.setBuildMode('none');
    }
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    this.pressedKeys.delete(event.code);
  };

  private onVisibilityChange = (): void => {
    if (document.visibilityState !== 'visible') {
      this.clearTransientInput();
    }
  };

  private clearTransientInput = (): void => {
    this.pressedKeys.clear();
    this.cancelSelectionDrag();
  };

  private updateMarquee(): void {
    const rect = this.createSelectionRect();
    const marquee = this.options.shell.marquee;
    marquee.style.display = 'block';
    marquee.style.left = `${rect.left}px`;
    marquee.style.top = `${rect.top}px`;
    marquee.style.width = `${rect.right - rect.left}px`;
    marquee.style.height = `${rect.bottom - rect.top}px`;
  }

  private createSelectionRect(): { left: number; top: number; right: number; bottom: number } {
    return {
      left: Math.min(this.dragStartX, this.dragCurrentX),
      top: Math.min(this.dragStartY, this.dragCurrentY),
      right: Math.max(this.dragStartX, this.dragCurrentX),
      bottom: Math.max(this.dragStartY, this.dragCurrentY)
    };
  }

  private screenToGround(screenX: number, screenY: number): Vec3State | null {
    const camera = this.options.camera.camera;
    if (!camera) {
      return null;
    }

    const start = camera.screenToWorld(screenX, screenY, camera.nearClip);
    const end = camera.screenToWorld(screenX, screenY, camera.farClip);
    const direction = end.clone().sub(start);
    if (Math.abs(direction.y) < 0.0001) {
      return null;
    }

    const distanceToGround = -start.y / direction.y;
    if (distanceToGround < 0) {
      return null;
    }

    const world = start.add(direction.mulScalar(distanceToGround));
    return { x: world.x, y: 0, z: world.z };
  }

  private findEntityNearPointer(screenX: number, screenY: number, state: Readonly<GameState>): EntitySnapshot | null {
    const groundPoint = this.screenToGround(screenX, screenY);
    if (!groundPoint) {
      return null;
    }

    return this.findEntityNearWorldPoint(groundPoint, state);
  }

  private findEntityNearWorldPoint(point: Vec3State, state: Readonly<GameState>): EntitySnapshot | null {
    let nearest: EntitySnapshot | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const entityId of state.entities.allIds) {
      const entity = state.entities.byId[entityId];
      if (!entity || !entity.alive || !entity.built) {
        continue;
      }
      if (entity.team === TeamType.Enemy && !this.isVisibleToPlayer(state, entity)) {
        continue;
      }

      const distance = Math.hypot(point.x - entity.position.x, point.z - entity.position.z);
      const maxDistance = entity.selectionRadius + 0.45;
      if (distance <= maxDistance && distance < nearestDistance) {
        nearest = entity;
        nearestDistance = distance;
      }
    }

    return nearest;
  }

  private findVisibleFriendlyByKind(state: Readonly<GameState>, kind: EntitySnapshot['kind']): EntitySnapshot[] {
    const camera = this.options.camera.camera;
    if (!camera) {
      return [];
    }

    return state.entities.allIds
      .map((id) => state.entities.byId[id])
      .filter((entity): entity is EntitySnapshot => Boolean(
        entity?.alive && entity.built && entity.team === TeamType.Player && entity.kind === kind
      ))
      .filter((entity) => {
        const screenPoint = camera.worldToScreen(new Vec3(entity.position.x, entity.position.y + 0.5, entity.position.z));
        return screenPoint.x >= 0
          && screenPoint.x <= this.canvas.clientWidth
          && screenPoint.y >= 0
          && screenPoint.y <= this.canvas.clientHeight;
      });
  }

  private cancelSelectionDrag(): void {
    this.isDraggingSelection = false;
    this.options.shell.marquee.style.display = 'none';
  }

  private getKeyAxis(codes: string[]): number {
    return codes.some((code) => this.pressedKeys.has(code)) ? 1 : 0;
  }

  private getEdgePanVector(): { x: number; z: number } {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return { x: 0, z: 0 };
    }

    const threshold = APP_CONFIG.camera.edgePanThreshold;
    const localX = this.pointerClientX - rect.left;
    const localY = this.pointerClientY - rect.top;
    let x = 0;
    let z = 0;

    if (localX >= 0 && localX < threshold) {
      x = -APP_CONFIG.camera.edgePanStrength;
    } else if (localX <= rect.width && localX > rect.width - threshold) {
      x = APP_CONFIG.camera.edgePanStrength;
    }

    if (localY >= 0 && localY < threshold) {
      z = -APP_CONFIG.camera.edgePanStrength;
    } else if (localY <= rect.height && localY > rect.height - threshold) {
      z = APP_CONFIG.camera.edgePanStrength;
    }

    return { x, z };
  }

  private clampCameraFocus(): void {
    const limitX = APP_CONFIG.ground.width * 0.5 - APP_CONFIG.camera.boundsPadding;
    const limitZ = APP_CONFIG.ground.depth * 0.5 - APP_CONFIG.camera.boundsPadding;
    this.cameraFocus.x = Math.max(-limitX, Math.min(limitX, this.cameraFocus.x));
    this.cameraFocus.z = Math.max(-limitZ, Math.min(limitZ, this.cameraFocus.z));
  }

  private syncCameraTransform(): void {
    const cameraOffset: Vec3State = {
      x: this.baseCameraOffset.x * this.cameraZoom,
      y: this.baseCameraOffset.y * this.cameraZoom,
      z: this.baseCameraOffset.z * this.cameraZoom
    };

    this.options.camera.setLocalPosition(
      this.cameraFocus.x + cameraOffset.x,
      cameraOffset.y,
      this.cameraFocus.z + cameraOffset.z
    );
    this.options.camera.lookAt(this.cameraFocus.x, 0, this.cameraFocus.z);
    this.options.onCameraChanged?.({
      focus: { ...this.cameraFocus },
      zoom: this.cameraZoom,
      viewportWorldRect: this.getCameraWorldRect()
    });
  }

  private getCameraWorldRect(): HudCameraState['viewportWorldRect'] {
    const topLeft = this.screenToGround(0, 0);
    const topRight = this.screenToGround(this.canvas.clientWidth, 0);
    const bottomLeft = this.screenToGround(0, this.canvas.clientHeight);
    const bottomRight = this.screenToGround(this.canvas.clientWidth, this.canvas.clientHeight);
    const points = [topLeft, topRight, bottomLeft, bottomRight].filter((point): point is Vec3State => Boolean(point));

    if (points.length === 0) {
      return {
        minX: this.cameraFocus.x - 8,
        maxX: this.cameraFocus.x + 8,
        minZ: this.cameraFocus.z - 7,
        maxZ: this.cameraFocus.z + 7
      };
    }

    return {
      minX: Math.min(...points.map((point) => point.x)),
      maxX: Math.max(...points.map((point) => point.x)),
      minZ: Math.min(...points.map((point) => point.z)),
      maxZ: Math.max(...points.map((point) => point.z))
    };
  }

  private syncBuildModeWithSelection(): void {
    const state = this.options.getState();
    if (state.orders.buildMode === 'none' && state.orders.commandMode === 'none') {
      return;
    }

    const selectedEntities = state.selection.selectedIds
      .map((id) => state.entities.byId[id])
      .filter((entity): entity is EntitySnapshot => Boolean(entity?.alive && entity.team === TeamType.Player));

    if (
      state.orders.buildMode !== 'none'
      && selectedEntities.some((entity) => entity.kind !== 'worker')
    ) {
      this.options.setBuildMode('none');
    }

    if (
      state.orders.commandMode === 'setRallyPoint'
      && !selectedEntities.some((entity) => entity.category === 'building' && entity.productionKinds.length > 0)
    ) {
      this.options.setCommandMode('none');
    }
  }

  private tryHandleControlGroupHotkey(event: KeyboardEvent): boolean {
    const groupIndex = this.getControlGroupIndex(event.code);
    if (groupIndex === null) {
      return false;
    }

    const state = this.options.getState();
    if (event.ctrlKey) {
      this.options.dispatchCommand({
        id: this.options.createCommandId(),
        source: 'player',
        type: 'assignControlGroup',
        groupIndex,
        entityIds: [...state.selection.selectedIds]
      });
      return true;
    }

    this.options.dispatchCommand({
      id: this.options.createCommandId(),
      source: 'player',
      type: 'recallControlGroup',
      groupIndex
    });

    const now = performance.now();
    if (
      this.lastControlGroupTap?.groupIndex === groupIndex
      && now - this.lastControlGroupTap.time <= APP_CONFIG.camera.controlGroupJumpSeconds * 1000
    ) {
      this.jumpCameraToControlGroup(state, groupIndex);
    }
    this.lastControlGroupTap = { groupIndex, time: now };
    return true;
  }

  private getControlGroupIndex(code: string): number | null {
    if (code === 'Digit0') {
      return 0;
    }
    if (/^Digit[1-9]$/.test(code)) {
      return Number(code.at(-1));
    }
    return null;
  }

  private jumpCameraToControlGroup(state: Readonly<GameState>, groupIndex: number): void {
    const units = (state.controlGroups.groups[groupIndex] ?? [])
      .map((id) => state.entities.byId[id])
      .filter((entity): entity is EntitySnapshot => Boolean(entity?.alive && entity.team === TeamType.Player));
    if (units.length === 0) {
      return;
    }

    const center = units.reduce(
      (sum, entity) => ({
        x: sum.x + entity.position.x,
        z: sum.z + entity.position.z
      }),
      { x: 0, z: 0 }
    );
    this.cameraFocus.x = center.x / units.length;
    this.cameraFocus.z = center.z / units.length;
    this.clampCameraFocus();
    this.syncCameraTransform();
  }

  private issueUnitCommand(type: 'stop' | 'holdPosition'): void {
    const state = this.options.getState();
    const entityIds = state.selection.selectedIds.filter((id) => state.entities.byId[id]?.category === 'unit');
    if (entityIds.length === 0) {
      return;
    }

    this.options.dispatchCommand({
      id: this.options.createCommandId(),
      source: 'player',
      type,
      entityIds
    });
  }

  private isVisibleToPlayer(state: Readonly<GameState>, entity: EntitySnapshot): boolean {
    const visibility = state.visibility;
    const cellX = Math.max(0, Math.min(visibility.width - 1, Math.floor((entity.position.x + state.world.width * 0.5) / visibility.gridSize)));
    const cellZ = Math.max(0, Math.min(visibility.depth - 1, Math.floor((entity.position.z + state.world.depth * 0.5) / visibility.gridSize)));
    return visibility.visibleCellKeys.includes(`${cellX}:${cellZ}`);
  }
}
