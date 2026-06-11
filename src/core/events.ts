/**
 * Game-wide event map. Systems add their events here as they land
 * (e.g. "enemy:killed", "quest:advanced", "time:nightfall").
 */
export interface GameEvents extends Record<string, unknown> {
  "game:started": Record<string, never>;
}

type Handler = (payload: unknown) => void;

export class EventBus<E extends Record<string, unknown> = GameEvents> {
  private handlers = new Map<keyof E, Set<Handler>>();

  on<K extends keyof E>(
    event: K,
    handler: (payload: E[K]) => void,
  ): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as Handler);
    return () => this.off(event, handler);
  }

  off<K extends keyof E>(event: K, handler: (payload: E[K]) => void): void {
    this.handlers.get(event)?.delete(handler as Handler);
  }

  emit<K extends keyof E>(event: K, payload: E[K]): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        handler(payload);
      }
    }
  }
}

/** The single game-wide bus. Import this everywhere except tests. */
export const events = new EventBus();
