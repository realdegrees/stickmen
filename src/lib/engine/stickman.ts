/**
 * Stickman — Procedural stick figure renderer.
 *
 * Uses the AnimationRegistry to resolve poses.
 * Never decides what to do — position, state, and direction are set externally.
 */

import type { BodyScale, HSL, Joint, JointName, Pose, Renderable, StickmanConfig } from './types.js';
import { BONES, JOINT_NAMES, colorToHSL, colorToHSLA } from './types.js';
import { DEFAULT_CONFIG } from './config.js';
import type { AnimationRegistry } from './animations/registry.js';
import type { AnimationResolver } from './animations/types.js';
import type { HatDef } from './hats.js';

export class Stickman implements Renderable {
	// Position in container-space (feet position)
	x: number;
	y: number;

	// Config
	readonly color: HSL;
	readonly speedMultiplier: number;
	readonly bodyScale: BodyScale;
	hat: HatDef | null = null;

	// State
	animationId: string = 'idle';
	direction: 1 | -1 = 1;
	active = true;

	/** Body rotation in radians (0 = upright). Set by rope-swing action. */
	rotation = 0;

	// Animation params — set by actions/controllers, read by animation resolvers
	animParams: Record<string, number> = {};

	/** 0-1 rope spool size for throw animation */
	spoolSize = 0;

	/** External pose override for ragdoll physics. Bypasses animation resolver. */
	poseOverride: Pose | null = null;

	// Animation timing
	private phase = 0;
	private frameIndex = 0;
	private tickAccumulator = 0;
	private readonly poseInterval: number;

	// Current resolved pose (container-space)
	private currentPose: Pose;

	// Animation resolver (cached lookup)
	private resolver: AnimationResolver | null = null;
	private registry: AnimationRegistry;

	constructor(x: number, y: number, config: StickmanConfig, registry: AnimationRegistry) {
		this.x = x;
		this.y = y;
		this.color = config.color;
		this.speedMultiplier = config.speedMultiplier;
		this.bodyScale = config.bodyScale;
		this.registry = registry;

		if (config.hatId) {
			// Hat is resolved externally and set via .hat property
		}

		// Stop-motion: 25-47fps depending on speed
		const baseFPS = 36;
		this.poseInterval = 1000 / (baseFPS * config.speedMultiplier);

		this.resolver = registry.get('idle') ?? null;
		this.currentPose = this.calculatePose();
	}

	get position() {
		return { x: this.x, y: this.y };
	}

	/** Current animation frame index (increments each pose-update tick). */
	get currentFrameIndex(): number {
		return this.frameIndex;
	}

	/** Milliseconds between pose updates (stop-motion rate). */
	get poseMsPerFrame(): number {
		return this.poseInterval;
	}

	/**
	 * Returns the frameCount of the named animation, or null if not registered.
	 * Used by PlayAnimationAction to know when the animation is complete.
	 */
	getAnimationFrameCount(animId: string): number | null {
		return this.registry.get(animId)?.frameCount ?? null;
	}

	/** Advance animation timing. Call every frame with delta in ms. */
	tick(deltaMs: number): void {
		this.tickAccumulator += deltaMs;

		if (this.tickAccumulator >= this.poseInterval) {
			this.tickAccumulator -= this.poseInterval;
			this.frameIndex++;

			if (this.resolver && this.resolver.type === 'cyclic') {
				const cycleFrames = this.resolver.frameCount;
				this.phase = ((this.frameIndex % cycleFrames) / cycleFrames) * Math.PI * 2;
			}

			this.currentPose = this.calculatePose();
		}
	}

	/** Set animation by ID. Resets timing if animation changes. */
	setState(animationId: string): void {
		if (this.animationId !== animationId) {
			this.animationId = animationId;
			this.resolver = this.registry.get(animationId) ?? null;
			this.phase = 0;
			this.frameIndex = 0;
			this.tickAccumulator = 0;
			this.currentPose = this.calculatePose();
		}
	}

	/** Get the current world-space resolved pose */
	getCurrentPose(): Pose {
		return this.currentPose;
	}

	private calculatePose(): Pose {
		if (!this.resolver) {
			// Fallback: static standing pose
			return this.toWorldCoords(this.standingPose());
		}

		const relativePose = this.resolver.resolve({
			phase: this.phase,
			frameIndex: this.frameIndex,
			bodyScale: this.bodyScale,
			params: this.animParams
		});

		return this.toWorldCoords(relativePose);
	}

