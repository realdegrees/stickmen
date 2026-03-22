/**
 * StickmanActions — Multi-step action state machine.
 *
 * Bridges controllers (who decide WHAT) and the stickman renderer (who draws).
 * One active action at a time. Starting a new action replaces the old.
 */

import type { Stickman } from './stickman.js';
import { Rope, createPitonProjectile, updatePiton, drawPiton } from './rope.js';
import type { PitonProjectile } from './rope.js';
import type { HSL, Renderable } from './types.js';

// ── Action Interface ─────────────────────────────────────────────────

interface Action {
	readonly type: string;
	update(dt: number, fig: Stickman): boolean;
	getRenderables(): Renderable[];
	cleanup?(): void;
}

// ── Concrete Actions ─────────────────────────────────────────────────

class IdleAction implements Action {
	type = 'idle';
	private timer = 0;

	constructor(private duration: number = Infinity) {}

	update(dt: number, fig: Stickman): boolean {
		fig.setState('idle');
		fig.tick(dt);
		this.timer += dt;
		return this.timer < this.duration;
	}

	getRenderables() {
		return [];
	}
}

class RunAction implements Action {
	type = 'run';
	private timer = 0;

	constructor(
		private direction: 1 | -1,
		private speed: number,
		private duration: number = Infinity,
		private targetX?: number,
		private animId: string = 'walk'
	) {}

	update(dt: number, fig: Stickman): boolean {
		fig.direction = this.direction;
		fig.setState(this.animId);
		fig.animParams = { ...fig.animParams, speed: this.speed };
		fig.tick(dt);

		const moveSpeed = this.speed * 0.06 * dt;
		fig.x += this.direction * moveSpeed;

		this.timer += dt;

		if (this.targetX !== undefined) {
			if (this.direction === 1 && fig.x >= this.targetX) {
				fig.x = this.targetX;
				return false;
			}
			if (this.direction === -1 && fig.x <= this.targetX) {
				fig.x = this.targetX;
				return false;
			}
		}

		return this.timer < this.duration;
	}

	getRenderables() {
		return [];
	}
}

class JumpAction implements Action {
	type = 'jump';
	private elapsed = 0;
	private sourceX: number;
	private sourceY: number;

	constructor(
		private targetX: number,
		private targetY: number,
		private duration: number,
		sourceX: number,
		sourceY: number
	) {
		this.sourceX = sourceX;
		this.sourceY = sourceY;
	}

	update(dt: number, fig: Stickman): boolean {
		this.elapsed += dt;
		const t = Math.min(this.elapsed / this.duration, 1);

		fig.animParams = { ...fig.animParams, subPhase: t };
		fig.setState('jump');
		fig.tick(dt);

		fig.x = this.sourceX + (this.targetX - this.sourceX) * t;

		const dist =
			Math.abs(this.targetX - this.sourceX) + Math.abs(this.targetY - this.sourceY);
		const arcHeight = dist * 0.3 + 10;
		const arc = -4 * arcHeight * t * (t - 1);
		fig.y = this.sourceY + (this.targetY - this.sourceY) * t - arc;

		if (this.targetX > this.sourceX) fig.direction = 1;
		else if (this.targetX < this.sourceX) fig.direction = -1;

		if (t >= 1) {
			fig.x = this.targetX;
			fig.y = this.targetY;
			fig.animParams = { ...fig.animParams, subPhase: 0 };
			return false;
		}

		return true;
	}

	getRenderables() {
		return [];
	}
}

class RopeThrowAction implements Action {
	type = 'ropeThrow';
	private phase: 'windup' | 'throwing' | 'climbing' | 'stepping-off' = 'windup';
	private timer = 0;
	private piton: PitonProjectile | null = null;
	rope: Rope | null = null;
	private startX = 0;
	private startY = 0;
	private climbProgress = 0;

	private pitonRenderable: Renderable;

	constructor(
		private targetX: number,
		private targetY: number,
		private color: HSL
	) {
		const self = this;
		this.pitonRenderable = {
			get position() {
				return { x: self.piton?.x ?? 0, y: self.piton?.y ?? 0 };
			},
			get active() {
				return self.piton?.active ?? false;
			},
			draw(ctx) {
				if (self.piton && self.piton.active) drawPiton(ctx, self.piton);
			}
		};
	}

