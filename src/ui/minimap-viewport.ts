export interface WorldViewportRect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface MinimapViewportRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export const worldViewportToMinimapRect = (
  viewport: WorldViewportRect,
  worldWidth: number,
  worldDepth: number,
  minimapWidth: number,
  minimapHeight: number
): MinimapViewportRect => {
  const halfWorldWidth = worldWidth * 0.5;
  const halfWorldDepth = worldDepth * 0.5;

  const minX = clamp(viewport.minX, -halfWorldWidth, halfWorldWidth);
  const maxX = clamp(viewport.maxX, -halfWorldWidth, halfWorldWidth);
  const minZ = clamp(viewport.minZ, -halfWorldDepth, halfWorldDepth);
  const maxZ = clamp(viewport.maxZ, -halfWorldDepth, halfWorldDepth);

  return {
    x: ((minX + halfWorldWidth) / worldWidth) * minimapWidth,
    y: ((minZ + halfWorldDepth) / worldDepth) * minimapHeight,
    width: Math.max(2, ((maxX - minX) / worldWidth) * minimapWidth),
    height: Math.max(2, ((maxZ - minZ) / worldDepth) * minimapHeight)
  };
};
