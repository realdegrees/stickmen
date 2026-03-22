/**
 * Built-in behavior definitions: wander, follow, target, idle.
 */

import type { BehaviorDef, BehaviorContext } from './types.js';

// ── Wander ───────────────────────────────────────────────────────────

export const wanderBehavior: BehaviorDef = {
	id: 'wander',

	update(ctx: BehaviorContext, dt: number) {
		// Flee override
		if (ctx.fleeFrom && !ctx.hasPath) {
			ctx.pathAway(ctx.fleeFrom);
			return;
		}

		if (!ctx.hasPath) {
			// Use a simple timer approach — store on the context
			// The controller manages the idle timer externally
			ctx.pathRandom(80, 800);
		}
	}
};

// ── Follow ───────────────────────────────────────────────────────────

export const followBehavior: BehaviorDef = {
	id: 'follow',

	update(ctx: BehaviorContext, _dt: number) {
		// Flee override
		if (ctx.fleeFrom) {
			ctx.pathAway(ctx.fleeFrom);
			return;
		}

		// The controller feeds followTarget coordinates externally
		// and handles re-path throttling
	}
};

// ── Target ───────────────────────────────────────────────────────────

export const targetBehavior: BehaviorDef = {
	id: 'target',

	update(ctx: BehaviorContext, _dt: number) {
		// Flee override
		if (ctx.fleeFrom && !ctx.hasPath) {
			ctx.pathAway(ctx.fleeFrom);
			return;
		}

		// The controller handles pathfinding to the target point externally
	}
};

// ── Idle ─────────────────────────────────────────────────────────────

export const idleBehavior: BehaviorDef = {
	id: 'idle',

	update(_ctx: BehaviorContext, _dt: number) {
		// Do nothing — stickman just idles
	}
};

export function getDefaultBehaviors(): BehaviorDef[] {
	return [wanderBehavior, followBehavior, targetBehavior, idleBehavior];
}
