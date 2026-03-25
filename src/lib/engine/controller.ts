/**
 * StickmanController — path execution + stamina + behavior dispatch.
 *
 * Behaviors are attached as StickmanBehavior instances via attachBehavior().
 * The controller exposes nav primitives (tryPathTo, tryPathRandom, tryPathAway,
 * tryPathToElement) that behaviors call through the BehaviorHandle / StickmanHandle.
 *
 * Each successful path call returns a PathHandle. Subscribe to 'arrived' or
 * 'aborted' on that handle to react to navigation outcomes. Priority paths
 * block subsequent tryPath* and tryClearPath calls; call path.release() to
 * voluntarily end them.
 */

import type { StickmanActions } from './actions.js';
import type { StickmanPhysics } from './physics.js';
import { PathExecutor } from './pathexecutor.js';
import { Stamina } from './stamina.js';
import type { NavGrid } from './navgrid.js';
import { findRandomPath, findPath, findPathAway } from './pathfinder.js';
import type { NavPath, Point, Renderable } from './types.js';
import type { BehaviorHandle, PathHandle, PathEventMap, PathOptions, StickmanBehavior } from './behaviors/types.js';
import type { StaminaConfig } from './config.js';
import { DEFAULT_CONFIG } from './config.js';
import { EventEmitter } from '../events.js';

// ── PathHandleImpl ────────────────────────────────────────────────────

/** Internal implementation of PathHandle. Created by each successful tryPath* call. */
class PathHandleImpl implements PathHandle {
	readonly priority: boolean;
	private emitter = new EventEmitter<PathEventMap>();
	private _done = false;
	private _suspendCount = 0;
	private _onRelease: () => void;

	constructor(priority: boolean, onRelease: () => void) {
		this.priority = priority;
		this._onRelease = onRelease;
	}

	get suspended(): boolean {
		return this._suspendCount > 0;
	}

	on<K extends keyof PathEventMap>(
		event: K,
		handler: (data: PathEventMap[K]) => void
	): () => void {
		return this.emitter.on(event, handler);
	}

	release(): void {
		if (this._done) return;
		this._onRelease();
	}

	suspend(): void {
		if (this._done) return;
		this._suspendCount++;
	}

	resume(): void {
		if (this._suspendCount > 0) this._suspendCount--;
	}

	_emitArrived(position: { x: number; y: number }): void {
		if (this._done) return;
		this._done = true;
		this._suspendCount = 0;
		this.emitter.emit('arrived', { position });
	}

	_emitAborted(): void {
		if (this._done) return;
		this._done = true;
		this._suspendCount = 0;
		this.emitter.emit('aborted', {});
	}
}

// ── StickmanController ────────────────────────────────────────────────

export class StickmanController {
	readonly executor: PathExecutor;
	readonly stamina: Stamina;
	private grid: NavGrid;
	private sc: StaminaConfig;

	private activeBehavior: StickmanBehavior | null = null;
	private behaviorHandle: BehaviorHandle | null = null;

	private currentPathHandle: PathHandleImpl | null = null;
	private sprintIntent = false;

	debug = false;

