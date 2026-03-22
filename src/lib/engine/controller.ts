/**
 * StickmanController — Behavior engine with pluggable BehaviorDef.
 *
 * Integrates: PathExecutor, Stamina, BehaviorDef.
 * Update ordering: stamina → behavior → sprint → executor.
 */

import type { StickmanActions } from './actions.js';
import type { StickmanPhysics } from './physics.js';
import { PathExecutor } from './pathexecutor.js';
import { Stamina } from './stamina.js';
import type { NavGrid } from './navgrid.js';
import { findRandomPath, findPath, findPathAway } from './pathfinder.js';
import type { NavPath, Point, Renderable } from './types.js';
import type { BehaviorDef, BehaviorContext } from './behaviors/types.js';
import { getDefaultBehaviors } from './behaviors/defaults.js';

const SPRINT_MIN_WALK_EDGES = 3;
const SPRINT_SPEED_FACTOR = 1.5;

export class StickmanController {
	readonly executor: PathExecutor;
	readonly stamina: Stamina;
	private grid: NavGrid;

	// Behavior system
	private behaviors = new Map<string, BehaviorDef>();
	private activeBehavior: BehaviorDef | null = null;
	private _behaviorId: string = 'wander';

	// Flee overlay
	private _fleeFrom: Point | null = null;

	// Follow target
	private _followTarget: Point | null = null;
	private lastPathedX = 0;
	private lastPathedY = 0;
	private followTimer = 0;
	followInterval = 500;
	followMinDelta = 50;

	// Target point
	private _target: Point | null = null;
	private targetPathed = false;

	// Roam state
	private waitTimer = 0;
	idleTime = 750;

	// Sprint
	private sprintIntent = false;

	debug = false;

	constructor(
		actions: StickmanActions,
		physics: StickmanPhysics,
		grid: NavGrid,
		behaviorId: string = 'wander'
	) {
		this.executor = new PathExecutor(actions, physics, grid);
		this.stamina = new Stamina();
		this.grid = grid;

		// Register default behaviors
		for (const b of getDefaultBehaviors()) {
			this.behaviors.set(b.id, b);
		}

		this.setBehavior(behaviorId);

		this.executor.onPathComplete = () => {
			this.waitTimer = 0;
			this.sprintIntent = false;
		};
	}

	// ── Behavior API ─────────────────────────────────────────────────

	get behaviorId(): string {
		return this._behaviorId;
	}

	setBehavior(id: string): void {
		const ctx = this.createBehaviorContext();
		this.activeBehavior?.deactivate?.(ctx);

		const behavior = this.behaviors.get(id);
		if (!behavior) {
			console.warn(`Unknown behavior: ${id}. Falling back to idle.`);
			this.activeBehavior = this.behaviors.get('idle') ?? null;
			this._behaviorId = 'idle';
		} else {
			this.activeBehavior = behavior;
			this._behaviorId = id;
		}

		this.activeBehavior?.activate?.(ctx);
	}

	registerBehavior(behavior: BehaviorDef): void {
		this.behaviors.set(behavior.id, behavior);
	}

	// ── Flee API ─────────────────────────────────────────────────────

	get fleeFrom(): Point | null {
		return this._fleeFrom;
	}

	set fleeFrom(point: Point | null) {
		const wasFleeing = this._fleeFrom !== null;
		this._fleeFrom = point;

		if (point && !wasFleeing) {
			this.stamina.setFleeing(true);
		}

		if (!point && wasFleeing) {
			// Flee latch stays — stamina handles the unlatch at 0%
		}
	}

	get fleeing(): boolean {
		return this.stamina.isFleeing;
	}

	// ── Follow API ───────────────────────────────────────────────────

	set followTarget(point: Point | null) {
		this._followTarget = point;
	}

	get followTarget(): Point | null {
		return this._followTarget;
	}

	// ── Target API ───────────────────────────────────────────────────

	set target(point: Point | null) {
		this._target = point;
		this.targetPathed = false;
	}

	get target(): Point | null {
		return this._target;
	}

	// ── Update ───────────────────────────────────────────────────────

