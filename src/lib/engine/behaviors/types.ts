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
 */

import type { Point } from '../types.js';
import type { StickmanEventMap } from '../../events.js';

export interface BehaviorHandle {
	readonly position: Readonly<Point>;
	readonly animationState: string;
	readonly alive: boolean;
	readonly hasPath: boolean;

	/** The stage container element. Useful for wiring DOM events inside behaviors. */
	readonly container: HTMLElement;

	pathTo(x: number, y: number): boolean;
	pathRandom(minDist?: number, maxDist?: number): boolean;
	pathAway(from: Point): boolean;
	clearPath(): void;

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
