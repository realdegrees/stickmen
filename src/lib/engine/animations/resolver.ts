import type { Pose, BodyScale } from '../types.js';
import { BASE_BODY, jointFromAngle } from '../types.js';
import type {
	AnimationContext,
	AnimationResolver,
	AnimKeyframe,
	EasingType,
	JointAngles,
	KeyframeAnimationDef
} from './types.js';

// ── Easing Functions ─────────────────────────────────────────────────

function applyEasing(t: number, easing: EasingType): number {
	switch (easing) {
		case 'linear':
			return t;
		case 'ease-in':
			return t * t;
		case 'ease-out':
			return t * (2 - t);
		case 'ease-in-out':
			return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
		case 'step':
			return 0; // always use the "from" keyframe value
		default:
			return t;
	}
}

// ── Keyframe Interpolation ───────────────────────────────────────────

function lerpAngle(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

/**
 * Resolves joint angles at a given normalized time by interpolating
 * between surrounding keyframes.
 */
function resolveAnglesAtTime(
	keyframes: AnimKeyframe[],
	time: number,
	isCyclic: boolean
): { angles: Required<JointAngles>; offsetX: number; offsetY: number } {
	// Default angles (standing pose)
	const defaults: Required<JointAngles> = {
		torso: 0,
		head: 0,
		shoulderL: 0.2,
		elbowL: 0.1,
		shoulderR: -0.2,
		elbowR: -0.1,
		hipL: 0.05,
		kneeL: 0,
		hipR: -0.05,
		kneeR: 0
	};

	if (keyframes.length === 0) {
		return { angles: defaults, offsetX: 0, offsetY: 0 };
	}

	if (keyframes.length === 1) {
		const kf = keyframes[0];
		const angles = { ...defaults };
		if (kf.joints) {
			for (const [key, value] of Object.entries(kf.joints)) {
				if (value !== undefined) {
					angles[key as keyof JointAngles] = value;
				}
			}
		}
		return {
			angles,
			offsetX: kf.offset?.x ?? 0,
			offsetY: kf.offset?.y ?? 0
		};
	}

	// Find surrounding keyframes
	let fromIdx = 0;
	let toIdx = 1;

	for (let i = 0; i < keyframes.length; i++) {
		if (keyframes[i].t <= time) {
			fromIdx = i;
		}
	}

	if (isCyclic) {
		toIdx = (fromIdx + 1) % keyframes.length;
	} else {
		toIdx = Math.min(fromIdx + 1, keyframes.length - 1);
	}

	const fromKf = keyframes[fromIdx];
	const toKf = keyframes[toIdx];

	// Calculate interpolation factor
	let segmentT: number;
	if (fromIdx === toIdx) {
		segmentT = 0;
	} else {
		const fromTime = fromKf.t;
		let toTime = toKf.t;
		if (isCyclic && toTime <= fromTime) {
			toTime += 1.0; // wrap around
		}
		let adjustedTime = time;
		if (isCyclic && adjustedTime < fromTime) {
			adjustedTime += 1.0;
		}
		const range = toTime - fromTime;
		segmentT = range > 0 ? (adjustedTime - fromTime) / range : 0;
	}

	const easing = fromKf.easing ?? 'linear';
	const easedT = applyEasing(Math.max(0, Math.min(1, segmentT)), easing);

	// Build resolved angles by accumulating through keyframes up to fromIdx,
	// then interpolating to toIdx
	const fromAngles = { ...defaults };
	const toAngles = { ...defaults };

	// Accumulate "from" angles from all keyframes up to fromIdx
	for (let i = 0; i <= fromIdx; i++) {
		const kf = keyframes[i];
		if (kf.joints) {
			for (const [key, value] of Object.entries(kf.joints)) {
				if (value !== undefined) {
					fromAngles[key as keyof JointAngles] = value;
				}
			}
		}
	}

	// "to" angles start from "from" angles, then apply toKf overrides
	Object.assign(toAngles, fromAngles);
	if (toKf.joints) {
		for (const [key, value] of Object.entries(toKf.joints)) {
			if (value !== undefined) {
				toAngles[key as keyof JointAngles] = value;
			}
		}
	}

	// Interpolate
	const result: Required<JointAngles> = { ...defaults };
	for (const key of Object.keys(defaults) as (keyof JointAngles)[]) {
		result[key] = lerpAngle(fromAngles[key], toAngles[key], easedT);
	}

	// Interpolate offset
	const fromOffsetX = fromKf.offset?.x ?? 0;
	const fromOffsetY = fromKf.offset?.y ?? 0;
	const toOffsetX = toKf.offset?.x ?? 0;
	const toOffsetY = toKf.offset?.y ?? 0;

	return {
		angles: result,
		offsetX: lerpAngle(fromOffsetX, toOffsetX, easedT),
		offsetY: lerpAngle(fromOffsetY, toOffsetY, easedT)
	};
}

// ── Angles to Pose Conversion ────────────────────────────────────────

/**
 * Converts joint angles + body scale into a local-space Pose.
 * Origin (0,0) is at the feet position.
 * Negative Y = upward.
 */
function anglesToPose(
	angles: Required<JointAngles>,
	scale: BodyScale,
	offsetX: number,
	offsetY: number
): Pose {
	const b = BASE_BODY;
	const legLen = (b.upperLegLength + b.lowerLegLength) * scale.legLength;
	const torsoLen = b.torsoLength;
	const neckLen = b.neckLength;

	// Hip is above feet by leg length + offset
	const hip = {
		x: offsetX,
		y: -(legLen + offsetY)
	};

	// Torso/neck from hip
	const neck = jointFromAngle(hip, angles.torso, -torsoLen);

	// Head from neck
	const headBase = jointFromAngle(neck, angles.torso + angles.head, -neckLen);
	const head = {
		x: headBase.x,
		y: headBase.y - b.headRadius * scale.headSize
	};

	// Shoulders from neck
	const shoulderL = {
		x: neck.x - b.shoulderWidth * 0.5,
		y: neck.y
	};
	const shoulderR = {
		x: neck.x + b.shoulderWidth * 0.5,
		y: neck.y
	};

	// Arms
	const upperArmLen = b.upperArmLength * scale.armLength;
	const forearmLen = b.forearmLength * scale.armLength;

	const elbowL = jointFromAngle(shoulderL, angles.shoulderL, upperArmLen);
	const handL = jointFromAngle(elbowL, angles.shoulderL + angles.elbowL, forearmLen);
	const elbowR = jointFromAngle(shoulderR, angles.shoulderR, upperArmLen);
	const handR = jointFromAngle(elbowR, angles.shoulderR + angles.elbowR, forearmLen);

	// Legs
	const upperLegLen = b.upperLegLength * scale.legLength;
	const lowerLegLen = b.lowerLegLength * scale.legLength;

	const hipL = { x: hip.x - b.hipWidth * 0.5, y: hip.y };
	const hipR = { x: hip.x + b.hipWidth * 0.5, y: hip.y };

	const kneeL = jointFromAngle(hipL, angles.hipL, upperLegLen);
	const footL = jointFromAngle(kneeL, angles.hipL + angles.kneeL, lowerLegLen);
	const kneeR = jointFromAngle(hipR, angles.hipR, upperLegLen);
	const footR = jointFromAngle(kneeR, angles.hipR + angles.kneeR, lowerLegLen);

	return {
		head,
		neck,
		shoulderL,
		shoulderR,
		elbowL,
		elbowR,
		handL,
		handR,
		hip,
		kneeL,
		kneeR,
		footL,
		footR
	};
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Creates an AnimationResolver from a keyframe definition.
 * This is the "non raw-code" path for defining custom animations.
 */
export function createKeyframeAnimation(def: KeyframeAnimationDef): AnimationResolver {
	// Sort keyframes by time
	const sortedKeyframes = [...def.keyframes].sort((a, b) => a.t - b.t);

	return {
		id: def.id,
		type: def.type,
		frameCount: def.frameCount,
		resolve(ctx: AnimationContext): Pose {
			// Convert phase to normalized time (0–1)
			const time = def.type === 'cyclic' ? ctx.phase / (2 * Math.PI) : ctx.phase;

			const { angles, offsetX, offsetY } = resolveAnglesAtTime(
				sortedKeyframes,
				time,
				def.type === 'cyclic'
			);

			return anglesToPose(angles, ctx.bodyScale, offsetX, offsetY);
		}
	};
}

/**
 * Creates an AnimationResolver from a procedural function.
 * Used by built-in animations that need full trig expressiveness.
 */
export function createProceduralAnimation(
	id: string,
	type: 'cyclic' | 'oneshot',
	frameCount: number,
	fn: (ctx: AnimationContext) => Pose
): AnimationResolver {
	return { id, type, frameCount, resolve: fn };
}
