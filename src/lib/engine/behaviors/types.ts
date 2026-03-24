/**
 * Pluggable behavior interface.
 *
 * BehaviorHandle — the subset of the stickman's API that behaviors interact with.
 * Defined here (not in handle.ts) to avoid circular imports.
 *
 * StickmanBehavior — implement this to create a behavior. Attach via spawn() or
 * handle.setBehavior(). All methods are optional.
 *
 * BehaviorInput — what spawn() accepts: either an instance or a class constructor.
 * When a constructor is passed, spawn() calls new for you.
 *
 * PathHandle — returned by tryPathTo / tryPathRandom / tryPathAway / tryPathToElement.
 * Subscribe to 'arrived' or 'aborted' to react when navigation completes or is
 * interrupted. Call release() to voluntarily end a priority path early.
 * Call suspend() / resume() to temporarily pause execution without discarding the path.
 */

import type { Point } from '../types.js';
import type { StickmanEventMap } from '../../events.js';

// ── Path API ─────────────────────────────────────────────────────────

export interface PathEventMap {
	[key: string]: unknown;
	arrived: { position: { x: number; y: number } };
	aborted: {};
}

export interface PathOptions {
	/**
	 * When true, this path cannot be replaced or cleared by subsequent
	 * tryPath* or tryClearPath calls. Use path.release() to voluntarily
	 * end a priority path.
	 */
	priority?: boolean;
}

export interface PathHandle {
	/** Whether this path was started with { priority: true }. */
	readonly priority: boolean;
	/** Whether this path is currently suspended. */
	readonly suspended: boolean;
	/** Subscribe to 'arrived' or 'aborted'. Returns an unsubscribe function. */
	on<K extends keyof PathEventMap>(
		event: K,
		handler: (data: PathEventMap[K]) => void
	): () => void;
	/**
	 * Voluntarily end this path, even if it has priority.
	 * Emits 'aborted' and clears the active path. No-op if already done.
	 */
	release(): void;
	/**
	 * Pause path execution without discarding it. The stickman idles in place.
	 * Call resume() to continue from where it left off.
	 * No-op if the path is already done or suspended.
	 */
	suspend(): void;
	/**
	 * Resume a previously suspended path.
	 * No-op if the path is not suspended or is already done.
	 */
	resume(): void;
}

// ── Behavior API ──────────────────────────────────────────────────────

export interface BehaviorHandle {
	readonly position: Readonly<Point>;
	readonly animationState: string;
	readonly alive: boolean;
	readonly hasPath: boolean;
	/** The currently active path handle, or null if no path is running. */
	readonly currentPath: PathHandle | null;

	/** The stage container element. Useful for wiring DOM events inside behaviors. */
	readonly container: HTMLElement;

	/** Navigate to (x, y). Returns a PathHandle, or null if no route exists or a
	 *  priority path is blocking. */
	tryPathTo(x: number, y: number, opts?: PathOptions): PathHandle | null;
	/** Navigate to a random destination. Returns a PathHandle, or null if blocked. */
	tryPathRandom(minDist?: number, maxDist?: number, opts?: PathOptions): PathHandle | null;
	/** Navigate away from a point. Returns a PathHandle, or null if blocked. */
	tryPathAway(from: Point, opts?: PathOptions): PathHandle | null;
	/**
	 * Navigate to the nearest nav node within the target element.
	 * Returns null if the element has no navigable surface beneath it,
	 * or if a priority path is blocking.
	 */
	tryPathToElement(element: HTMLElement, opts?: PathOptions): PathHandle | null;
	/** Clear the current path. Returns false if a priority path is blocking. */
	tryClearPath(): boolean;

	/**
	 * Play a registered animation once to completion, then return to idle.
	 * If a path is active, it is automatically suspended for the duration and
	 * resumed when the animation finishes.
	 * If the animation ID is not registered, the call is a no-op.
	 * @param animationId - The ID of the animation to play (must be registered).
	 * @param options.onComplete - Optional callback fired when the animation finishes naturally.
	 */
	playAnimation(animationId: string, options?: { onComplete?: () => void }): void;

	/**
	 * Show a speech bubble above the stickman for the given duration (in seconds).
	 * Multiple calls stack bubbles — newest at the bottom, oldest at the top.
	 * Each bubble shrinks away when its duration expires.
	 * @param options.suspendPath - If true, suspends the active path until the bubble expires.
	 */
	say(text: string, duration: number, options?: { suspendPath?: boolean }): void;

	on<K extends keyof StickmanEventMap>(
		event: K,
		handler: (data: StickmanEventMap[K]) => void
	): () => void;
}

export interface StickmanBehavior {
	onAttach?(handle: BehaviorHandle): void;
	onDetach?(handle: BehaviorHandle): void;
	update?(handle: BehaviorHandle, dt: number): void;
}

/**
 * What spawn() accepts for the behavior option.
 * Pass a class constructor and spawn() instantiates it, or pass an instance directly.
 */
export type BehaviorInput = StickmanBehavior | (new () => StickmanBehavior);
