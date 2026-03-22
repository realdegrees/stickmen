/**
 * Built-in procedural animations.
 * These are the battle-tested animations from the original system,
 * wrapped as AnimationResolver instances.
 */

import type { Pose, BodyScale, Joint } from '../types.js';
import { BASE_BODY, jointFromAngle } from '../types.js';
import type { AnimationContext, AnimationResolver } from './types.js';
import { createProceduralAnimation } from './resolver.js';

// ── Pose Functions ───────────────────────────────────────────────────

function calculateRunPose(phase: number, s: BodyScale, speed: number): Pose {
	const b = BASE_BODY;

	const hipBob = Math.sin(phase * 2) * 1.2;
	const hip: Joint = { x: 0, y: -b.torsoLength + hipBob };

	const leanAngle = 0.15 * speed;
	const neck: Joint = {
		x: hip.x + Math.sin(leanAngle) * b.torsoLength,
		y: hip.y - Math.cos(leanAngle) * b.torsoLength
	};

	const headBob = Math.sin(phase * 2) * 0.5;
	const head: Joint = {
		x: neck.x + Math.sin(leanAngle) * (b.neckLength + b.headRadius),
		y: neck.y - b.neckLength - b.headRadius + headBob
	};

	const strideAmplitude = 0.8 * speed;
	const upperLeg = b.upperLegLength * s.legLength;
	const lowerLeg = b.lowerLegLength * s.legLength;

	const lHipAngle = Math.sin(phase) * strideAmplitude;
	const kneeL = jointFromAngle(hip, lHipAngle, upperLeg);
	const lKneeBend = Math.max(0, -Math.sin(phase)) * 1.2 + 0.2;
	const footL = jointFromAngle(kneeL, lHipAngle - lKneeBend, lowerLeg);

	const rHipAngle = Math.sin(phase + Math.PI) * strideAmplitude;
	const kneeR = jointFromAngle(hip, rHipAngle, upperLeg);
	const rKneeBend = Math.max(0, -Math.sin(phase + Math.PI)) * 1.2 + 0.2;
	const footR = jointFromAngle(kneeR, rHipAngle - rKneeBend, lowerLeg);

	const upperArm = b.upperArmLength * s.armLength;
	const forearm = b.forearmLength * s.armLength;

	const shoulderL: Joint = { x: neck.x - b.shoulderWidth, y: neck.y + 1 };
	const shoulderR: Joint = { x: neck.x + b.shoulderWidth, y: neck.y + 1 };

	const lArmSwing = Math.sin(phase + Math.PI) * 0.6 * speed;
	const elbowL = jointFromAngle(shoulderL, lArmSwing, upperArm);
	const lElbowBend = 0.5 + Math.sin(phase + Math.PI) * 0.3;
	const handL = jointFromAngle(elbowL, lArmSwing + lElbowBend, forearm);

	const rArmSwing = Math.sin(phase) * 0.6 * speed;
	const elbowR = jointFromAngle(shoulderR, rArmSwing, upperArm);
	const rElbowBend = 0.5 + Math.sin(phase) * 0.3;
	const handR = jointFromAngle(elbowR, rArmSwing + rElbowBend, forearm);

	return {
		head, neck, shoulderL, shoulderR, elbowL, elbowR,
		handL, handR, hip, kneeL, kneeR, footL, footR
	};
}

