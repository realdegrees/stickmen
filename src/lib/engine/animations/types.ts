import type { BodyScale, Pose } from '../types.js';

/**
 * Context passed to animation resolvers each frame.
 */
export interface AnimationContext {
	/** 0→2π for cyclic, 0→1 for oneshot */
	phase: number;
	/** Integer frame counter (increments per pose-update tick) */
	frameIndex: number;
	/** Per-stickman body proportions */
	bodyScale: BodyScale;
	/** Animation-specific parameters (e.g. { speed: 1.4 }, { subPhase: 0.6 }) */
	params: Record<string, number>;
}

/**
 * The universal animation contract.
 * Both procedural and keyframe animations implement this.
 */
export interface AnimationResolver {
	/** Unique animation identifier */
	id: string;
	/** Whether this animation loops or plays once */
	type: 'cyclic' | 'oneshot';
	/** Number of pose-update frames per cycle (cyclic) or total (oneshot) */
	frameCount: number;
	/** Given context, produce a local-space pose (feet at origin) */
	resolve(ctx: AnimationContext): Pose;
}

// ── Keyframe Animation Definition ────────────────────────────────────

/**
 * Easing function type for keyframe interpolation.
 * 'step' = no interpolation, snap to keyframe value.
 */
export type EasingType = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'step';

/**
 * Joint angles in DEGREES.
 * 0° = pointing straight down from the parent joint.
 * Positive angles rotate clockwise (right), negative counter-clockwise (left).
 * 180° / -180° = pointing straight up.
 *
 * Hierarchy:
 *   root (feet position)
 *     └─ hip
 *         ├─ torso (lean from vertical)
 *         │   ├─ head (tilt relative to neck direction)
 *         │   ├─ shoulderL → elbowL  (elbowL is additional bend, added to shoulderL)
 *         │   └─ shoulderR → elbowR
 *         ├─ hipL → kneeL            (kneeL is additional bend, added to hipL)
 *         └─ hipR → kneeR
 */
export interface JointAngles {
	/** Torso lean from vertical in degrees */
	torso?: number;
	/** Head tilt in degrees */
	head?: number;
	/** Left shoulder angle in degrees */
	shoulderL?: number;
	/** Left elbow additional bend in degrees */
	elbowL?: number;
	/** Right shoulder angle in degrees */
	shoulderR?: number;
	/** Right elbow additional bend in degrees */
	elbowR?: number;
	/** Left hip angle in degrees */
	hipL?: number;
	/** Left knee additional bend in degrees */
	kneeL?: number;
	/** Right hip angle in degrees */
	hipR?: number;
	/** Right knee additional bend in degrees */
	kneeR?: number;
}

/**
 * A single keyframe in a keyframe animation.
 */
export interface AnimKeyframe {
	/** Normalized time in the cycle: 0.0 = start, 1.0 = end */
	t: number;
	/** Easing from THIS keyframe to the NEXT. Default: 'linear' */
	easing?: EasingType;
	/** Joint angles at this keyframe. Omitted joints hold previous value. */
	joints?: JointAngles;
	/** Hip displacement from default standing position */
	offset?: { x?: number; y?: number };
}

/**
 * A complete keyframe animation definition.
 * JSON-serializable, no code required.
 */
export interface KeyframeAnimationDef {
	id: string;
	type: 'cyclic' | 'oneshot';
	frameCount: number;
	keyframes: AnimKeyframe[];
}
