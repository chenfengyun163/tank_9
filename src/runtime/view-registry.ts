import type { GameState } from '../core/game-state';

export interface RuntimeViewRegistry {
  clear(): void;
  sync(state: GameState, selectedIds: Set<string>): void;
  unregister(entityId: string): void;
}