	update(dt: number): void {
		// 1. Stamina
		const isWalking =
			this.executor.actionBusy && this.executor.actions.currentActionType === 'run';
		const isSprinting = isWalking && this.stamina.sprinting;
		const activity = isSprinting ? 'sprinting' : isWalking ? 'moving' : 'idle';
		this.stamina.update(dt, activity as 'idle' | 'moving' | 'sprinting');

		// 2. Behavior
		this.handleBehavior(dt);

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

	private handleBehavior(dt: number): void {
		const ctx = this.createBehaviorContext();

		// Let the active behavior run
		this.activeBehavior?.update(ctx, dt);

		// Additional logic per behavior type that needs controller-level access
		switch (this._behaviorId) {
			case 'wander':
				this.handleWander(dt);
				break;
			case 'follow':
				this.handleFollow(dt);
				break;
			case 'target':
				this.handleTarget(dt);
				break;
		}
	}

	private handleWander(dt: number): void {
		if (this.stamina.isFleeing && !this.executor.hasPath) {
			if (this._fleeFrom) {
				this.pathAwayFrom(this._fleeFrom);
			} else {
				this.pickRandomDestination();
			}
		} else if (!this.executor.hasPath) {
			this.waitTimer += dt;
			if (this.waitTimer >= this.idleTime) {
				this.pickRandomDestination();
				this.waitTimer = 0;
			}
		}
	}

	private handleFollow(dt: number): void {
		if (this.stamina.isFleeing && this._fleeFrom && !this.executor.hasPath) {
			this.pathAwayFrom(this._fleeFrom);
			return;
		}

		const target = this._followTarget;
		if (!target) return;

		this.followTimer += dt;
		if (this.followTimer >= this.followInterval) {
			this.followTimer = 0;
			const dx = target.x - this.lastPathedX;
			const dy = target.y - this.lastPathedY;
			if (dx * dx + dy * dy > this.followMinDelta * this.followMinDelta) {
				this.pathToTarget(target.x, target.y);
				this.lastPathedX = target.x;
				this.lastPathedY = target.y;
			}
		}
	}

	private handleTarget(_dt: number): void {
		if (this.stamina.isFleeing && this._fleeFrom && !this.executor.hasPath) {
			this.pathAwayFrom(this._fleeFrom);
			return;
		}

		if (this._target && !this.targetPathed) {
			this.pathToTarget(this._target.x, this._target.y);
			this.targetPathed = true;
		}
	}

	private updateSprint(): void {
		const isFleeing = this.stamina.isFleeing;

		if (!this.stamina.sprinting) {
			const wantsSprint = isFleeing
				? this.stamina.canSprint()
				: this.sprintIntent && this.stamina.canSprint();
			if (wantsSprint) {
				this.stamina.sprinting = true;
			}
		} else {
			if (!isFleeing && !this.sprintIntent) {
				this.stamina.sprinting = false;
			}
		}

		if (this.stamina.sprinting) {
			const fig = this.executor.fig;
			this.executor.sprintSpeed = fig.speedMultiplier * SPRINT_SPEED_FACTOR;
			this.executor.sprintAnimId = isFleeing ? 'flee' : 'walk';
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
				if (consecutiveWalks >= SPRINT_MIN_WALK_EDGES) return true;
			} else {
				break;
			}
		}
		return false;
	}

	private pathToTarget(x: number, y: number): void {
		const fig = this.executor.fig;
		const path = findPath(this.grid, fig.x, fig.y, x, y);
		if (path && path.edges.length > 0) {
			this.executor.setPath(path);
			this.sprintIntent = this.checkSprintIntent();
		}
	}

	private pickRandomDestination(): void {
		const fig = this.executor.fig;
		const path = findRandomPath(this.grid, fig.x, fig.y, 80, 800);
		if (path && path.edges.length > 0) {
			this.executor.setPath(path);
			this.sprintIntent = this.checkSprintIntent();
		}
	}

	private pathAwayFrom(from: Point): void {
		const fig = this.executor.fig;
		const path = findPathAway(this.grid, fig.x, fig.y, from.x, from.y);
		if (path && path.edges.length > 0) {
			this.executor.setPath(path);
			this.sprintIntent = this.checkSprintIntent();
		}
	}

	private createBehaviorContext(): BehaviorContext {
		const fig = this.executor.fig;
		const self = this;

		return {
			get position() {
				return { x: fig.x, y: fig.y };
			},
			get animationState() {
				return fig.animationId;
			},
			get fleeFrom() {
				return self._fleeFrom;
			},
			pathTo(x: number, y: number): boolean {
				const path = findPath(self.grid, fig.x, fig.y, x, y);
				if (path && path.edges.length > 0) {
					self.executor.setPath(path);
					self.sprintIntent = self.checkSprintIntent();
					return true;
				}
				return false;
			},
			pathRandom(minDist?: number, maxDist?: number): boolean {
				const path = findRandomPath(self.grid, fig.x, fig.y, minDist, maxDist);
				if (path && path.edges.length > 0) {
					self.executor.setPath(path);
					self.sprintIntent = self.checkSprintIntent();
					return true;
				}
				return false;
			},
			pathAway(from: Point): boolean {
				const path = findPathAway(self.grid, fig.x, fig.y, from.x, from.y);
				if (path && path.edges.length > 0) {
					self.executor.setPath(path);
					self.sprintIntent = self.checkSprintIntent();
					return true;
				}
				return false;
			},
			clearPath() {
				self.executor.clearPath();
			},
			get hasPath() {
				return self.executor.hasPath;
			},
			get stamina() {
				return {
					value: self.stamina.value,
					sprinting: self.stamina.sprinting,
					canSprint: self.stamina.canSprint()
				};
			},
			setSprinting(active: boolean) {
				self.stamina.sprinting = active;
			},
			get navgrid() {
				return self.grid;
			}
		};
	}
}