	update(dt: number, fig: Stickman): boolean {
		this.timer += dt;

		switch (this.phase) {
			case 'windup':
				fig.setState('throw');
				fig.spoolSize = 1;
				fig.tick(dt);
				if (this.timer > 350) {
					this.startX = fig.x;
					this.startY = fig.y;
					const pose = fig.getCurrentPose();
					this.piton = createPitonProjectile(
						pose.handR.x,
						pose.handR.y,
						this.targetX,
						this.targetY,
						400,
						() => {
							this.rope?.unpinEnd();
							this.phase = 'climbing';
							this.timer = 0;
							this.climbProgress = 0;
							if (this.rope) this.rope.anchorVisible = true;
							fig.spoolSize = 0;
							fig.setState('rope-climb');
						}
					);
					this.rope = new Rope({
						anchorX: this.targetX,
						anchorY: this.targetY,
						endX: fig.x,
						endY: fig.y,
						color: this.color,
						slackFactor: 1.25
					});
					this.rope.deployProgress = 0;
					this.rope.pinEnd();
					this.phase = 'throwing';
					this.timer = 0;
				}
				break;

			case 'throwing':
				fig.setState('idle');
				fig.tick(dt);
				if (this.piton && this.piton.active) {
					updatePiton(this.piton, dt);
				}
				if (this.rope) {
					this.rope.advanceDeploy(dt * 0.004);
					if (this.piton) {
						this.rope.moveAnchor(this.piton.x, this.piton.y);
					}
					this.rope.moveEnd(fig.x, fig.y);
					this.rope.update(dt);
				}
				fig.spoolSize = Math.max(0, 1 - (this.rope?.deployProgress ?? 0));
				break;

			case 'climbing': {
				fig.setState('rope-climb');
				fig.tick(dt);

				const totalDist = Math.abs(this.targetY - this.startY);
				const climbDuration = (totalDist / 200) * 1000;
				this.climbProgress += dt / Math.max(climbDuration, 100);

				if (this.climbProgress >= 1) {
					this.climbProgress = 1;
					this.phase = 'stepping-off';
					this.timer = 0;
				}

				fig.y = this.startY + (this.targetY - this.startY) * this.climbProgress;
				if (this.rope) {
					const ropeX = this.rope.getXAtY(fig.y);
					if (ropeX !== null) fig.x = ropeX;
				}
				this.rope?.update(dt);
				break;
			}

			case 'stepping-off': {
				fig.setState('idle');
				fig.tick(dt);
				this.rope?.update(dt);

				const t = Math.min(this.timer / 100, 1);
				fig.x += (this.targetX - fig.x) * t * 0.2;
				fig.y += (this.targetY - fig.y) * t * 0.2;

				if (
					Math.abs(fig.x - this.targetX) < 1 &&
					Math.abs(fig.y - this.targetY) < 1
				) {
					fig.x = this.targetX;
					fig.y = this.targetY;
					fig.spoolSize = 0;
					this.rope?.startFade();
					return false;
				}
				break;
			}
		}

		return true;
	}

	getRenderables(): Renderable[] {
		const result: Renderable[] = [this.pitonRenderable];
		if (this.rope) result.push(this.rope);
		return result;
	}

	cleanup(): void {
		this.rope?.startFade();
		if (this.piton) this.piton.active = false;
	}
}

class RappelDownAction implements Action {
	type = 'rappelDown';
	private phase: 'planting' | 'dropping' | 'settling' | 'rappelling' | 'stepping-off' =
		'planting';
	private timer = 0;
	rope: Rope | null = null;
	private startX = 0;
	private startY: number;
	private rappelProgress = 0;

	constructor(
		private targetY: number,
		private targetX: number | undefined,
		private color: HSL,
		startY: number
	) {
		this.startY = startY;
	}

