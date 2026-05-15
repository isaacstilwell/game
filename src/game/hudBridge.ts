type HudEvent =
  | { type: 'hp-update';       value: number }
  | { type: 'shield-update';   value: number }
  | { type: 'enemy-count';     value: number }
  | { type: 'kill-count';      value: number }
  | { type: 'wave-clear';      kills: number }
  | { type: 'asteroid-clear';  kills: number }
  | { type: 'player-dead';     kills: number }
  | { type: 'wave2-progress';  loaded: number; total: number }
  | { type: 'ammo-update';     value: number }
  | { type: 'wave2-ready' }
  | { type: 'landing-complete'; kills: number };

type Listener = (event: HudEvent) => void;

// Event types that should replay their last value to new subscribers.
const REPLAY_TYPES = new Set([
  'hp-update', 'shield-update', 'ammo-update', 'enemy-count', 'kill-count',
]);

class HudBridge {
  private listeners  = new Map<string, Set<Listener>>();
  private lastValues = new Map<string, HudEvent>();

  emit(event: HudEvent): void {
    if (REPLAY_TYPES.has(event.type)) this.lastValues.set(event.type, event);
    this.listeners.get(event.type)?.forEach(fn => fn(event));
  }

  on<T extends HudEvent['type']>(
    type: T,
    listener: (event: Extract<HudEvent, { type: T }>) => void,
  ): () => void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener as Listener);
    // Replay the last value immediately so late-mounting subscribers stay in sync.
    const last = this.lastValues.get(type);
    if (last) listener(last as Extract<HudEvent, { type: T }>);
    return () => this.listeners.get(type)!.delete(listener as Listener);
  }
}

export const hudBridge = new HudBridge();
