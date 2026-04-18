import type { GameState, SessionPhase } from './game-state';

export interface StateChangedEvent {
  readonly state: GameState;
}

export interface NotificationEvent {
  readonly message: string;
}

export interface MatchEndedEvent {
  readonly phase: SessionPhase;
}

export interface GameEventMap {
  'state:changed': StateChangedEvent;
  notification: NotificationEvent;
  'match:ended': MatchEndedEvent;
}

type EventKey = keyof GameEventMap;
type EventHandler<K extends EventKey> = (payload: GameEventMap[K]) => void;

export class GameEvents {
  private readonly listeners = new Map<EventKey, Set<EventHandler<EventKey>>>();

  public on<K extends EventKey>(eventName: K, handler: EventHandler<K>): () => void {
    const existing = this.listeners.get(eventName) ?? new Set<EventHandler<EventKey>>();
    existing.add(handler as EventHandler<EventKey>);
    this.listeners.set(eventName, existing);

    return () => {
      existing.delete(handler as EventHandler<EventKey>);

      if (existing.size === 0) {
        this.listeners.delete(eventName);
      }
    };
  }

  public emit<K extends EventKey>(eventName: K, payload: GameEventMap[K]): void {
    const handlers = this.listeners.get(eventName);

    if (!handlers) {
      return;
    }

    handlers.forEach((handler) => {
      handler(payload as GameEventMap[EventKey]);
    });
  }
}
