/**
 * StickmanPhysics — Gravity, surface detection, ragdoll.
 *
 * Works alongside StickmanActions:
 * - Action-controlled: physics is passive, only checks grounded state
 * - Physics-controlled: applies gravity, landing detection, ragdoll on hard impact
 *
 * Safety nets:
 * - Out-of-bounds detection: resets stickman to nearest surface
 * - Motionless ragdoll timeout: force-recovers settled ragdolls whose
 *   feet didn't land on a recognized surface
 *
 * Surface knowledge is injected via SurfaceQuery function.
 */

import type { Stickman } from './stickman.js';
import type { JointName, Pose, SurfaceQuery, NavSurface } from './types.js';
import { JOINT_NAMES, BONES } from './types.js';

const GRAVITY = 0.0012;
const AIR_DRAG = 0.998;
const RAGDOLL_GRAVITY = 0.0015;
const RAGDOLL_DAMPING = 0.96;
const RAGDOLL_CONSTRAINT_ITERATIONS = 3;
const RAGDOLL_IMPACT_THRESHOLD = 0.4;
const RAGDOLL_RECOVERY_DELAY = 300;
const SURFACE_SEARCH_RADIUS = 200;

/** Fraction of vertical velocity reflected on surface collision (bounce) */
const RAGDOLL_RESTITUTION = 0.3;

/** Squared velocity threshold below which the ragdoll is considered motionless */
const MOTIONLESS_THRESHOLD_SQ = 0.5;

/** How long (ms) a ragdoll must be motionless before force-recovering */
const RAGDOLL_MOTIONLESS_TIMEOUT = 1500;

/** Margin beyond container bounds before triggering a reset */
const OOB_MARGIN = 50;

interface RagdollJoint {
	name: JointName;
	x: number;
	y: number;
	prevX: number;
	prevY: number;
}

export interface ContainerBounds {
	width: number;
	height: number;
}

export class StickmanPhysics {
	private fig: Stickman;
	findSurface: SurfaceQuery;

	vx = 0;
	vy = 0;

	grounded = true;
	ragdolling = false;
	surfaceLost = false;

	/** Container bounds for out-of-bounds detection. Set by the engine. */
	containerBounds: ContainerBounds | null = null;

	/** All surfaces for nearest-surface lookups during reset. Set by the engine. */
	surfaces: NavSurface[] = [];

	private ragdollJoints: RagdollJoint[] = [];
	private ragdollBoneLengths = new Map<string, number>();
	private ragdollGroundTimer = 0;
	private ragdollMotionlessTimer = 0;

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
		this.ragdollMotionlessTimer = 0;

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
			// Check bounds after ragdoll update
			if (this.isOutOfBounds()) {
				this.resetToNearestSurface();
			}
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

