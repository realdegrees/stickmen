/**
 * Typed event emitter for stickman lifecycle and interaction events.
 */

export interface StickmanEventMap {
	[key: string]: unknown;
	statechange: { from: string; to: string };
	landed:      { position: { x: number; y: number }; hard: boolean };
	ragdoll:     {};
	proximity:   { otherId: string; distance: number };
	fleestart:   { from: { x: number; y: number } };
	fleestop:    {};
	spawned:     {};
	destroyed:   {};
}

export type StickmanEventName = keyof StickmanEventMap;

type Handler<T> = (data: T) => void;

export class EventEmitter<TMap extends Record<string, unknown>> {
	private listeners = new Map<keyof TMap, Set<Handler<never>>>();

	on<K extends keyof TMap>(event: K, handler: Handler<TMap[K]>): () => void {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, new Set());
		}
		const set = this.listeners.get(event)!;
		set.add(handler as Handler<never>);

		// Return unsubscribe function
		return () => {
			set.delete(handler as Handler<never>);
			if (set.size === 0) {
				this.listeners.delete(event);
			}
		};
	}

	emit<K extends keyof TMap>(event: K, data: TMap[K]): void {
		const set = this.listeners.get(event);
		if (!set) return;
		for (const handler of set) {
			(handler as Handler<TMap[K]>)(data);
		}
	}

	removeAll(): void {
		this.listeners.clear();
	}

	hasListeners<K extends keyof TMap>(event: K): boolean {
		const set = this.listeners.get(event);
		return set !== undefined && set.size > 0;
	}
}
