/**
 * StickmanPhysics — Gravity, surface detection, ragdoll.
 *
 * Works alongside StickmanActions:
 * - Action-controlled: physics is passive, only checks grounded state
 * - Physics-controlled: applies gravity, landing detection, ragdoll on hard impact
 *
 * Surface knowledge is injected via SurfaceQuery function.
 */

import type { Stickman } from './stickman.js';
import type { JointName, Pose, SurfaceQuery } from './types.js';
import { JOINT_NAMES, BONES } from './types.js';

const GRAVITY = 0.0012;
const AIR_DRAG = 0.998;
const RAGDOLL_GRAVITY = 0.0015;
const RAGDOLL_DAMPING = 0.96;
const RAGDOLL_CONSTRAINT_ITERATIONS = 3;
const RAGDOLL_IMPACT_THRESHOLD = 0.4;
const RAGDOLL_RECOVERY_DELAY = 300;
const SURFACE_SEARCH_RADIUS = 200;

interface RagdollJoint {
	name: JointName;
	x: number;
	y: number;
	prevX: number;
	prevY: number;
}

export class StickmanPhysics {
	private fig: Stickman;
	findSurface: SurfaceQuery;

	vx = 0;
	vy = 0;

	grounded = true;
	ragdolling = false;
	surfaceLost = false;

	private ragdollJoints: RagdollJoint[] = [];
	private ragdollBoneLengths = new Map<string, number>();
	private ragdollGroundTimer = 0;

	onLanded: (() => void) | null = null;

	constructor(fig: Stickman, findSurface: SurfaceQuery) {
		this.fig = fig;
		this.findSurface = findSurface;
	}

	applyImpulse(ivx: number, ivy: number): void {
		this.vx += ivx;
		this.vy += ivy;
		this.grounded = false;
		this.fig.poseOverride = null;
		this.fig.setState('jump');
		this.fig.animParams = { ...this.fig.animParams, subPhase: 0.4 };
	}

	startRagdoll(ivx: number, ivy: number): void {
		this.ragdolling = true;
		this.grounded = false;
		this.ragdollGroundTimer = 0;

		const pose = this.fig.getCurrentPose();
		this.ragdollJoints = JOINT_NAMES.map((name) => ({
			name,
			x: pose[name].x,
			y: pose[name].y,
			prevX: pose[name].x - ivx * 0.5,
			prevY: pose[name].y - ivy * 0.5
		}));

		this.ragdollBoneLengths.clear();
		for (const [a, b] of BONES) {
			const ja = this.ragdollJoints.find((j) => j.name === a)!;
			const jb = this.ragdollJoints.find((j) => j.name === b)!;
			const dx = jb.x - ja.x;
			const dy = jb.y - ja.y;
			const len = Math.sqrt(dx * dx + dy * dy);
			this.ragdollBoneLengths.set(`${a}-${b}`, Math.max(len, 1));
		}

		this.fig.setState('grabbed');
	}

	update(dt: number, actionControlled: boolean): void {
		if (actionControlled) {
			this.vx = 0;
			this.vy = 0;
			this.ragdolling = false;
			this.fig.poseOverride = null;

			const wasGrounded = this.grounded;
			const surface = this.findSurface(this.fig.x, this.fig.y, 3);
			this.grounded = surface !== null && Math.abs(this.fig.y - surface.y) < 3;

			if (wasGrounded && !this.grounded) {
				const state = this.fig.animationId;
				if (state === 'walk' || state === 'idle') {
					this.surfaceLost = true;
				}
			}
			return;
		}

		if (this.ragdolling) {
			this.updateRagdoll(dt);
			return;
		}

		// Grounded with no velocity — skip gravity cycle
		if (this.grounded && this.vy === 0 && this.vx === 0) {
			const surface = this.findSurface(this.fig.x, this.fig.y, 3);
			if (!surface || this.fig.x < surface.xMin || this.fig.x > surface.xMax) {
				this.grounded = false;
				this.fig.setState('jump');
				this.fig.animParams = { ...this.fig.animParams, subPhase: 0.5 };
			} else {
				this.fig.tick(dt);
			}
			return;
		}

		// Apply gravity
		this.vy += GRAVITY * dt;
		this.fig.x += this.vx * dt;
		this.fig.y += this.vy * dt;
		this.vx *= AIR_DRAG;
		if (Math.abs(this.vx) < 0.001) this.vx = 0;

		// Surface detection (falling)
		if (this.vy >= 0) {
			const surface = this.findSurface(this.fig.x, this.fig.y, SURFACE_SEARCH_RADIUS);
			if (surface && this.fig.y >= surface.y) {
				if (this.fig.x >= surface.xMin && this.fig.x <= surface.xMax) {
					this.fig.y = surface.y;

					if (this.vy > RAGDOLL_IMPACT_THRESHOLD) {
						this.startRagdoll(this.vx * 0.5, -this.vy * 0.2);
					} else {
						this.vy = 0;
						this.vx = 0;
						this.grounded = true;
						this.fig.setState('jump');
						this.fig.animParams = { ...this.fig.animParams, subPhase: 0.9 };
						this.onLanded?.();
					}
				}
			}
		}

		// Edge fall detection
		if (this.grounded && this.vy === 0) {
			const surface = this.findSurface(this.fig.x, this.fig.y, 3);
			if (!surface || this.fig.x < surface.xMin || this.fig.x > surface.xMax) {
				this.grounded = false;
				this.fig.setState('jump');
				this.fig.animParams = { ...this.fig.animParams, subPhase: 0.5 };
			}
		}

		// Jump recovery animation
		const subPhase = this.fig.animParams.subPhase ?? 0;
		if (this.grounded && this.fig.animationId === 'jump' && subPhase >= 0.9) {
			this.fig.animParams = {
				...this.fig.animParams,
				subPhase: subPhase + dt * 0.003
			};
			this.fig.tick(dt);
			if (this.fig.animParams.subPhase >= 1.0) {
				this.fig.animParams = { ...this.fig.animParams, subPhase: 0 };
				this.fig.setState('idle');
			}
		} else if (!this.ragdolling) {
			this.fig.tick(dt);
		}
	}

