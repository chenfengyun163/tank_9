import type { AssetManifest } from '../bootstrap/asset-manifest';
import type { GameState, Vec3State } from '../core/game-state';

export const isPlacementValid = (
  state: GameState,
  assetManifest: AssetManifest,
  pos: Vec3State,
  configKey: string
): boolean => {
  const definition = [...assetManifest.buildings, ...assetManifest.resources, ...assetManifest.units]
    .find((entry) => entry.configKey === configKey);
  const requestedRadius = definition?.footprint.colliderRadius ?? 1.5;

  for (const id of state.entities.allIds) {
    const entity = state.entities.byId[id];
    if (!entity?.alive) {
      continue;
    }

    const distance = Math.hypot(entity.position.x - pos.x, entity.position.z - pos.z);
    if (distance < requestedRadius + entity.footprint.colliderRadius) {
      return false;
    }
  }

  return true;
};