function idlePose(phase: number, s: BodyScale): Pose {
	const b = BASE_BODY;
	const upperArm = b.upperArmLength * s.armLength;
	const forearm = b.forearmLength * s.armLength;
	const upperLeg = b.upperLegLength * s.legLength;
	const lowerLeg = b.lowerLegLength * s.legLength;

	const slow = Math.sin(phase);
	const med = Math.sin(phase * 1.7 + 0.5) * 0.5;
	const fast = Math.sin(phase * 2.3 + 1.2) * 0.3;

	const sway = slow * 0.4;
	const hip: Joint = { x: sway, y: -b.torsoLength + Math.sin(phase * 1.3) * 0.3 };
	const neck: Joint = { x: sway * 0.6 + med * 0.15, y: hip.y - b.torsoLength };
	const head: Joint = {
		x: sway * 0.3 + fast * 0.3,
		y: neck.y - b.neckLength - b.headRadius + Math.sin(phase * 0.8 + 0.7) * 0.2
	};

	const shoulderL: Joint = { x: neck.x - b.shoulderWidth, y: neck.y + 1 };
	const shoulderR: Joint = { x: neck.x + b.shoulderWidth, y: neck.y + 1 };

	const lArmDrift = 0.2 + slow * 0.08 + med * 0.05;
	const rArmDrift = -0.2 + slow * 0.06 - fast * 0.04;
	const elbowL = jointFromAngle(shoulderL, lArmDrift, upperArm);
	const handL = jointFromAngle(elbowL, lArmDrift + 0.2 + med * 0.08, forearm);
	const elbowR = jointFromAngle(shoulderR, rArmDrift, upperArm);
	const handR = jointFromAngle(elbowR, rArmDrift - 0.2 + fast * 0.06, forearm);

	const legShift = slow * 0.03;
	const kneeL = jointFromAngle(hip, 0.15 + legShift, upperLeg);
	const footL = jointFromAngle(kneeL, 0.05, lowerLeg);
	const kneeR = jointFromAngle(hip, -0.15 + legShift, upperLeg);
	const footR = jointFromAngle(kneeR, -0.05, lowerLeg);

	return {
		head, neck, shoulderL, shoulderR, elbowL, elbowR,
		handL, handR, hip, kneeL, kneeR, footL, footR
	};
}

function fleePose(phase: number, s: BodyScale): Pose {
	const b = BASE_BODY;
	const upperArm = b.upperArmLength * s.armLength;
	const forearm = b.forearmLength * s.armLength;

	const pose = calculateRunPose(phase, s, 1.4);

	// Panicked head tilt
	pose.head.x -= 1.5;

	// Recalculate shoulders from neck
	const neck = pose.neck;
	const shL: Joint = { x: neck.x - b.shoulderWidth, y: neck.y + 1 };
	const shR: Joint = { x: neck.x + b.shoulderWidth, y: neck.y + 1 };
	pose.shoulderL = shL;
	pose.shoulderR = shR;

	// High-frequency asymmetric flailing arms
	const flailPhase = phase * 3;
	const lArmAngle = -2.0 + Math.sin(flailPhase) * 0.7;
	const rArmAngle = -2.0 + Math.sin(flailPhase + Math.PI * 0.7) * 0.7;

	pose.elbowL = jointFromAngle(shL, lArmAngle, upperArm);
	pose.elbowR = jointFromAngle(shR, rArmAngle, upperArm);

	const lElbowBend = -0.3 + Math.sin(flailPhase * 1.3 + 1.0) * 0.5;
	const rElbowBend = -0.3 + Math.sin(flailPhase * 1.3 + 2.5) * 0.5;
	pose.handL = jointFromAngle(pose.elbowL, lArmAngle + lElbowBend, forearm);
	pose.handR = jointFromAngle(pose.elbowR, rArmAngle + rElbowBend, forearm);

	return pose;
}

