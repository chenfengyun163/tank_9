import type {
  BuildMode,
  EconomyState,
  EntityState,
  GameState,
  OrdersState,
  ProductionState,
  SelectionState,
  SessionState,
  TeamEconomyState
} from './game-state';
import { createInitialGameState } from './game-state';
import type { TeamType } from './team-type';

export type GameStateListener = (state: GameState) => void;

export class StateStore {
  private state: GameState;
  private readonly listeners = new Set<GameStateListener>();

  public constructor(initialState: GameState = createInitialGameState()) {
    this.state = initialState;
  }

  public getSnapshot(): Readonly<GameState> {
    return this.state;
  }

  public subscribe(listener: GameStateListener): () => void {
    this.listeners.add(listener);
    listener(this.state);

    return () => {
      this.listeners.delete(listener);
    };
  }

  public replace(nextState: GameState): GameState {
    this.state = nextState;
    this.notify();
    return this.state;
  }

  public update(recipe: (draft: GameState) => GameState): GameState {
    return this.replace(recipe(structuredClone(this.state)));
  }

  public setSession(partial: Partial<SessionState>): GameState {
    return this.update((draft) => ({
      ...draft,
      session: {
        ...draft.session,
        ...partial
      }
    }));
  }

  public setSelection(selectedIds: string[]): GameState {
    return this.update((draft) => ({
      ...draft,
      selection: {
        ...draft.selection,
        selectedIds
      }
    }));
  }

  public setBuildMode(buildMode: BuildMode): GameState {
    return this.update((draft) => ({
      ...draft,
      orders: {
        ...draft.orders,
        buildMode
      }
    }));
  }

  public setQueuedCommands(queuedCommands: number): GameState {
    return this.update((draft) => ({
      ...draft,
      orders: {
        ...draft.orders,
        queuedCommands
      }
    }));
  }

  public setEntities(entities: EntityState): GameState {
    return this.update((draft) => ({
      ...draft,
      entities
    }));
  }

  public setEconomy(team: TeamType, resources: TeamEconomyState): GameState {
    return this.update((draft) => ({
      ...draft,
      economy: {
        ...draft.economy,
        byTeam: {
          ...draft.economy.byTeam,
          [team]: resources
        }
      }
    }));
  }

  public setOrders(orders: OrdersState): GameState {
    return this.update((draft) => ({
      ...draft,
      orders
    }));
  }

  public setProduction(production: ProductionState): GameState {
    return this.update((draft) => ({
      ...draft,
      production
    }));
  }

  public setSelectionSlice(selection: SelectionState): GameState {
    return this.update((draft) => ({
      ...draft,
      selection
    }));
  }

  public setEconomySlice(economy: EconomyState): GameState {
    return this.update((draft) => ({
      ...draft,
      economy
    }));
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}
