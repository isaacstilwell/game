type HudEvent =
  | { type: 'hp-update';     value: number }
  | { type: 'shield-update'; value: number }
  | { type: 'enemy-count';   value: number }
  | { type: 'kill-count';    value: number }
  | { type: 'wave-clear';    kills: number; escaped: number }
  | { type: 'player-dead';   kills: number };

type Listener = (event: HudEvent) => void;

class HudBridge {
  private listeners = new Map<string, Set<Listener>>();

  emit(event: HudEvent): void {
    this.listeners.get(event.type)?.forEach(fn => fn(event));
  }

  on<T extends HudEvent['type']>(
    type: T,
    listener: (event: Extract<HudEvent, { type: T }>) => void,
  ): () => void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener as Listener);
    return () => this.listeners.get(type)!.delete(listener as Listener);
  }
}

export const hudBridge = new HudBridge();
