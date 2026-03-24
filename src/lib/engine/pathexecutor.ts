/**
 * PathExecutor — Translates nav path edges into stickman actions.
 * Behavior-agnostic: doesn't decide WHERE to go, only HOW.
 */

import type { StickmanActions } from './actions.js';
import type { StickmanPhysics } from './physics.js';
import type { NavGrid } from './navgrid.js';
import { drawPath } from './pathfinder.js';
import type { NavPath, NavNode, Renderable } from './types.js';

export class PathExecutor {
	readonly actions: StickmanActions;
	readonly physics: StickmanPhysics;
	private grid: NavGrid;

	private currentPath: NavPath | null = null;
	private pathStepIndex = 0;
	private stepExecuted = false;

	sprintSpeed: number | null = null;
	sprintAnimId: string = 'walk';

	onPathComplete: (() => void) | null = null;

	constructor(actions: StickmanActions, physics: StickmanPhysics, grid: NavGrid) {
		this.actions = actions;
		this.physics = physics;
		this.grid = grid;
	}

	get fig() {
		return this.actions.fig;
	}

	get hasPath(): boolean {
		return this.currentPath !== null;
	}

	get actionBusy(): boolean {
		return this.actions.busy;
	}

	get path(): NavPath | null {
		return this.currentPath;
	}

	get currentStepIndex(): number {
		return this.pathStepIndex;
	}

	setPath(path: NavPath): void {
		this.currentPath = path;
		this.pathStepIndex = 0;
		this.stepExecuted = false;
	}

	clearPath(): void {
		this.currentPath = null;
		this.pathStepIndex = 0;
		this.stepExecuted = false;
	}

	update(dt: number): void {
		this.physics.update(dt, this.actions.busy);
		this.actions.update(dt);

		if (this.physics.surfaceLost) {
			this.physics.surfaceLost = false;
			this.actions.cancel();
			// Path is preserved — the stickman will resume once grounded again.
			this.actions.fig.setState('jump');
			this.actions.fig.animParams = { ...this.actions.fig.animParams, subPhase: 0.5 };
			return;
		}

		if (this.physics.ragdolling) {
			// Path is preserved — the stickman will resume once the ragdoll ends.
			return;
		}

		if (!this.actions.busy) {
			if (this.stepExecuted) {
				this.snapToSurface();
				this.pathStepIndex++;
				this.stepExecuted = false;
			}

			if (this.currentPath && this.pathStepIndex < this.currentPath.edges.length) {
				this.executeCurrentStep();
				this.stepExecuted = true;
			} else if (this.currentPath) {
				const cb = this.onPathComplete;
				this.currentPath = null;
				this.actions.fig.setState('idle');
				cb?.();
			}
		}
	}

	getRenderables(): Renderable[] {
		return this.actions.getActionRenderables();
	}

	drawDebug(ctx: CanvasRenderingContext2D): void {
		if (this.currentPath) {
			drawPath(ctx, this.currentPath);
		}
	}

	private executeCurrentStep(): void {
		if (!this.currentPath) return;

		const edge = this.currentPath.edges[this.pathStepIndex];
		const targetNode = this.grid.getNode(edge.to);
		if (!targetNode) {
			this.stepExecuted = true;
			return;
		}

		const fig = this.actions.fig;

		switch (edge.type) {
			case 'walk':
				this.executeWalk(targetNode);
				break;
			case 'jump':
				this.actions.startJump(targetNode.x, targetNode.y, 225);
				break;
			case 'rope': {
				const dy = targetNode.y - fig.y;
				if (dy < -10) {
					this.actions.startRopeThrow(targetNode.x, targetNode.y);
				} else if (dy > 10) {
					this.actions.startRappelDown(targetNode.y, targetNode.x);
				} else {
					this.stepExecuted = true;
				}
				break;
			}
			case 'rope-swing':
				this.actions.startRopeSwing(targetNode.x, targetNode.y);
				break;
		}
	}

	private snapToSurface(): void {
		const fig = this.actions.fig;
		const surface = this.physics.findSurface(fig.x, fig.y, 10);
		if (surface && fig.x >= surface.xMin && fig.x <= surface.xMax) {
			fig.y = surface.y;
			this.physics.grounded = true;
			this.physics.vy = 0;
			this.physics.vx = 0;
		}
	}

	private executeWalk(target: NavNode): void {
		const fig = this.actions.fig;
		const dx = target.x - fig.x;

		if (Math.abs(dx) < 2) {
			this.stepExecuted = true;
			return;
		}

		const dir: 1 | -1 = dx > 0 ? 1 : -1;
		const speed = this.sprintSpeed ?? undefined;
		const animId = this.sprintSpeed !== null ? this.sprintAnimId : undefined;
		this.actions.run(dir, speed, undefined, target.x, animId);
	}
}
