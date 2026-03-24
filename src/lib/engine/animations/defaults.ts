/**
 * Built-in animation definitions as KeyframeAnimationDef JSON.
 * All angles in degrees. All 10 animations are named exports so the
 * editor can load them as presets.
 */

import type { KeyframeAnimationDef, AnimationResolver } from './types.js';
import { createKeyframeAnimation } from './resolver.js';

// ── Definitions ───────────────────────────────────────────────────────

export const idleAnimationDef: KeyframeAnimationDef = {
	id: 'idle',
	type: 'cyclic',
	frameCount: 90,
	keyframes: [
		{ t: 0,   joints: { torso: 2,  shoulderL: 14, elbowL: 8,  shoulderR: -14, elbowR: -8,  hipL: 4, hipR: -4 }, offset: { x: 1.5 }, easing: 'ease-in-out' },
		{ t: 0.5, joints: { torso: -2, shoulderL: 10, elbowL: 5,  shoulderR: -10, elbowR: -5,  hipL: 2, hipR: -2 }, offset: { x: -1.5 }, easing: 'ease-in-out' }
	]
};

export const walkAnimationDef: KeyframeAnimationDef = {
	id: 'walk',
	type: 'cyclic',
	frameCount: 28,
	keyframes: [
		{ t: 0,   joints: { torso: 8, hipL: -42, kneeL: 14,  hipR: 42,  kneeR: -14, shoulderL: 32,  elbowL: 18,  shoulderR: -30, elbowR: -12 }, easing: 'ease-in-out' },
		{ t: 0.5, joints: { torso: 8, hipL: 42,  kneeL: -14, hipR: -42, kneeR: 14,  shoulderL: -30, elbowL: -12, shoulderR: 32,  elbowR: 18  }, easing: 'ease-in-out' }
	]
};

export const fleeAnimationDef: KeyframeAnimationDef = {
	id: 'flee',
	type: 'cyclic',
	frameCount: 22,
	keyframes: [
		{ t: 0,   joints: { torso: 12, hipL: -57, kneeL: 17,  hipR: 57,  kneeR: -17, shoulderL: -115, elbowL: -17, shoulderR: -100, elbowR: -20 }, easing: 'ease-in-out' },
		{ t: 0.5, joints: { torso: 12, hipL: 57,  kneeL: -17, hipR: -57, kneeR: 17,  shoulderL: -100, elbowL: -20, shoulderR: -115, elbowR: -17 }, easing: 'ease-in-out' }
	]
};

export const jumpAnimationDef: KeyframeAnimationDef = {
	id: 'jump',
	type: 'oneshot',
	frameCount: 30,
	keyframes: [
		{ t: 0,    joints: { torso: 0, hipL: 3,  hipR: -3  }, offset: { y: 0  } },
		{ t: 0.15, joints: { torso: 5, shoulderL: 46, elbowL: 23, shoulderR: -46, elbowR: -23, hipL: 46, kneeL: -92, hipR: -46, kneeR: 92 }, offset: { y: -8 }, easing: 'ease-in'  },
		{ t: 0.25, joints: { torso: 0, shoulderL: -29, elbowL: -17, shoulderR: 29, elbowR: 17, hipL: 6,  hipR: -6,  kneeL: 6,  kneeR: -6  }, offset: { y: 0  }, easing: 'ease-out' },
		{ t: 0.5,  joints: { torso: 0, shoulderL: -40, elbowL: -17, shoulderR: 40, elbowR: 17, hipL: 23, hipR: -23, kneeL: 11, kneeR: -11 }, offset: { y: -1 }, easing: 'linear'   },
		{ t: 0.82, joints: { torso: 3, shoulderL: -17, elbowL: -17, shoulderR: 17, elbowR: 17, hipL: 9,  hipR: -9,  kneeL: 6,  kneeR: -6  }, offset: { y: 0  }, easing: 'ease-in'  },
		{ t: 1.0,  joints: { torso: 5, shoulderL: 11,  elbowL: 17,  shoulderR: -11, elbowR: -17, hipL: 34, hipR: -34, kneeL: -57, kneeR: 57 }, offset: { y: -4 }, easing: 'ease-out' }
	]
};

export const throwAnimationDef: KeyframeAnimationDef = {
	id: 'throw',
	type: 'oneshot',
	frameCount: 7,
	keyframes: [
		{ t: 0,   joints: { torso: -14, shoulderL: 23, elbowL: 17, shoulderR: 46,  elbowR: 23, hipL: 17, kneeL: -11, hipR: -14, kneeR: 6 }, easing: 'step' },
		{ t: 0.5, joints: { torso: -14, shoulderL: 23, elbowL: 17, shoulderR: 155, elbowR: 5,  hipL: 17, kneeL: -11, hipR: -14, kneeR: 6 }, easing: 'step' }
	]
};

