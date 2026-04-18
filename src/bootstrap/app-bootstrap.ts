import type { Application } from 'playcanvas';

import { createPlayCanvasApp } from '../platform/playcanvas/app-factory';
import { APP_CONFIG } from '../core/config';
import { GameEvents } from '../core/game-events';
import { StateStore } from '../core/state-store';
import { EntityRegistry } from '../runtime/entity-registry';
import { EnvironmentManager } from '../runtime/environment-manager';
import { GameController } from '../runtime/game-controller';
import { InputController } from '../input/input-controller';
import { HudController } from '../ui/hud-controller';
import { ASSET_MANIFEST, type AssetManifest } from './asset-manifest';
import type { DomShellResult } from './dom-shell';
import { preloadGlbAssets } from './glb-loader';
import { createWorld, type WorldFactoryResult } from './world-factory';

export interface AppBootstrapOptions {
  shell: DomShellResult;
}

export interface AppBootstrapResult {
  app: Application;
  gameEvents: GameEvents;
  stateStore: StateStore;
  assetManifest: AssetManifest;
  world: WorldFactoryResult;
  controller: GameController;
  hud: HudController;
  input: InputController;
}

export const bootstrapApp = async ({ shell }: AppBootstrapOptions): Promise<AppBootstrapResult> => {
  const app = createPlayCanvasApp(shell.canvas);
  const gameEvents = new GameEvents();
  const stateStore = new StateStore();
  const world = createWorld(app);

  EnvironmentManager.populate(app, world.worldRoot, APP_CONFIG.ground.width, APP_CONFIG.ground.depth);

  const controllerRef: { current?: GameController } = {};
  const issueMatchReset = (): void => {
    const controller = controllerRef.current;
    if (!controller) {
      return;
    }

    controller.enqueueCommand({
      id: controller.createCommandId(),
      source: 'player',
      type: 'restart'
    });
  };
  const issueMatchStart = (): void => {
    const controller = controllerRef.current;
    if (!controller) {
      return;
    }

    controller.enqueueCommand({
      id: controller.createCommandId(),
      source: 'player',
      type: 'start'
    });
  };
  const hud = new HudController(shell, {
    onStartGame: issueMatchStart,
    onRestart: issueMatchReset,
    onBuildMode: (mode) => {
      controllerRef.current?.setBuildMode(mode);
    },
    onEnterAttackMoveMode: () => {
      controllerRef.current?.setCommandMode('attackMove');
    },
    onEnterPatrolMode: () => {
      controllerRef.current?.setCommandMode('patrol');
    },
    onEnterRallyPointMode: () => {
      controllerRef.current?.setCommandMode('setRallyPoint');
    },
    onProduce: (buildingId, unitKind) => {
      controllerRef.current?.enqueueCommand({
        id: controllerRef.current.createCommandId(),
        source: 'player',
        type: 'produce',
        buildingId,
        unitKind
      });
    },
    onResearch: (buildingId, techId) => {
      controllerRef.current?.enqueueCommand({
        id: controllerRef.current.createCommandId(),
        source: 'player',
        type: 'research',
        buildingId,
        techId
      });
    }
  });

  stateStore.subscribe((state) => {
    hud.render(state);
  });
  hud.render(stateStore.getSnapshot());

  app.start();

  const glbAssets = await preloadGlbAssets(app, ASSET_MANIFEST, (progress) => {
    stateStore.update((nextState) => {
      nextState.session.loadingProgress = progress;
      return nextState;
    });
  });

  const registry = new EntityRegistry(app, world.worldRoot, ASSET_MANIFEST, glbAssets);
  const controller = new GameController({
    app,
    world,
    stateStore,
    gameEvents,
    assetManifest: ASSET_MANIFEST,
    registry
  });
  controllerRef.current = controller;

  const input = new InputController({
    app,
    shell,
    camera: world.camera,
    getState: () => stateStore.getSnapshot(),
    dispatchCommand: (command) => controller.enqueueCommand(command),
    setBuildMode: (mode) => controller.setBuildMode(mode),
    setCommandMode: (mode) => controller.setCommandMode(mode),
    createCommandId: () => controller.createCommandId(),
    onCameraChanged: (cameraState) => hud.setCameraState(cameraState)
  });

  return {
    app,
    gameEvents,
    stateStore,
    assetManifest: ASSET_MANIFEST,
    world,
    controller,
    hud,
    input
  };
};