function jumpPose(subPhase: number, s: BodyScale): Pose {
	const b = BASE_BODY;
	const upperArm = b.upperArmLength * s.armLength;
	const forearm = b.forearmLength * s.armLength;
	const upperLeg = b.upperLegLength * s.legLength;
	const lowerLeg = b.lowerLegLength * s.legLength;

	if (subPhase < 0.15) {
		const t = subPhase / 0.15;
		const crouch = t * 4;
		const hip: Joint = { x: 0, y: -b.torsoLength + crouch };
		const neck: Joint = { x: 0.5, y: hip.y - b.torsoLength * 0.9 };
		const head: Joint = { x: 0.5, y: neck.y - b.neckLength - b.headRadius };
		const shoulderL: Joint = { x: neck.x - b.shoulderWidth, y: neck.y + 1 };
		const shoulderR: Joint = { x: neck.x + b.shoulderWidth, y: neck.y + 1 };
		const elbowL = jointFromAngle(shoulderL, 0.6 + t * 0.3, upperArm);
		const handL = jointFromAngle(elbowL, 0.8 + t * 0.4, forearm);
		const elbowR = jointFromAngle(shoulderR, -0.6 - t * 0.3, upperArm);
		const handR = jointFromAngle(elbowR, -0.8 - t * 0.4, forearm);
		const kneeL = jointFromAngle(hip, 0.3 + t * 0.5, upperLeg);
		const footL = jointFromAngle(kneeL, -0.2 - t * 0.6, lowerLeg);
		const kneeR = jointFromAngle(hip, -0.3 - t * 0.5, upperLeg);
		const footR = jointFromAngle(kneeR, 0.2 + t * 0.6, lowerLeg);
		return { head, neck, shoulderL, shoulderR, elbowL, elbowR, handL, handR, hip, kneeL, kneeR, footL, footR };
	} else if (subPhase < 0.25) {
		const t = (subPhase - 0.15) / 0.1;
		const hip: Joint = { x: 1, y: -b.torsoLength - 2 - t * 2 };
		const neck: Joint = { x: 0.5, y: hip.y - b.torsoLength };
		const head: Joint = { x: 0, y: neck.y - b.neckLength - b.headRadius };
		const shoulderL: Joint = { x: neck.x - b.shoulderWidth, y: neck.y + 1 };
		const shoulderR: Joint = { x: neck.x + b.shoulderWidth, y: neck.y + 1 };
		const elbowL = jointFromAngle(shoulderL, -0.5 - t * 0.5, upperArm);
		const handL = jointFromAngle(elbowL, -0.8 - t * 0.3, forearm);
		const elbowR = jointFromAngle(shoulderR, 0.5 + t * 0.5, upperArm);
		const handR = jointFromAngle(elbowR, 0.8 + t * 0.3, forearm);
		const kneeL = jointFromAngle(hip, 0.1, upperLeg);
		const footL = jointFromAngle(kneeL, 0.2, lowerLeg);
		const kneeR = jointFromAngle(hip, -0.1, upperLeg);
		const footR = jointFromAngle(kneeR, -0.2, lowerLeg);
		return { head, neck, shoulderL, shoulderR, elbowL, elbowR, handL, handR, hip, kneeL, kneeR, footL, footR };
	} else if (subPhase < 0.75) {
		const hip: Joint = { x: 0, y: -b.torsoLength - 3 };
		const neck: Joint = { x: 0, y: hip.y - b.torsoLength };
		const head: Joint = { x: 0, y: neck.y - b.neckLength - b.headRadius };
		const shoulderL: Joint = { x: -b.shoulderWidth, y: neck.y + 1 };
		const shoulderR: Joint = { x: b.shoulderWidth, y: neck.y + 1 };
		const elbowL = jointFromAngle(shoulderL, -0.7, upperArm);
		const handL = jointFromAngle(elbowL, -0.9, forearm);
		const elbowR = jointFromAngle(shoulderR, 0.7, upperArm);
		const handR = jointFromAngle(elbowR, 0.9, forearm);
		const kneeL = jointFromAngle(hip, 0.4, upperLeg);
		const footL = jointFromAngle(kneeL, 0.2, lowerLeg);
		const kneeR = jointFromAngle(hip, -0.4, upperLeg);
		const footR = jointFromAngle(kneeR, -0.2, lowerLeg);
		return { head, neck, shoulderL, shoulderR, elbowL, elbowR, handL, handR, hip, kneeL, kneeR, footL, footR };
	} else if (subPhase < 0.9) {
		const t = (subPhase - 0.75) / 0.15;
		const hip: Joint = { x: 0, y: -b.torsoLength - 1 + t * 2 };
		const neck: Joint = { x: 0.5 * t, y: hip.y - b.torsoLength };
		const head: Joint = { x: 0.5 * t, y: neck.y - b.neckLength - b.headRadius };
		const shoulderL: Joint = { x: neck.x - b.shoulderWidth, y: neck.y + 1 };
		const shoulderR: Joint = { x: neck.x + b.shoulderWidth, y: neck.y + 1 };
		const elbowL = jointFromAngle(shoulderL, -0.3 + t * 0.5, upperArm);
		const handL = jointFromAngle(elbowL, -0.3, forearm);
		const elbowR = jointFromAngle(shoulderR, 0.3 - t * 0.5, upperArm);
		const handR = jointFromAngle(elbowR, 0.3, forearm);
		const kneeL = jointFromAngle(hip, 0.15, upperLeg);
		const footL = jointFromAngle(kneeL, 0.1, lowerLeg);
		const kneeR = jointFromAngle(hip, -0.15, upperLeg);
		const footR = jointFromAngle(kneeR, -0.1, lowerLeg);
		return { head, neck, shoulderL, shoulderR, elbowL, elbowR, handL, handR, hip, kneeL, kneeR, footL, footR };
	} else {
		const t = (subPhase - 0.9) / 0.1;
		const crouch = (1 - t) * 3;
		const hip: Joint = { x: 0, y: -b.torsoLength + crouch };
		const neck: Joint = { x: 0, y: hip.y - b.torsoLength * (0.85 + t * 0.15) };
		const head: Joint = { x: 0, y: neck.y - b.neckLength - b.headRadius };
		const shoulderL: Joint = { x: neck.x - b.shoulderWidth, y: neck.y + 1 };
		const shoulderR: Joint = { x: neck.x + b.shoulderWidth, y: neck.y + 1 };
		const elbowL = jointFromAngle(shoulderL, 0.2, upperArm);
		const handL = jointFromAngle(elbowL, 0.3 + (1 - t) * 0.3, forearm);
		const elbowR = jointFromAngle(shoulderR, -0.2, upperArm);
		const handR = jointFromAngle(elbowR, -0.3 - (1 - t) * 0.3, forearm);
		const kneeL = jointFromAngle(hip, 0.15 + (1 - t) * 0.4, upperLeg);
		const footL = jointFromAngle(kneeL, -(1 - t) * 0.3, lowerLeg);
		const kneeR = jointFromAngle(hip, -0.15 - (1 - t) * 0.4, upperLeg);
		const footR = jointFromAngle(kneeR, (1 - t) * 0.3, lowerLeg);
		return { head, neck, shoulderL, shoulderR, elbowL, elbowR, handL, handR, hip, kneeL, kneeR, footL, footR };
	}
}