	private updateRagdoll(dt: number): void {
		const joints = this.ragdollJoints;
		const normalDt = Math.min(dt / 16.67, 2);

		for (const j of joints) {
			const vx = (j.x - j.prevX) * RAGDOLL_DAMPING;
			const vy = (j.y - j.prevY) * RAGDOLL_DAMPING;
			j.prevX = j.x;
			j.prevY = j.y;
			j.x += vx;
			j.y += vy + RAGDOLL_GRAVITY * normalDt * normalDt * 100;
		}

		for (let iter = 0; iter < RAGDOLL_CONSTRAINT_ITERATIONS; iter++) {
			for (const [aName, bName] of BONES) {
				const a = joints.find((j) => j.name === aName)!;
				const b = joints.find((j) => j.name === bName)!;
				const restLen = this.ragdollBoneLengths.get(`${aName}-${bName}`) ?? 5;

				const dx = b.x - a.x;
				const dy = b.y - a.y;
				const dist = Math.sqrt(dx * dx + dy * dy);
				if (dist === 0) continue;

				const diff = (restLen - dist) / dist;
				const offsetX = dx * diff * 0.5;
				const offsetY = dy * diff * 0.5;

				a.x -= offsetX;
				a.y -= offsetY;
				b.x += offsetX;
				b.y += offsetY;
			}
		}

		let feetGrounded = 0;
		for (const j of joints) {
			const surface = this.findSurface(j.x, j.y, 20);
			if (surface && j.y > surface.y && j.x >= surface.xMin && j.x <= surface.xMax) {
				j.y = surface.y;
				j.prevY = j.y;
				j.prevX = j.x - (j.x - j.prevX) * 0.7;
				if (j.name === 'footL' || j.name === 'footR') feetGrounded++;
			}
		}

		const ragdollPose: Partial<Pose> = {};
		for (const j of joints) {
			ragdollPose[j.name] = { x: j.x, y: j.y };
		}
		this.fig.poseOverride = ragdollPose as Pose;

		const hip = joints.find((j) => j.name === 'hip')!;
		this.fig.x = hip.x;
		this.fig.y = hip.y;

		if (feetGrounded >= 1) {
			this.ragdollGroundTimer += dt;
			if (this.ragdollGroundTimer > RAGDOLL_RECOVERY_DELAY) {
				this.recoverFromRagdoll();
			}
		} else {
			this.ragdollGroundTimer = 0;
		}

		this.fig.tick(dt);
	}

	private recoverFromRagdoll(): void {
		this.ragdolling = false;
		this.fig.poseOverride = null;

		const footL = this.ragdollJoints.find((j) => j.name === 'footL')!;
		const footR = this.ragdollJoints.find((j) => j.name === 'footR')!;
		const avgFootX = (footL.x + footR.x) / 2;
		const avgFootY = Math.max(footL.y, footR.y);

		const surface = this.findSurface(avgFootX, avgFootY, 10);
		if (surface) {
			this.fig.x = avgFootX;
			this.fig.y = surface.y;
			this.grounded = true;
		} else {
			this.fig.x = avgFootX;
			this.fig.y = avgFootY;
			this.grounded = false;
		}

		this.vx = 0;
		this.vy = 0;

		this.fig.setState('jump');
		this.fig.animParams = { ...this.fig.animParams, subPhase: 0.9 };
		this.ragdollJoints = [];
		this.onLanded?.();
	}
}

/** Helper: create a SurfaceQuery from a simple platform list */
export function createPlatformQuery(
	platforms: { y: number; xMin: number; xMax: number }[]
): SurfaceQuery {
	return (x, y, searchRadius) => {
		let best: { y: number; xMin: number; xMax: number; type: 'horizontal' } | null = null;
		let bestDist = searchRadius;

		for (const p of platforms) {
			if (x >= p.xMin && x <= p.xMax) {
				const dist = p.y - y;
				if (dist >= -2 && dist < bestDist) {
					bestDist = dist;
					best = { ...p, type: 'horizontal' };
				}
			}
		}

		return best;
	};
}
