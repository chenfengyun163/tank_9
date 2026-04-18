import { describe, expect, it } from 'vitest';

import { worldViewportToMinimapRect } from '../../src/ui/minimap-viewport';

describe('worldViewportToMinimapRect', () => {
  it('maps a centered world viewport into minimap space', () => {
    const rect = worldViewportToMinimapRect(
      { minX: -5, maxX: 5, minZ: -4, maxZ: 4 },
      40,
      40,
      200,
      200
    );

    expect(rect.x).toBeCloseTo(75, 5);
    expect(rect.y).toBeCloseTo(80, 5);
    expect(rect.width).toBeCloseTo(50, 5);
    expect(rect.height).toBeCloseTo(40, 5);
  });

  it('clamps a viewport that extends beyond world bounds', () => {
    const rect = worldViewportToMinimapRect(
      { minX: -30, maxX: 8, minZ: -25, maxZ: 25 },
      40,
      40,
      200,
      200
    );

    expect(rect.x).toBe(0);
    expect(rect.y).toBe(0);
    expect(rect.width).toBeCloseTo(140, 5);
    expect(rect.height).toBe(200);
  });
});