function throwingPose(frame: number, s: BodyScale): Pose {
	const b = BASE_BODY;
	const upperArm = b.upperArmLength * s.armLength;
	const forearm = b.forearmLength * s.armLength;
	const upperLeg = b.upperLegLength * s.legLength;
	const lowerLeg = b.lowerLegLength * s.legLength;

	const leanAngle = -0.25;
	const hip: Joint = { x: 0, y: -b.torsoLength };
	const neck: Joint = {
		x: hip.x + Math.sin(leanAngle) * b.torsoLength,
		y: hip.y - Math.cos(leanAngle) * b.torsoLength
	};
	const head: Joint = {
		x: neck.x + Math.sin(leanAngle) * (b.neckLength + b.headRadius) - 0.5,
		y: neck.y - (b.neckLength + b.headRadius) * 1.1
	};

	const shoulderL: Joint = { x: neck.x - b.shoulderWidth, y: neck.y + 1 };
	const shoulderR: Joint = { x: neck.x + b.shoulderWidth, y: neck.y + 1 };

	const elbowL = jointFromAngle(shoulderL, 0.4, upperArm);
	const handL = jointFromAngle(elbowL, 0.7, forearm);

	const kneeL = jointFromAngle(hip, 0.3, upperLeg);
	const footL = jointFromAngle(kneeL, 0.1, lowerLeg);
	const kneeR = jointFromAngle(hip, -0.25, upperLeg);
	const footR = jointFromAngle(kneeR, -0.1, lowerLeg);

	const isForward = frame % 2 === 1;
	const armAngle = isForward ? -1.1 : -2.2;
	const elbowBend = isForward ? -0.9 : -0.4;

	const elbowR = jointFromAngle(shoulderR, armAngle, upperArm);
	const handR = jointFromAngle(elbowR, armAngle + elbowBend, forearm);

	return {
		head, neck, shoulderL, shoulderR, elbowL, elbowR,
		handL, handR, hip, kneeL, kneeR, footL, footR
	};
}

