/**
 * Pluggable behavior interface.
 * Built-in behaviors (wander, follow, target, idle) implement this.
 * Users can register custom behaviors.
 */

import type { NavGrid } from '../navgrid.js';
import type { NavPath, Point } from '../types.js';
import type { Stamina } from '../stamina.js';

export interface BehaviorDef {
	readonly id: string;
	activate?(ctx: BehaviorContext): void;
	deactivate?(ctx: BehaviorContext): void;
	update(ctx: BehaviorContext, dt: number): void;
}

export interface BehaviorContext {
	readonly position: Readonly<Point>;
	readonly animationState: string;
	readonly fleeFrom: Point | null;

	pathTo(x: number, y: number): boolean;
	pathRandom(minDist?: number, maxDist?: number): boolean;
	pathAway(from: Point): boolean;
	clearPath(): void;
	readonly hasPath: boolean;

	readonly stamina: Readonly<{ value: number; sprinting: boolean; canSprint: boolean }>;
	setSprinting(active: boolean): void;

	readonly navgrid: NavGrid;
}
