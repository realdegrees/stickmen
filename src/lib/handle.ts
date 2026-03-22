/**
 * StickmanHandle — Public API for a spawned stickman.
 * Thin wrapper over engine internals.
 */

import type { StickmenEngine, StickmanEntry } from './engine/engine.js';
import type { ColorInput, Point } from './engine/types.js';
import { resolveColor } from './engine/types.js';
import { EventEmitter, type StickmanEventMap } from './events.js';

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

	// ── Position (read-only) ─────────────────────────────────────────

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

	get behavior(): string {
		return this.getEntry()?.controller.behaviorId ?? 'idle';
	}

	set behavior(id: string) {
		this.getEntry()?.controller.setBehavior(id);
	}

	// ── Target (for 'target' behavior) ───────────────────────────────

	get target(): Point | null {
		return this.getEntry()?.controller.target ?? null;
	}

	set target(point: Point | null) {
		const entry = this.getEntry();
		if (entry) entry.controller.target = point;
	}

	// ── Follow target ────────────────────────────────────────────────

	get followTarget(): Point | null {
		return this.getEntry()?.controller.followTarget ?? null;
	}

	set followTarget(point: Point | null) {
		const entry = this.getEntry();
		if (entry) entry.controller.followTarget = point;
	}

	// ── Flee overlay ─────────────────────────────────────────────────

	get fleeFrom(): Point | null {
		return this.getEntry()?.controller.fleeFrom ?? null;
	}

	set fleeFrom(point: Point | null) {
		const entry = this.getEntry();
		if (entry) entry.controller.fleeFrom = point;
	}

	get fleeing(): boolean {
		return this.getEntry()?.controller.fleeing ?? false;
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