function plantingPose(frame: number, s: BodyScale): Pose {
	const b = BASE_BODY;
	const upperArm = b.upperArmLength * s.armLength;
	const forearm = b.forearmLength * s.armLength;
	const upperLeg = b.upperLegLength * s.legLength;
	const lowerLeg = b.lowerLegLength * s.legLength;

	const isPlanted = frame % 2 === 1;
	const hip: Joint = { x: 0, y: -5 };
	const neck: Joint = { x: 1, y: hip.y - b.torsoLength * 0.75 };
	const head: Joint = { x: 1.5, y: neck.y - b.neckLength - b.headRadius + 1 };

	const shoulderL: Joint = { x: neck.x - b.shoulderWidth, y: neck.y + 1 };
	const shoulderR: Joint = { x: neck.x + b.shoulderWidth, y: neck.y + 1 };

	const rArmAngle = isPlanted ? 0.8 : -0.4;
	const elbowR = jointFromAngle(shoulderR, rArmAngle, upperArm);
	const handR = jointFromAngle(elbowR, rArmAngle + 0.5, forearm);

	const elbowL = jointFromAngle(shoulderL, 0.5, upperArm);
	const handL = jointFromAngle(elbowL, 0.9, forearm);

	const kneeL = jointFromAngle(hip, 0.5, upperLeg * 0.8);
	const footL = jointFromAngle(kneeL, -0.2, lowerLeg * 0.8);
	const kneeR = jointFromAngle(hip, -0.4, upperLeg * 0.8);
	const footR = jointFromAngle(kneeR, 0.2, lowerLeg * 0.8);

	return {
		head, neck, shoulderL, shoulderR, elbowL, elbowR,
		handL, handR, hip, kneeL, kneeR, footL, footR
	};
}

function hangingPose(frame: number, s: BodyScale): Pose {
	const b = BASE_BODY;
	const upperArm = b.upperArmLength * s.armLength;
	const forearm = b.forearmLength * s.armLength;
	const upperLeg = b.upperLegLength * s.legLength;
	const lowerLeg = b.lowerLegLength * s.legLength;

	const sway = frame === 0 ? 0 : 1;

	const handLPos: Joint = { x: -2, y: -b.torsoLength * 2 - 6 };
	const handRPos: Joint = { x: 2, y: -b.torsoLength * 2 - 6 };

	const elbowL = jointFromAngle(handLPos, 0.3, -forearm);
	const elbowR = jointFromAngle(handRPos, -0.3, -forearm);
	const shoulderL: Joint = { x: elbowL.x + 1, y: elbowL.y + upperArm * 0.8 };
	const shoulderR: Joint = { x: elbowR.x - 1, y: elbowR.y + upperArm * 0.8 };

	const neck: Joint = { x: sway * 0.5, y: (shoulderL.y + shoulderR.y) / 2 + 1 };
	const head: Joint = { x: neck.x + sway * 0.3, y: neck.y - b.neckLength - b.headRadius };
	const hip: Joint = { x: sway * 0.3, y: neck.y + b.torsoLength };

	const kneeL = jointFromAngle(hip, 0.1 + sway * 0.1, upperLeg);
	const footL = jointFromAngle(kneeL, 0.05, lowerLeg);
	const kneeR = jointFromAngle(hip, -0.1 + sway * 0.1, upperLeg);
	const footR = jointFromAngle(kneeR, -0.05, lowerLeg);

	return {
		head, neck, shoulderL, shoulderR, elbowL, elbowR,
		handL: handLPos, handR: handRPos, hip, kneeL, kneeR, footL, footR
	};
}

