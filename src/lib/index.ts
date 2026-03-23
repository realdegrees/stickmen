// ── Main Component ───────────────────────────────────────────────────
export { default as StickmenStage } from './StickmenStage.svelte';

// ── Handle (returned by spawn) ───────────────────────────────────────
export { StickmanHandle } from './handle.js';

// ── Event System ─────────────────────────────────────────────────────
export { EventEmitter } from './events.js';
export type { StickmanEventMap, StickmanEventName } from './events.js';

// ── Engine (for advanced usage) ──────────────────────────────────────
export { StickmenEngine } from './engine/engine.js';
export type { SpawnOptions } from './engine/engine.js';

// ── Behavior System ───────────────────────────────────────────────────
export type { StickmanBehavior, BehaviorHandle, BehaviorInput } from './engine/behaviors/types.js';
export { WanderBehavior, FollowBehavior, IdleBehavior } from './engine/behaviors/defaults.js';

import { WanderBehavior, FollowBehavior, IdleBehavior } from './engine/behaviors/defaults.js';
/** Convenience namespace — pass these directly to spawn() without `new`. */
export const Behaviours = {
	Wander: WanderBehavior,
	Follow: FollowBehavior,
	Idle: IdleBehavior
} as const;

// ── Types ────────────────────────────────────────────────────────────
export type {
	ColorInput,
	PresetColorName,
	HSL,
	Point,
	BodyScale,
	Pose,
	StickmanSnapshot,
	PostProcessFrameData,
	PostProcessFn
} from './engine/types.js';
export { COLOR_PRESETS, resolveColor, colorToHSL } from './engine/types.js';

// ── Animation System ─────────────────────────────────────────────────
export type { AnimationResolver, AnimationContext, KeyframeAnimationDef, AnimKeyframe, JointAngles, EasingType } from './engine/animations/types.js';
export { createKeyframeAnimation, createProceduralAnimation } from './engine/animations/resolver.js';
export { AnimationRegistry } from './engine/animations/registry.js';

// ── Hat System ───────────────────────────────────────────────────────
export type { HatDef } from './engine/hats.js';
export { HatRegistry } from './engine/hats.js';