	constructor(actions: StickmanActions, physics: StickmanPhysics, grid: NavGrid, staminaConfig?: StaminaConfig) {
		this.sc = staminaConfig ?? DEFAULT_CONFIG.stamina;
		this.executor = new PathExecutor(actions, physics, grid);
		this.stamina = new Stamina(this.sc);
		this.grid = grid;

		this.executor.onPathComplete = () => {
			this.sprintIntent = false;
			const h = this.currentPathHandle;
			this.currentPathHandle = null;
			h?._emitArrived({ x: this.executor.fig.x, y: this.executor.fig.y });
		};

		this.executor.onPathAborted = () => {
			this.sprintIntent = false;
			const h = this.currentPathHandle;
			this.currentPathHandle = null;
			h?._emitAborted();
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

	get currentPath(): PathHandle | null {
		return this.currentPathHandle;
	}

	tryPathTo(x: number, y: number, opts?: PathOptions): PathHandle | null {
		if (this.currentPathHandle?.priority) return null;
		const fig = this.executor.fig;
		const path = findPath(this.grid, fig.x, fig.y, x, y);
		if (!path || path.edges.length === 0) return null;
		return this._commitPath(path, opts);
	}

	tryPathRandom(minDist?: number, maxDist?: number, opts?: PathOptions): PathHandle | null {
		if (this.currentPathHandle?.priority) return null;
		const fig = this.executor.fig;
		const path = findRandomPath(this.grid, fig.x, fig.y, minDist, maxDist);
		if (!path || path.edges.length === 0) return null;
		return this._commitPath(path, opts);
	}

	tryPathAway(from: Point, opts?: PathOptions): PathHandle | null {
		if (this.currentPathHandle?.priority) return null;
		const fig = this.executor.fig;
		const path = findPathAway(this.grid, fig.x, fig.y, from.x, from.y);
		if (!path || path.edges.length === 0) return null;
		return this._commitPath(path, opts);
	}

	/**
	 * Navigate to the nearest nav node within the target element.
	 * Returns null if no navigable surface exists within the element bounds,
	 * or if a priority path is blocking.
	 *
	 * @param element - The target element (any element within the stage container).
	 * @param container - The stage container element (for coordinate resolution).
	 */
	tryPathToElement(element: HTMLElement, container: HTMLElement, opts?: PathOptions): PathHandle | null {
		if (this.currentPathHandle?.priority) return null;

		const stageRect = container.getBoundingClientRect();
		const elemRect = element.getBoundingClientRect();

		const centerX = elemRect.left - stageRect.left + elemRect.width / 2;
		const centerY = elemRect.top - stageRect.top + elemRect.height / 2;

		const node = this.grid.findNearestNode(centerX, centerY);
		if (!node) return null;

		// The nearest node must actually lie within the element's bounds.
		// A small tolerance accounts for floating-point surface alignment.
		const TOL = 8;
		if (
			node.x < elemRect.left - stageRect.left - TOL ||
			node.x > elemRect.right - stageRect.left + TOL ||
			node.y < elemRect.top - stageRect.top - TOL ||
			node.y > elemRect.bottom - stageRect.top + TOL
		) {
			return null;
		}

		return this.tryPathTo(node.x, node.y, opts);
	}

	/** Clear the current path. Returns false if a priority path is blocking. */
	tryClearPath(): boolean {
		if (this.currentPathHandle?.priority) return false;
		this._abortCurrentHandle();
		this.executor.clearPath();
		return true;
	}

	get hasPath(): boolean {
		return this.executor.hasPath;
	}

	/**
	 * Called after a navgrid rebuild. Recalculates the active path (if any)
	 * against the new grid, using the stickman's current step destination as
	 * the "from" coordinate and the original path destination as "to".
	 *
	 * The recalculated path is queued as pending — the current in-progress
	 * action (walk/jump) finishes normally, then the new path takes over.
	 * If no route exists in the new grid, the path is aborted.
	 */
	onGridRebuilt(): void {
		if (!this.executor.hasPath) return;

		const path = this.executor.path!;
		const destNode = path.nodes[path.nodes.length - 1];

		// Determine where to pathfind "from":
		// If mid-action, use the target of the current step (where the stickman
		// is heading). Otherwise use the stickman's current position.
		let fromX: number, fromY: number;
		if (this.executor.actionBusy) {
			const nextNode = path.nodes[this.executor.currentStepIndex + 1];
			fromX = nextNode.x;
			fromY = nextNode.y;
		} else {
			fromX = this.executor.fig.x;
			fromY = this.executor.fig.y;
		}

		const newPath = findPath(this.grid, fromX, fromY, destNode.x, destNode.y);
		this.executor.setPendingPath(newPath);
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

		// 4. Sync suspension state to executor
		this.executor.suspended = this.currentPathHandle?.suspended ?? false;

		// 5. Executor
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

	private _commitPath(path: NavPath, opts?: PathOptions): PathHandle {
		this._abortCurrentHandle();
		this.executor.setPath(path);
		this.sprintIntent = this.checkSprintIntent();
		const handle = new PathHandleImpl(opts?.priority ?? false, () => {
			if (this.currentPathHandle !== handle) return;
			this._abortCurrentHandle();
			this.executor.clearPath();
		});
		this.currentPathHandle = handle;
		return handle;
	}

	private _abortCurrentHandle(): void {
		const h = this.currentPathHandle;
		this.currentPathHandle = null;
		h?._emitAborted();
	}

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