function grabbedPose(frame: number, s: BodyScale): Pose {
	const b = BASE_BODY;
	const upperArm = b.upperArmLength * s.armLength;
	const forearm = b.forearmLength * s.armLength;
	const upperLeg = b.upperLegLength * s.legLength;
	const lowerLeg = b.lowerLegLength * s.legLength;

	const sway = frame === 0 ? -0.5 : 0.5;
	const hip: Joint = { x: sway, y: -b.torsoLength + 3 };
	const neck: Joint = { x: sway * 0.5, y: hip.y - b.torsoLength };
	const head: Joint = { x: sway * 0.7, y: neck.y - b.neckLength - b.headRadius };

	const shoulderL: Joint = { x: neck.x - b.shoulderWidth, y: neck.y + 1 };
	const shoulderR: Joint = { x: neck.x + b.shoulderWidth, y: neck.y + 1 };

	const elbowL = jointFromAngle(shoulderL, 0.3 + sway * 0.2, upperArm);
	const handL = jointFromAngle(elbowL, 0.6, forearm);
	const elbowR = jointFromAngle(shoulderR, -0.3 + sway * 0.2, upperArm);
	const handR = jointFromAngle(elbowR, -0.6, forearm);

	const kneeL = jointFromAngle(hip, 0.2 + sway * 0.1, upperLeg);
	const footL = jointFromAngle(kneeL, 0.1, lowerLeg);
	const kneeR = jointFromAngle(hip, -0.2 + sway * 0.1, upperLeg);
	const footR = jointFromAngle(kneeR, -0.1, lowerLeg);

	return {
		head, neck, shoulderL, shoulderR, elbowL, elbowR,
		handL, handR, hip, kneeL, kneeR, footL, footR
	};
}

function hidingPose(frame: number, s: BodyScale): Pose {
	const b = BASE_BODY;
	const upperArm = b.upperArmLength * s.armLength;
	const forearm = b.forearmLength * s.armLength;
	const upperLeg = b.upperLegLength * s.legLength;
	const lowerLeg = b.lowerLegLength * s.legLength;

	const peek = frame === 2 ? 2 : 0;
	const hip: Joint = { x: 0, y: -5 };
	const neck: Joint = { x: peek, y: hip.y - b.torsoLength * 0.7 };
	const head: Joint = { x: peek * 1.3, y: neck.y - b.neckLength - b.headRadius + 1 };

	const shoulderL: Joint = { x: neck.x - b.shoulderWidth, y: neck.y + 1 };
	const shoulderR: Joint = { x: neck.x + b.shoulderWidth, y: neck.y + 1 };

	const elbowL = jointFromAngle(shoulderL, 0.8, upperArm * 0.8);
	const handL = jointFromAngle(elbowL, 1.2, forearm * 0.8);
	const elbowR = jointFromAngle(shoulderR, -0.8, upperArm * 0.8);
	const handR = jointFromAngle(elbowR, -1.2, forearm * 0.8);

	const kneeL = jointFromAngle(hip, 0.6, upperLeg * 0.7);
	const footL = jointFromAngle(kneeL, -0.3, lowerLeg * 0.8);
	const kneeR = jointFromAngle(hip, -0.6, upperLeg * 0.7);
	const footR = jointFromAngle(kneeR, 0.3, lowerLeg * 0.8);

	return {
		head, neck, shoulderL, shoulderR, elbowL, elbowR,
		handL, handR, hip, kneeL, kneeR, footL, footR
	};
}