		// Out-of-bounds check (non-ragdoll falling)
		if (this.isOutOfBounds()) {
			this.resetToNearestSurface();
		}
	}

	// ── Ragdoll Physics ──────────────────────────────────────────────

	private updateRagdoll(dt: number): void {
		const joints = this.ragdollJoints;
		const normalDt = Math.min(dt / 16.67, 2);

		// Verlet integration
		for (const j of joints) {
			const vx = (j.x - j.prevX) * RAGDOLL_DAMPING;
			const vy = (j.y - j.prevY) * RAGDOLL_DAMPING;
			j.prevX = j.x;
			j.prevY = j.y;
			j.x += vx;
			j.y += vy + RAGDOLL_GRAVITY * normalDt * normalDt * 100;
		}

		// Distance constraints
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

		// Surface collision with restitution bounce
		let feetGrounded = 0;
		for (const j of joints) {
			const surface = this.findSurface(j.x, j.y, 20);
			if (surface && j.y > surface.y && j.x >= surface.xMin && j.x <= surface.xMax) {
				const vy = j.y - j.prevY; // current vertical velocity
				j.y = surface.y;
				// Reflect a fraction of the velocity for bounce
				j.prevY = j.y + vy * RAGDOLL_RESTITUTION;
				// Friction on horizontal velocity
				j.prevX = j.x - (j.x - j.prevX) * 0.7;

				if (j.name === 'footL' || j.name === 'footR') feetGrounded++;
			}
		}

		// Build pose override
		const ragdollPose: Partial<Pose> = {};
		for (const j of joints) {
			ragdollPose[j.name] = { x: j.x, y: j.y };
		}
		this.fig.poseOverride = ragdollPose as Pose;

		// Track hip for position reference
		const hip = joints.find((j) => j.name === 'hip')!;
		this.fig.x = hip.x;
		this.fig.y = hip.y;

		// Feet-on-surface recovery (original logic)
		if (feetGrounded >= 1) {
			this.ragdollGroundTimer += dt;
			if (this.ragdollGroundTimer > RAGDOLL_RECOVERY_DELAY) {
				this.recoverFromRagdoll();
				return;
			}
		} else {
			this.ragdollGroundTimer = 0;
		}

		// Motionless ragdoll timeout — force-recover when settled but feet
		// didn't land on a recognized surface (e.g., scattered outside inset bounds)
		const totalVelocitySq = joints.reduce((sum, j) => {
			const vx = j.x - j.prevX;
			const vy = j.y - j.prevY;
			return sum + vx * vx + vy * vy;
		}, 0);

		if (totalVelocitySq < MOTIONLESS_THRESHOLD_SQ) {
			this.ragdollMotionlessTimer += dt;
			if (this.ragdollMotionlessTimer > RAGDOLL_MOTIONLESS_TIMEOUT) {
				this.resetToNearestSurface();
				return;
			}
		} else {
			this.ragdollMotionlessTimer = 0;
		}

		this.fig.tick(dt);
	}

	// ── Recovery ─────────────────────────────────────────────────────

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
			// Feet aren't on a surface — fall through to resetToNearestSurface
			this.resetToNearestSurface();
			return;
		}

		this.vx = 0;
		this.vy = 0;

		this.fig.setState('jump');
		this.fig.animParams = { ...this.fig.animParams, subPhase: 0.9 };
		this.ragdollJoints = [];
		this.ragdollMotionlessTimer = 0;
		this.onLanded?.();
	}

	// ── Out-of-Bounds Detection & Reset ──────────────────────────────

	private isOutOfBounds(): boolean {
		if (!this.containerBounds) return false;
		const { x, y } = this.fig;
		return (
			x < -OOB_MARGIN ||
			x > this.containerBounds.width + OOB_MARGIN ||
			y > this.containerBounds.height + OOB_MARGIN
			// Don't check y < 0 — stickmen can briefly be above during jumps
		);
	}

	/**
	 * Reset the stickman to the nearest known surface.
	 * Used when the stickman falls out of bounds or ragdoll is stuck.
	 */
	private resetToNearestSurface(): void {
		// Cancel ragdoll state
		this.ragdolling = false;
		this.ragdollJoints = [];
		this.ragdollGroundTimer = 0;
		this.ragdollMotionlessTimer = 0;
		this.fig.poseOverride = null;
		this.vx = 0;
		this.vy = 0;

		// Find the nearest surface to the stickman's current position
		const figX = this.fig.x;
		const figY = this.fig.y;
		let bestSurface: NavSurface | null = null;
		let bestDist = Infinity;

		for (const s of this.surfaces) {
			// Clamp X to the surface range for distance calculation
			const clampedX = Math.max(s.x1, Math.min(figX, s.x2));
			const dx = clampedX - figX;
			const dy = s.y1 - figY;
			const dist = dx * dx + dy * dy;
			if (dist < bestDist) {
				bestDist = dist;
				bestSurface = s;
			}
		}

		if (bestSurface) {
			// Place stickman at the center of the nearest surface
			const centerX = (bestSurface.x1 + bestSurface.x2) / 2;
			this.fig.x = centerX;
			this.fig.y = bestSurface.y1;
			this.grounded = true;
		} else {
			// No surfaces at all — just place at a default position
			this.fig.x = 100;
			this.fig.y = 100;
			this.grounded = false;
		}

		this.fig.setState('idle');
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
