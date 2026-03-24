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
import type { StickmanBehavior, PathHandle, PathOptions } from './engine/behaviors/types.js';

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

	get currentPath(): PathHandle | null {
		return this.getEntry()?.controller.currentPath ?? null;
	}

	tryPathTo(x: number, y: number, opts?: PathOptions): PathHandle | null {
		return this.getEntry()?.controller.tryPathTo(x, y, opts) ?? null;
	}

	tryPathRandom(minDist?: number, maxDist?: number, opts?: PathOptions): PathHandle | null {
		return this.getEntry()?.controller.tryPathRandom(minDist, maxDist, opts) ?? null;
	}

	tryPathAway(from: Point, opts?: PathOptions): PathHandle | null {
		return this.getEntry()?.controller.tryPathAway(from, opts) ?? null;
	}

	tryPathToElement(element: HTMLElement, opts?: PathOptions): PathHandle | null {
		return this.getEntry()?.controller.tryPathToElement(element, this.container, opts) ?? null;
	}

	tryClearPath(): boolean {
		return this.getEntry()?.controller.tryClearPath() ?? false;
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

	/**
	 * Play a registered animation once to completion, then return to idle.
	 * Suspends the current path (if any) for the duration and resumes it afterwards.
	 * No-op if the animation ID is not registered.
	 */
	playAnimation(animationId: string, options?: { onComplete?: () => void }): void {
		const entry = this.getEntry();
		if (!entry) return;

		// Suspend the active path so the stickman idles in place during the animation.
		const activePath = entry.controller.currentPath;
		activePath?.suspend();

		entry.actions.playOnce(animationId, () => {
			// Resume the path first, then fire the user callback.
			activePath?.resume();
			options?.onComplete?.();
		});
	}

	/**
	 * Show a speech bubble above the stickman for the given duration.
	 * @param duration - Duration in seconds.
	 * @param options.suspendPath - If true, suspends the active path until the bubble expires.
	 * Multiple calls stack: newest bubble sits closest to the head.
	 */
	say(text: string, duration: number, options?: { suspendPath?: boolean }): void {
		this.engine.say(this.id, text, duration * 1000, options?.suspendPath ?? false);
	}

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