function ropeClimbPose(phase: number, s: BodyScale): Pose {
	const b = BASE_BODY;
	const upperArm = b.upperArmLength * s.armLength;
	const forearm = b.forearmLength * s.armLength;
	const upperLeg = b.upperLegLength * s.legLength;
	const lowerLeg = b.lowerLegLength * s.legLength;

	const bodyOffset = 3;
	const grip = Math.sin(phase);

	const hipPull = Math.abs(grip) * 2;
	const hip: Joint = { x: bodyOffset, y: -b.torsoLength + 2 - hipPull };
	const neck: Joint = { x: bodyOffset - 0.5, y: hip.y - b.torsoLength };

	const headTilt = grip * 0.5;
	const head: Joint = {
		x: bodyOffset - 0.5 + headTilt,
		y: neck.y - b.neckLength - b.headRadius - 0.5
	};

	const shoulderL: Joint = { x: neck.x - b.shoulderWidth, y: neck.y + 1 };
	const shoulderR: Joint = { x: neck.x + b.shoulderWidth, y: neck.y + 1 };

	const highHandY = neck.y - upperArm - forearm * 0.8;
	const lowHandY = neck.y + 2;

	let handLPos: Joint, handRPos: Joint;
	if (grip > 0) {
		handLPos = { x: 0, y: highHandY };
		handRPos = { x: 0, y: lowHandY };
	} else {
		handRPos = { x: 0, y: highHandY };
		handLPos = { x: 0, y: lowHandY };
	}

	const elbowL: Joint = {
		x: (shoulderL.x + handLPos.x) / 2 + 2,
		y: (shoulderL.y + handLPos.y) / 2
	};
	const elbowR: Joint = {
		x: (shoulderR.x + handRPos.x) / 2 + 2,
		y: (shoulderR.y + handRPos.y) / 2
	};

	const legPhase = Math.sin(phase + Math.PI * 0.5) * 0.4;
	const kneeL = jointFromAngle(hip, 0.15 + legPhase, upperLeg);
	const footL = jointFromAngle(kneeL, 0.1 + legPhase * 0.3, lowerLeg);
	const kneeR = jointFromAngle(hip, -0.15 - legPhase, upperLeg);
	const footR = jointFromAngle(kneeR, -0.1 - legPhase * 0.3, lowerLeg);

	return {
		head, neck, shoulderL, shoulderR, elbowL, elbowR,
		handL: handLPos, handR: handRPos, hip, kneeL, kneeR, footL, footR
	};
}

// ── Registry Export ──────────────────────────────────────────────────

export function getDefaultAnimations(): AnimationResolver[] {
	return [
		createProceduralAnimation('idle', 'cyclic', 90, (ctx) =>
			idlePose(ctx.phase, ctx.bodyScale)
		),
		createProceduralAnimation('walk', 'cyclic', 28, (ctx) =>
			calculateRunPose(ctx.phase, ctx.bodyScale, ctx.params.speed ?? 1.0)
		),
		createProceduralAnimation('flee', 'cyclic', 22, (ctx) =>
			fleePose(ctx.phase, ctx.bodyScale)
		),
		createProceduralAnimation('jump', 'oneshot', 30, (ctx) =>
			jumpPose(ctx.params.subPhase ?? ctx.phase, ctx.bodyScale)
		),
		createProceduralAnimation('throw', 'oneshot', 7, (ctx) =>
			throwingPose(ctx.frameIndex, ctx.bodyScale)
		),
		createProceduralAnimation('plant', 'oneshot', 7, (ctx) =>
			plantingPose(ctx.frameIndex, ctx.bodyScale)
		),
		createProceduralAnimation('rope-climb', 'cyclic', 28, (ctx) =>
			ropeClimbPose(ctx.phase, ctx.bodyScale)
		),
		createProceduralAnimation('hang', 'oneshot', 7, (ctx) =>
			hangingPose(ctx.frameIndex % 2, ctx.bodyScale)
		),
		createProceduralAnimation('grabbed', 'oneshot', 7, (ctx) =>
			grabbedPose(ctx.frameIndex % 2, ctx.bodyScale)
		),
		createProceduralAnimation('hide', 'oneshot', 7, (ctx) =>
			hidingPose(ctx.frameIndex % 3, ctx.bodyScale)
		)
	];
}