	update(dt: number, fig: Stickman): boolean {
		this.timer += dt;

		switch (this.phase) {
			case 'planting':
				fig.setState('plant');
				fig.tick(dt);
				if (this.timer > 250) {
					this.startX = fig.x;
					this.rope = new Rope({
						anchorX: fig.x,
						anchorY: this.startY,
						endX: fig.x,
						endY: this.targetY,
						color: this.color,
						slackFactor: 1.25
					});
					this.rope.deployProgress = 0;
					this.rope.anchorVisible = true;
					this.phase = 'dropping';
					this.timer = 0;
				}
				break;

			case 'dropping':
				fig.setState('idle');
				fig.tick(dt);
				if (this.rope) {
					this.rope.advanceDeploy(dt * 0.006);
					this.rope.update(dt);
					if (this.rope.deployProgress >= 1) {
						this.phase = 'settling';
						this.timer = 0;
					}
				}
				break;

			case 'settling':
				fig.setState('idle');
				fig.tick(dt);
				this.phase = 'rappelling';
				this.timer = 0;
				fig.setState('rope-climb');
				this.rappelProgress = 0;
				break;

			case 'rappelling': {
				fig.setState('rope-climb');
				fig.tick(dt);
				this.rope?.update(dt);

				const totalDist = Math.abs(this.targetY - this.startY);
				const rappelDuration = (totalDist / 200) * 1000;
				this.rappelProgress += dt / Math.max(rappelDuration, 100);

				if (this.rappelProgress >= 1) {
					this.rappelProgress = 1;
					this.phase = 'stepping-off';
					this.timer = 0;
				}

				fig.y = this.startY + (this.targetY - this.startY) * this.rappelProgress;
				if (this.rope) {
					if (this.targetX !== undefined) {
						const nearest = this.rope.getNearestPoint(fig.x, fig.y);
						const seg = this.rope.points[nearest.index];
						if (seg && !seg.pinned) {
							const pull = this.rappelProgress * this.rappelProgress;
							const dx = this.targetX - seg.x;
							seg.x += dx * pull * 0.15;
							const prev = this.rope.points[nearest.index - 1];
							const next = this.rope.points[nearest.index + 1];
							if (prev && !prev.pinned) prev.x += dx * pull * 0.06;
							if (next && !next.pinned) next.x += dx * pull * 0.06;
						}
					}

					const ropeX = this.rope.getXAtY(fig.y);
					if (ropeX !== null) fig.x = ropeX;

					const nearest2 = this.rope.getNearestPoint(fig.x, fig.y);
					this.rope.applyForce(nearest2.index, 0, 0.15);
				}
				break;
			}

			case 'stepping-off': {
				fig.setState('idle');
				fig.tick(dt);
				this.rope?.update(dt);

				const t = Math.min(this.timer / 100, 1);
				fig.y += (this.targetY - fig.y) * t * 0.2;
				if (this.targetX !== undefined) {
					fig.x += (this.targetX - fig.x) * t * 0.3;
				}

				if (Math.abs(fig.y - this.targetY) < 1) {
					fig.y = this.targetY;
					if (this.targetX !== undefined) fig.x = this.targetX;
					this.rope?.startFade();
					return false;
				}
				break;
			}
		}

		return true;
	}

	getRenderables(): Renderable[] {
		if (this.rope) return [this.rope];
		return [];
	}

	cleanup(): void {
		this.rope?.startFade();
	}
}

// ── StickmanActions Class ────────────────────────────────────────────

export class StickmanActions {
	readonly fig: Stickman;
	private currentAction: Action | null = null;

	onActionComplete: ((actionType: string) => void) | null = null;

	constructor(fig: Stickman) {
		this.fig = fig;
	}

	update(dt: number): void {
		if (this.currentAction) {
			const continuing = this.currentAction.update(dt, this.fig);
			if (!continuing) {
				const type = this.currentAction.type;
				this.currentAction = null;
				this.onActionComplete?.(type);
			}
		} else {
			this.fig.tick(dt);
		}
	}

	get busy(): boolean {
		return this.currentAction !== null;
	}

	get currentActionType(): string | null {
		return this.currentAction?.type ?? null;
	}

	getActionRenderables(): Renderable[] {
		return this.currentAction?.getRenderables() ?? [];
	}

	idle(duration?: number): void {
		this.currentAction = new IdleAction(duration);
	}

	run(
		direction: 1 | -1,
		speed?: number,
		duration?: number,
		targetX?: number,
		animId?: string
	): void {
		this.fig.direction = direction;
		this.currentAction = new RunAction(
			direction,
			speed ?? this.fig.speedMultiplier,
			duration,
			targetX,
			animId
		);
	}

	startJump(targetX: number, targetY: number, duration = 250): void {
		this.currentAction = new JumpAction(
			targetX,
			targetY,
			duration,
			this.fig.x,
			this.fig.y
		);
	}

	startRopeThrow(targetX: number, targetY: number, color?: HSL): void {
		this.currentAction = new RopeThrowAction(
			targetX,
			targetY,
			color ?? this.fig.color
		);
	}

	startRappelDown(targetY: number, targetX?: number, color?: HSL): void {
		this.currentAction = new RappelDownAction(
			targetY,
			targetX,
			color ?? this.fig.color,
			this.fig.y
		);
	}

	cancel(): void {
		this.currentAction?.cleanup?.();
		this.currentAction = null;
		this.fig.setState('idle');
		this.fig.spoolSize = 0;
		this.fig.animParams = { ...this.fig.animParams, subPhase: 0 };
	}
}
