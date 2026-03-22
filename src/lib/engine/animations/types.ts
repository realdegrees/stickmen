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
 * Joint angles in radians, relative to parent joint in the hierarchy.
 * Positive angles rotate clockwise (toward positive X when parent points down).
 *
 * Hierarchy:
 *   root (feet position)
 *     └─ hip
 *         ├─ torso (lean angle from vertical)
 *         │   ├─ head (tilt relative to neck)
 *         │   ├─ shoulderL → elbowL
 *         │   └─ shoulderR → elbowR
 *         ├─ hipL → kneeL
 *         └─ hipR → kneeR
 */
export interface JointAngles {
	/** Torso lean from vertical (positive = lean right/forward) */
	torso?: number;
	/** Head tilt relative to neck */
	head?: number;
	/** Left arm swing from shoulder */
	shoulderL?: number;
	/** Left forearm bend */
	elbowL?: number;
	/** Right arm swing from shoulder */
	shoulderR?: number;
	/** Right forearm bend */
	elbowR?: number;
	/** Left leg swing from hip */
	hipL?: number;
	/** Left knee bend */
	kneeL?: number;
	/** Right leg swing from hip */
	hipR?: number;
	/** Right knee bend */
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