export const plantAnimationDef: KeyframeAnimationDef = {
	id: 'plant',
	type: 'oneshot',
	frameCount: 7,
	keyframes: [
		{ t: 0,   joints: { shoulderL: 29, elbowL: 23, shoulderR: -23, elbowR: 29, hipL: 29, kneeL: -40, hipR: -23, kneeR: 40 }, offset: { x: 1, y: -7 }, easing: 'step' },
		{ t: 0.5, joints: { shoulderL: 29, elbowL: 23, shoulderR: 46,  elbowR: 29, hipL: 29, kneeL: -40, hipR: -23, kneeR: 40 }, offset: { x: 1, y: -7 }, easing: 'step' }
	]
};

export const hangAnimationDef: KeyframeAnimationDef = {
	id: 'hang',
	type: 'oneshot',
	frameCount: 7,
	keyframes: [
		{ t: 0,   joints: { shoulderL: -170, elbowL: 5,  shoulderR: 170,  elbowR: -5,  hipL: 6, hipR: -6 }, easing: 'ease-in-out' },
		{ t: 0.5, joints: { torso: 3, shoulderL: -168, elbowL: 8, shoulderR: 172, elbowR: -3, hipL: 9, hipR: -3 }, offset: { x: 0.5 }, easing: 'ease-in-out' }
	]
};

export const grabbedAnimationDef: KeyframeAnimationDef = {
	id: 'grabbed',
	type: 'oneshot',
	frameCount: 7,
	keyframes: [
		{ t: 0,   joints: { shoulderL: 11, elbowL: 23, shoulderR: -11, elbowR: -23, hipL: 9,  kneeL: -3, hipR: -9,  kneeR: 3  }, offset: { x: -0.5, y: -7 }, easing: 'ease-in-out' },
		{ t: 0.5, joints: { shoulderL: 23, elbowL: 11, shoulderR: -23, elbowR: -11, hipL: 14, kneeL: -8, hipR: -14, kneeR: 8  }, offset: { x: 0.5,  y: -7 }, easing: 'ease-in-out' }
	]
};

export const hideAnimationDef: KeyframeAnimationDef = {
	id: 'hide',
	type: 'oneshot',
	frameCount: 7,
	keyframes: [
		{ t: 0,    joints: { shoulderL: 46, elbowL: 23, shoulderR: -46, elbowR: -23, hipL: 34, kneeL: -52, hipR: -34, kneeR: 52 }, offset: { x: 0, y: -7 }, easing: 'step' },
		{ t: 0.4,  joints: { head: 5, shoulderL: 46, elbowL: 23, shoulderR: -46, elbowR: -23, hipL: 34, kneeL: -52, hipR: -34, kneeR: 52 }, offset: { x: 2, y: -7 }, easing: 'step' },
		{ t: 0.6,  joints: { head: 0, shoulderL: 46, elbowL: 23, shoulderR: -46, elbowR: -23, hipL: 34, kneeL: -52, hipR: -34, kneeR: 52 }, offset: { x: 0, y: -7 }, easing: 'step' }
	]
};

export const ropeClimbAnimationDef: KeyframeAnimationDef = {
	id: 'rope-climb',
	type: 'cyclic',
	frameCount: 28,
	keyframes: [
		{ t: 0,   joints: { shoulderL: -165, elbowL: 0,   shoulderR: -150, elbowR: -10, hipL: 9,  hipR: -9  }, offset: { x: 3, y: -1 }, easing: 'ease-in-out' },
		{ t: 0.5, joints: { shoulderL: -150, elbowL: -10, shoulderR: -165, elbowR: 0,   hipL: -9, hipR: 9   }, offset: { x: 3, y: -1 }, easing: 'ease-in-out' }
	]
};

// ── Registry Export ───────────────────────────────────────────────────

/** All 10 built-in animation definitions, keyed by id. */
export const DefaultAnimations = {
	idle:         idleAnimationDef,
	walk:         walkAnimationDef,
	flee:         fleeAnimationDef,
	jump:         jumpAnimationDef,
	throw:        throwAnimationDef,
	plant:        plantAnimationDef,
	hang:         hangAnimationDef,
	grabbed:      grabbedAnimationDef,
	hide:         hideAnimationDef,
	'rope-climb': ropeClimbAnimationDef
} as const;

export function getDefaultAnimations(): AnimationResolver[] {
	return Object.values(DefaultAnimations).map(createKeyframeAnimation);
}
