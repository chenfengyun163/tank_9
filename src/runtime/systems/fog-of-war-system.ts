import type { EntitySnapshot, GameState, Vec3State, VisionMemoryState } from '../../core/game-state';
import { TeamType } from '../../core/team-type';

const getCellKey = (x: number, z: number): string => `${x}:${z}`;

export class FogOfWarSystem {
  public update(state: GameState): void {
    const visibility = state.visibility;
    const visibleKeys = new Set<string>();
    const exploredKeys = new Set(visibility.exploredCellKeys);

    for (const cell of visibility.cells) {
      cell.status = exploredKeys.has(getCellKey(cell.x, cell.z)) ? 'explored' : 'unseen';
    }

    for (const entityId of state.entities.allIds) {
      const entity = state.entities.byId[entityId];
      if (!entity?.alive || !entity.built || entity.team !== TeamType.Player) {
        continue;
      }

      this.revealAroundEntity(state, entity, visibleKeys, exploredKeys);
    }

    visibility.visibleCellKeys = [...visibleKeys];
    visibility.exploredCellKeys = [...exploredKeys];

    for (const entityId of state.entities.allIds) {
      const entity = state.entities.byId[entityId];
      if (!entity?.alive || entity.team !== TeamType.Enemy) {
        continue;
      }

      const isVisible = this.isPointVisible(state, entity.position);
      const existingMemory = visibility.enemyMemories[entity.id];
      if (isVisible) {
        visibility.enemyMemories[entity.id] = {
          entityId: entity.id,
          kind: entity.kind,
          category: entity.category,
          team: entity.team,
          position: { ...entity.position },
          hp: entity.hp,
          maxHp: entity.maxHp,
          visible: true,
          lastSeenAt: state.session.elapsedSeconds,
          alive: true
        };
      } else if (existingMemory) {
        existingMemory.visible = false;
      }
    }
  }

  public isPointVisible(state: GameState, point: Vec3State): boolean {
    const visibility = state.visibility;
    const cellX = Math.max(0, Math.min(visibility.width - 1, Math.floor((point.x + state.world.width * 0.5) / visibility.gridSize)));
    const cellZ = Math.max(0, Math.min(visibility.depth - 1, Math.floor((point.z + state.world.depth * 0.5) / visibility.gridSize)));
    return state.visibility.visibleCellKeys.includes(getCellKey(cellX, cellZ));
  }

  private revealAroundEntity(
    state: GameState,
    entity: EntitySnapshot,
    visibleKeys: Set<string>,
    exploredKeys: Set<string>
  ): void {
    const visibility = state.visibility;
    const gridSize = visibility.gridSize;
    const radiusCells = Math.ceil(entity.sightRange / gridSize);
    const centerCellX = Math.floor((entity.position.x + state.world.width * 0.5) / gridSize);
    const centerCellZ = Math.floor((entity.position.z + state.world.depth * 0.5) / gridSize);

    for (let dz = -radiusCells; dz <= radiusCells; dz += 1) {
      for (let dx = -radiusCells; dx <= radiusCells; dx += 1) {
        const cellX = centerCellX + dx;
        const cellZ = centerCellZ + dz;
        if (cellX < 0 || cellZ < 0 || cellX >= visibility.width || cellZ >= visibility.depth) {
          continue;
        }

        const worldPoint = {
          x: cellX * gridSize - state.world.width * 0.5 + gridSize * 0.5,
          y: 0,
          z: cellZ * gridSize - state.world.depth * 0.5 + gridSize * 0.5
        };
        if (Math.hypot(worldPoint.x - entity.position.x, worldPoint.z - entity.position.z) > entity.sightRange) {
          continue;
        }

        const key = getCellKey(cellX, cellZ);
        visibleKeys.add(key);
        exploredKeys.add(key);
        const index = cellZ * visibility.width + cellX;
        if (visibility.cells[index]) {
          visibility.cells[index].status = 'visible';
        }
      }
    }
  }
}
