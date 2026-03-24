/**
 * Animation resolver factories and interpolation engine.
 *
 * All joint angles are in DEGREES. anglesToPose() converts to radians internally.
 */

import type { AnimationContext, AnimationResolver, AnimKeyframe, EasingType, KeyframeAnimationDef } from './types.js';
import type { JointAngles } from './types.js';
import type { BodyScale, Pose } from '../types.js';
import { BASE_BODY, jointFromAngle } from '../types.js';

// ── Helpers ──────────────────────────────────────────────────────────

const DEG = Math.PI / 180;

function applyEasing(t: number, easing: EasingType): number {
	switch (easing) {
		case 'ease-in': return t * t;
		case 'ease-out': return t * (2 - t);
		case 'ease-in-out': return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
		case 'step': return 0;
		default: return t;
	}
}

function lerpAngle(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

// ── Keyframe Interpolation ────────────────────────────────────────────

export function resolveAnglesAtTime(
	keyframes: AnimKeyframe[],
	time: number,
	isCyclic: boolean
): { angles: Required<JointAngles>; offsetX: number; offsetY: number } {
	// Default angles — standing pose, all values in DEGREES
	const defaults: Required<JointAngles> = {
		torso: 0,
		head: 0,
		shoulderL: 11,
		elbowL: 6,
		shoulderR: -11,
		elbowR: -6,
		hipL: 3,
		kneeL: 0,
		hipR: -3,
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
				if (value !== undefined) angles[key as keyof JointAngles] = value;
			}
		}
		return { angles, offsetX: kf.offset?.x ?? 0, offsetY: kf.offset?.y ?? 0 };
	}

	// Find surrounding keyframes
	let fromIdx = 0;
	for (let i = 0; i < keyframes.length; i++) {
		if (keyframes[i].t <= time) fromIdx = i;
	}

	const toIdx = isCyclic
		? (fromIdx + 1) % keyframes.length
		: Math.min(fromIdx + 1, keyframes.length - 1);

	const fromKf = keyframes[fromIdx];
	const toKf = keyframes[toIdx];

	let segmentT: number;
	if (fromIdx === toIdx) {
		segmentT = 0;
	} else {
		const fromTime = fromKf.t;
		let toTime = toKf.t;
		if (isCyclic && toTime <= fromTime) toTime += 1.0;
		let adjustedTime = time;
		if (isCyclic && adjustedTime < fromTime) adjustedTime += 1.0;
		const range = toTime - fromTime;
		segmentT = range > 0 ? (adjustedTime - fromTime) / range : 0;
	}

	const easing = fromKf.easing ?? 'linear';
	const easedT = applyEasing(Math.max(0, Math.min(1, segmentT)), easing);

	// Accumulate "from" angles through all keyframes up to fromIdx
	const fromAngles = { ...defaults };
	const toAngles = { ...defaults };

	for (let i = 0; i <= fromIdx; i++) {
		const kf = keyframes[i];
		if (kf.joints) {
			for (const [key, value] of Object.entries(kf.joints)) {
				if (value !== undefined) fromAngles[key as keyof JointAngles] = value;
			}
		}
	}

	Object.assign(toAngles, fromAngles);
	if (toKf.joints) {
		for (const [key, value] of Object.entries(toKf.joints)) {
			if (value !== undefined) toAngles[key as keyof JointAngles] = value;
		}
	}

	const result: Required<JointAngles> = { ...defaults };
	for (const key of Object.keys(defaults) as (keyof JointAngles)[]) {
		result[key] = lerpAngle(fromAngles[key], toAngles[key], easedT);
	}

	return {
		angles: result,
		offsetX: lerpAngle(fromKf.offset?.x ?? 0, toKf.offset?.x ?? 0, easedT),
		offsetY: lerpAngle(fromKf.offset?.y ?? 0, toKf.offset?.y ?? 0, easedT)
	};
}

// ── Pose Construction ────────────────────────────────────────────────

/**
 * Converts joint angles (degrees) + body scale into a local-space Pose.
 * Origin (0,0) is at feet. Negative Y = upward.
 * Exported for use by the animation editor.
 */
export function anglesToPose(
	angles: Required<JointAngles>,
	scale: BodyScale,
	offsetX: number,
	offsetY: number
): Pose {
	const b = BASE_BODY;
	const legLen = (b.upperLegLength + b.lowerLegLength) * scale.legLength;
	const torsoLen = b.torsoLength;
	const neckLen = b.neckLength;

	const torsoRad = angles.torso * DEG;
	const headRad = (angles.torso + angles.head) * DEG;

	const hip = { x: offsetX, y: -(legLen + offsetY) };
	const neck = jointFromAngle(hip, torsoRad, -torsoLen);
	const headBase = jointFromAngle(neck, headRad, -neckLen);
	const head = { x: headBase.x, y: headBase.y - b.headRadius * scale.headSize };

	const shoulderL = { x: neck.x - b.shoulderWidth * 0.5, y: neck.y };
	const shoulderR = { x: neck.x + b.shoulderWidth * 0.5, y: neck.y };

	const upperArmLen = b.upperArmLength * scale.armLength;
	const forearmLen = b.forearmLength * scale.armLength;

	const elbowL = jointFromAngle(shoulderL, angles.shoulderL * DEG, upperArmLen);
	const handL = jointFromAngle(elbowL, (angles.shoulderL + angles.elbowL) * DEG, forearmLen);
	const elbowR = jointFromAngle(shoulderR, angles.shoulderR * DEG, upperArmLen);
	const handR = jointFromAngle(elbowR, (angles.shoulderR + angles.elbowR) * DEG, forearmLen);

	const upperLegLen = b.upperLegLength * scale.legLength;
	const lowerLegLen = b.lowerLegLength * scale.legLength;

	const hipL = { x: hip.x - b.hipWidth * 0.5, y: hip.y };
	const hipR = { x: hip.x + b.hipWidth * 0.5, y: hip.y };

	const kneeL = jointFromAngle(hipL, angles.hipL * DEG, upperLegLen);
	const footL = jointFromAngle(kneeL, (angles.hipL + angles.kneeL) * DEG, lowerLegLen);
	const kneeR = jointFromAngle(hipR, angles.hipR * DEG, upperLegLen);
	const footR = jointFromAngle(kneeR, (angles.hipR + angles.kneeR) * DEG, lowerLegLen);

	return { head, neck, shoulderL, shoulderR, elbowL, elbowR, handL, handR, hip, kneeL, kneeR, footL, footR };
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Creates an AnimationResolver from a keyframe definition.
 * Joint angles are in degrees. This is the only animation authoring API.
 */
export function createKeyframeAnimation(def: KeyframeAnimationDef): AnimationResolver {
	const sortedKeyframes = [...def.keyframes].sort((a, b) => a.t - b.t);

	return {
		id: def.id,
		type: def.type,
		frameCount: def.frameCount,
		resolve(ctx: AnimationContext): Pose {
			const time = def.type === 'cyclic' ? ctx.phase / (2 * Math.PI) : ctx.phase;
			const { angles, offsetX, offsetY } = resolveAnglesAtTime(sortedKeyframes, time, def.type === 'cyclic');
			return anglesToPose(angles, ctx.bodyScale, offsetX, offsetY);
		}
	};
}