	private standingPose(): Pose {
		const b = DEFAULT_CONFIG.stickman;
		const s = this.bodyScale;
		const upperLeg = b.upperLegLength * s.legLength;
		const lowerLeg = b.lowerLegLength * s.legLength;
		const upperArm = b.upperArmLength * s.armLength;
		const forearm = b.forearmLength * s.armLength;

		const hip: Joint = { x: 0, y: -b.torsoLength };
		const neck: Joint = { x: 0, y: hip.y - b.torsoLength };
		const head: Joint = { x: 0, y: neck.y - b.neckLength - b.headRadius * s.headSize };
		const shoulderL: Joint = { x: -b.shoulderWidth, y: neck.y + 1 };
		const shoulderR: Joint = { x: b.shoulderWidth, y: neck.y + 1 };

		return {
			head, neck, shoulderL, shoulderR,
			elbowL: { x: shoulderL.x - 1, y: shoulderL.y + upperArm },
			elbowR: { x: shoulderR.x + 1, y: shoulderR.y + upperArm },
			handL: { x: shoulderL.x - 1, y: shoulderL.y + upperArm + forearm },
			handR: { x: shoulderR.x + 1, y: shoulderR.y + upperArm + forearm },
			hip,
			kneeL: { x: -1, y: hip.y + upperLeg },
			kneeR: { x: 1, y: hip.y + upperLeg },
			footL: { x: -1, y: hip.y + upperLeg + lowerLeg },
			footR: { x: 1, y: hip.y + upperLeg + lowerLeg }
		};
	}

	private toWorldCoords(relativePose: Pose): Pose {
		const world: Partial<Pose> = {};
		for (const name of JOINT_NAMES) {
			const joint = relativePose[name];
			world[name] = {
				x: this.x + joint.x * this.direction,
				y: this.y + joint.y
			};
		}
		return world as Pose;
	}

	draw(ctx: CanvasRenderingContext2D): void {
		if (!this.active) return;

		const colorStr = colorToHSL(this.color);
		const p = this.poseOverride ?? this.currentPose;

		ctx.save();

		// Apply body rotation around the grip point (average hand position)
		if (this.rotation !== 0) {
			const pivotX = (p.handL.x + p.handR.x) / 2;
			const pivotY = Math.min(p.handL.y, p.handR.y);
			ctx.translate(pivotX, pivotY);
			ctx.rotate(this.rotation);
			ctx.translate(-pivotX, -pivotY);
		}

		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		ctx.lineWidth = DEFAULT_CONFIG.stickman.strokeWidth;
		ctx.strokeStyle = colorStr;

		// Draw bones
		for (const [from, to] of BONES) {
			const a = p[from];
			const b = p[to];
			ctx.beginPath();
			ctx.moveTo(a.x, a.y);
			ctx.lineTo(b.x, b.y);
			ctx.stroke();
		}

		// Draw head
		const head = p.head;
		const headRadius = DEFAULT_CONFIG.stickman.headRadius * this.bodyScale.headSize;
		ctx.fillStyle = colorToHSLA(this.color, 0.3);
		ctx.strokeStyle = colorStr;
		ctx.beginPath();
		ctx.arc(head.x, head.y, headRadius, 0, Math.PI * 2);
		ctx.fill();
		ctx.stroke();

		// Draw hat
		if (this.hat) {
			const neck = p.neck;
			const angle = Math.atan2(
				head.x - neck.x,
				neck.y - head.y
			);
			this.hat.draw(ctx, head.x, head.y, headRadius, angle, colorStr, this.direction);
		}

		// Draw rope spool
		if (this.spoolSize > 0 && (this.animationId === 'throw' || this.animationId === 'idle')) {
			const hand = p.handR;
			const r = 2 * this.spoolSize;
			ctx.fillStyle = 'rgba(180, 140, 80, 0.8)';
			ctx.strokeStyle = 'rgba(140, 100, 50, 0.9)';
			ctx.lineWidth = 0.5;
			for (let i = 0; i < 3; i++) {
				const ox = (i - 1) * r * 0.4;
				const oy = (i - 1) * r * 0.3;
				ctx.beginPath();
				ctx.arc(hand.x + ox, hand.y + oy, r, 0, Math.PI * 2);
				ctx.fill();
				ctx.stroke();
			}
		}

		ctx.restore();
	}
}

// ── Factory ──────────────────────────────────────────────────────────

/** Clamp a body scale value to the supported range */
function clampScale(v: number): number {
	return Math.max(0.5, Math.min(v, DEFAULT_CONFIG.stickman.maxBodyScale));
}

/** Create a stickman with randomized personality */
export function createStickman(
	x: number,
	y: number,
	color: HSL,
	registry: AnimationRegistry,
	hatDef?: HatDef
): Stickman {
	const config: StickmanConfig = {
		color,
		speedMultiplier: 0.7 + Math.random() * 0.6,
		hatId: hatDef?.id ?? null,
		bodyScale: {
			legLength: clampScale(0.7 + Math.random() * 0.25),
			armLength: clampScale(0.7 + Math.random() * 0.25),
			headSize: clampScale(0.7 + Math.random() * 0.25)
		}
	};

	const stickman = new Stickman(x, y, config, registry);
	if (hatDef) stickman.hat = hatDef;
	return stickman;
}
