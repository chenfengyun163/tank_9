import {
  Color,
  Entity,
  StandardMaterial,
  type AppBase
} from 'playcanvas';

import { APP_CONFIG } from '../core/config';

export interface WorldFactoryResult {
  appRoot: Entity;
  worldRoot: Entity;
  camera: Entity;
  light: Entity;
  ground: Entity;
  referenceMarker: Entity;
}

export const createWorld = (app: AppBase): WorldFactoryResult => {
  const appRoot = new Entity('AppRoot');
  const worldRoot = new Entity('WorldRoot');
  appRoot.addChild(worldRoot);
  app.root.addChild(appRoot);

  app.scene.ambientLight = new Color(0.35, 0.42, 0.48);

  const camera = new Entity('MainCamera');
  camera.addComponent('camera', {
    clearColor: new Color(0.18, 0.22, 0.28),
    farClip: 160
  });
  camera.setLocalPosition(
    APP_CONFIG.camera.position.x,
    APP_CONFIG.camera.position.y,
    APP_CONFIG.camera.position.z
  );
  camera.lookAt(
    APP_CONFIG.camera.lookAt.x,
    APP_CONFIG.camera.lookAt.y,
    APP_CONFIG.camera.lookAt.z
  );
  worldRoot.addChild(camera);

  const light = new Entity('KeyLight');
  light.addComponent('light', {
    type: 'directional',
    intensity: 1.6,
    castShadows: true,
    shadowBias: 0.05,
    shadowDistance: 60,
    shadowResolution: 2048
  });
  light.setLocalEulerAngles(55, 35, 0);
  worldRoot.addChild(light);

  const ground = new Entity('Ground');
  ground.addComponent('render', {
    type: 'box',
    castShadows: false,
    receiveShadows: true
  });
  ground.setLocalScale(
    APP_CONFIG.ground.width,
    APP_CONFIG.ground.thickness,
    APP_CONFIG.ground.depth
  );

  const groundMaterial = new StandardMaterial();
  groundMaterial.diffuse = new Color(0.25, 0.36, 0.18);
  groundMaterial.specular = new Color(0.05, 0.05, 0.05);
  groundMaterial.update();
  ground.render!.material = groundMaterial;
  worldRoot.addChild(ground);

  const gridRoot = new Entity('GroundGrid');
  const gridStep = 4;
  const gridLimit = Math.floor((Math.min(APP_CONFIG.ground.width, APP_CONFIG.ground.depth) * 0.5) / gridStep) * gridStep;
  const gridMaterial = new StandardMaterial();
  gridMaterial.diffuse = new Color(0.31, 0.45, 0.24);
  gridMaterial.emissive = new Color(0.03, 0.05, 0.02);
  gridMaterial.opacity = 0.18;
  gridMaterial.update();

  const gridCenterMaterial = new StandardMaterial();
  gridCenterMaterial.diffuse = new Color(0.31, 0.45, 0.24);
  gridCenterMaterial.emissive = new Color(0.03, 0.05, 0.02);
  gridCenterMaterial.opacity = 0.32;
  gridCenterMaterial.update();

  for (let index = -gridLimit; index <= gridLimit; index += gridStep) {
    const lineX = new Entity(`GridX-${index}`);
    lineX.addComponent('render', { type: 'box' });
    lineX.setLocalScale(0.05, 0.01, APP_CONFIG.ground.depth * 0.92);
    lineX.setLocalPosition(index, 0.14, 0);
    lineX.render!.material = index === 0 ? gridCenterMaterial : gridMaterial;

    const lineZ = new Entity(`GridZ-${index}`);
    lineZ.addComponent('render', { type: 'box' });
    lineZ.setLocalScale(APP_CONFIG.ground.width * 0.92, 0.01, 0.05);
    lineZ.setLocalPosition(0, 0.14, index);
    lineZ.render!.material = index === 0 ? gridCenterMaterial : gridMaterial;
    gridRoot.addChild(lineX);
    gridRoot.addChild(lineZ);
  }
  worldRoot.addChild(gridRoot);

  const referenceMarker = new Entity('ReferenceMarker');
  referenceMarker.addComponent('render', {
    type: 'box'
  });
  referenceMarker.setLocalPosition(0, 0.9, 0);
  referenceMarker.setLocalScale(0.6, 1.8, 0.6);

  const referenceMaterial = new StandardMaterial();
  referenceMaterial.diffuse = new Color(0.9, 0.58, 0.16);
  referenceMaterial.update();
  referenceMarker.render!.material = referenceMaterial;
  referenceMarker.enabled = false;
  worldRoot.addChild(referenceMarker);

  return {
    appRoot,
    worldRoot,
    camera,
    light,
    ground,
    referenceMarker
  };
};
