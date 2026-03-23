/**
 * StickmanHandle — Public API for a spawned stickman.
 * Thin wrapper over engine internals.
 *
 * Satisfies BehaviorHandle structurally (no explicit import needed).
 */

import type { StickmenEngine, StickmanEntry } from './engine/engine.js';
import type { ColorInput, Point } from './engine/types.js';
import { resolveColor } from './engine/types.js';
import { EventEmitter, type StickmanEventMap } from './events.js';
import type { StickmanBehavior } from './engine/behaviors/types.js';

export class StickmanHandle {
	readonly id: string;
	private engine: StickmenEngine;
	private _emitter: EventEmitter<StickmanEventMap>;
	private _alive = true;

	constructor(id: string, engine: StickmenEngine, emitter: EventEmitter<StickmanEventMap>) {
		this.id = id;
		this.engine = engine;
		this._emitter = emitter;
	}

	// ── Container ────────────────────────────────────────────────────

	get container(): HTMLElement {
		const c = this.engine.container;
		if (!c) throw new Error('Stage container not available');
		return c;
	}

	// ── Position ─────────────────────────────────────────────────────

	get position(): Readonly<Point> {
		const entry = this.getEntry();
		if (!entry) return { x: 0, y: 0 };
		return { x: entry.fig.x, y: entry.fig.y };
	}

	get animationState(): string {
		return this.getEntry()?.fig.animationId ?? 'idle';
	}

	get alive(): boolean {
		return this._alive && this.engine.getEntry(this.id) !== undefined;
	}

	// ── Behavior ─────────────────────────────────────────────────────

	/** Returns the currently attached behavior instance, or null. */
	get behavior(): StickmanBehavior | null {
		return this.getEntry()?.controller.behavior ?? null;
	}

	/** Replace the active behavior. The previous behavior's onDetach is called. */
	setBehavior(behavior: StickmanBehavior | null): void {
		const entry = this.getEntry();
		if (entry) entry.controller.attachBehavior(behavior, this);
	}

	// ── Navigation ───────────────────────────────────────────────────

	get hasPath(): boolean {
		return this.getEntry()?.controller.hasPath ?? false;
	}

	pathTo(x: number, y: number): boolean {
		return this.getEntry()?.controller.pathTo(x, y) ?? false;
	}

	pathRandom(minDist?: number, maxDist?: number): boolean {
		return this.getEntry()?.controller.pathRandom(minDist, maxDist) ?? false;
	}

	pathAway(from: Point): boolean {
		return this.getEntry()?.controller.pathAway(from) ?? false;
	}

	clearPath(): void {
		this.getEntry()?.controller.clearPath();
	}

	// ── Visual ───────────────────────────────────────────────────────

	set color(input: ColorInput) {
		const entry = this.getEntry();
		if (entry) {
			const hsl = resolveColor(input);
			(entry.fig as { color: typeof hsl }).color = hsl;
		}
	}

	set hat(id: string | null) {
		const entry = this.getEntry();
		if (entry) {
			if (id === null) {
				entry.fig.hat = null;
			} else {
				const hatDef = this.engine.hatRegistry.get(id);
				if (hatDef) entry.fig.hat = hatDef;
			}
		}
	}

	// ── Actions ──────────────────────────────────────────────────────

	teleport(position: Point): void {
		const entry = this.getEntry();
		if (!entry) return;

		entry.actions.cancel();
		entry.fig.x = position.x;
		entry.fig.y = position.y;
		entry.physics.grounded = false;
		entry.physics.vx = 0;
		entry.physics.vy = 0;
	}

	destroy(): void {
		this._alive = false;
		this.engine.remove(this.id);
		this._emitter.removeAll();
	}

	// ── Events ───────────────────────────────────────────────────────

	on<K extends keyof StickmanEventMap>(
		event: K,
		handler: (data: StickmanEventMap[K]) => void
	): () => void {
		return this._emitter.on(event, handler);
	}

	// ── Internal ─────────────────────────────────────────────────────

	private getEntry(): StickmanEntry | undefined {
		return this.engine.getEntry(this.id);
	}
}
