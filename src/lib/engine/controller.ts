/**
 * StickmanController — path execution + stamina + behavior dispatch.
 *
 * Behaviors are attached as StickmanBehavior instances via attachBehavior().
 * The controller exposes nav primitives (pathTo, pathRandom, pathAway) that
 * behaviors call through the BehaviorHandle / StickmanHandle.
 */

import type { StickmanActions } from './actions.js';
import type { StickmanPhysics } from './physics.js';
import { PathExecutor } from './pathexecutor.js';
import { Stamina } from './stamina.js';
import type { NavGrid } from './navgrid.js';
import { findRandomPath, findPath, findPathAway } from './pathfinder.js';
import type { NavPath, Point, Renderable } from './types.js';
import type { BehaviorHandle, StickmanBehavior } from './behaviors/types.js';
import type { StaminaConfig } from './config.js';
import { DEFAULT_CONFIG } from './config.js';

export class StickmanController {
	readonly executor: PathExecutor;
	readonly stamina: Stamina;
	private grid: NavGrid;
	private sc: StaminaConfig;

	private activeBehavior: StickmanBehavior | null = null;
	private behaviorHandle: BehaviorHandle | null = null;

	private sprintIntent = false;

	debug = false;

	constructor(actions: StickmanActions, physics: StickmanPhysics, grid: NavGrid, staminaConfig?: StaminaConfig) {
		this.sc = staminaConfig ?? DEFAULT_CONFIG.stamina;
		this.executor = new PathExecutor(actions, physics, grid);
		this.stamina = new Stamina(this.sc);
		this.grid = grid;

		this.executor.onPathComplete = () => {
			this.sprintIntent = false;
		};
	}

	/** Replace the stamina config at runtime (e.g. after a reactive update). */
	updateConfig(staminaConfig: StaminaConfig): void {
		this.sc = staminaConfig;
		this.stamina.updateConfig(staminaConfig);
	}

	// ── Behavior API ─────────────────────────────────────────────────

	get behavior(): StickmanBehavior | null {
		return this.activeBehavior;
	}

	attachBehavior(behavior: StickmanBehavior | null, handle: BehaviorHandle): void {
		if (this.activeBehavior && this.behaviorHandle) {
			this.activeBehavior.onDetach?.(this.behaviorHandle);
		}
		this.activeBehavior = behavior;
		this.behaviorHandle = handle;
		if (behavior && handle) {
			behavior.onAttach?.(handle);
		}
	}

	/** Called by the engine on stickman removal to cleanly tear down the behavior. */
	detachCurrentBehavior(): void {
		if (this.activeBehavior && this.behaviorHandle) {
			this.activeBehavior.onDetach?.(this.behaviorHandle);
		}
		this.activeBehavior = null;
		this.behaviorHandle = null;
	}

	// ── Navigation (public — called by handle / behaviors) ───────────

	pathTo(x: number, y: number): boolean {
		const fig = this.executor.fig;
		const path = findPath(this.grid, fig.x, fig.y, x, y);
		if (path && path.edges.length > 0) {
			this.executor.setPath(path);
			this.sprintIntent = this.checkSprintIntent();
			return true;
		}
		return false;
	}

	pathRandom(minDist?: number, maxDist?: number): boolean {
		const fig = this.executor.fig;
		const path = findRandomPath(this.grid, fig.x, fig.y, minDist, maxDist);
		if (path && path.edges.length > 0) {
			this.executor.setPath(path);
			this.sprintIntent = this.checkSprintIntent();
			return true;
		}
		return false;
	}

	pathAway(from: Point): boolean {
		const fig = this.executor.fig;
		const path = findPathAway(this.grid, fig.x, fig.y, from.x, from.y);
		if (path && path.edges.length > 0) {
			this.executor.setPath(path);
			this.sprintIntent = this.checkSprintIntent();
			return true;
		}
		return false;
	}

	clearPath(): void {
		this.executor.clearPath();
	}

	get hasPath(): boolean {
		return this.executor.hasPath;
	}

	// ── Update ───────────────────────────────────────────────────────

	update(dt: number): void {
		// 1. Stamina
		const isWalking =
			this.executor.actionBusy && this.executor.actions.currentActionType === 'run';
		const isSprinting = isWalking && this.stamina.sprinting;
		const activity = isSprinting ? 'sprinting' : isWalking ? 'moving' : 'idle';
		this.stamina.update(dt, activity as 'idle' | 'moving' | 'sprinting');

		// 2. Behavior tick
		if (this.activeBehavior?.update && this.behaviorHandle) {
			this.activeBehavior.update(this.behaviorHandle, dt);
		}

		// 3. Sprint
		this.updateSprint();

		// 4. Executor
		this.executor.update(dt);
	}

	getRenderables(): Renderable[] {
		return this.executor.getRenderables();
	}

	drawDebug(ctx: CanvasRenderingContext2D): void {
		if (!this.debug) return;
		this.executor.drawDebug(ctx);
	}

	// ── Internal ─────────────────────────────────────────────────────

	private updateSprint(): void {
		if (!this.stamina.sprinting) {
			if (this.sprintIntent && this.stamina.canSprint()) {
				this.stamina.sprinting = true;
			}
		} else {
			if (!this.sprintIntent) {
				this.stamina.sprinting = false;
			}
		}

		if (this.stamina.sprinting) {
			const fig = this.executor.fig;
			this.executor.sprintSpeed = fig.speedMultiplier * this.sc.sprintSpeedFactor;
			this.executor.sprintAnimId = 'walk';
		} else {
			this.executor.sprintSpeed = null;
		}
	}

	private checkSprintIntent(): boolean {
		const path = this.executor.path;
		if (!path) return false;

		let consecutiveWalks = 0;
		for (let i = this.executor.currentStepIndex; i < path.edges.length; i++) {
			if (path.edges[i].type === 'walk') {
				consecutiveWalks++;
				if (consecutiveWalks >= this.sc.sprintMinWalkEdges) return true;
			} else {
				break;
			}
		}
		return false;
	}
}
