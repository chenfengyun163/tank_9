import type { GameState } from '../core/game-state';
import { TeamType } from '../core/team-type';

export const updateVictoryState = (state: GameState): void => {
  if (state.session.phase !== 'playing') {
    return;
  }

  const hasPlayerBase = state.entities.allIds.some((id) => {
    const entity = state.entities.byId[id];
    return entity?.alive && entity.team === TeamType.Player && entity.kind === 'mainBase';
  });
  const hasEnemyBase = state.entities.allIds.some((id) => {
    const entity = state.entities.byId[id];
    return entity?.alive && entity.team === TeamType.Enemy && entity.kind === 'mainBase';
  });

  if (!hasPlayerBase) {
    state.session.phase = 'defeat';
    state.session.winner = TeamType.Enemy;
    state.session.message = '我方主基地已被摧毁，本局失败。';
    return;
  }

  if (!hasEnemyBase) {
    state.session.phase = 'victory';
    state.session.winner = TeamType.Player;
    state.session.message = '敌方主基地已被摧毁，本局胜利。';
  }
};
