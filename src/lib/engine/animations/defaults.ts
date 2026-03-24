/**
 * Built-in animation definitions — loaded from JSON files.
 * Each file is a plain KeyframeAnimationDef object.
 */

import type { KeyframeAnimationDef, AnimationResolver } from './types.js';
import { createKeyframeAnimation } from './resolver.js';

import idle       from './data/idle.json'       with { type: 'json' };
import walk       from './data/walk.json'       with { type: 'json' };
import flee       from './data/flee.json'       with { type: 'json' };
import jump       from './data/jump.json'       with { type: 'json' };
import throwAnim  from './data/throw.json'      with { type: 'json' };
import plant      from './data/plant.json'      with { type: 'json' };
import hang       from './data/hang.json'       with { type: 'json' };
import grabbed    from './data/grabbed.json'    with { type: 'json' };
import hide       from './data/hide.json'       with { type: 'json' };
import ropeClimb  from './data/rope-climb.json' with { type: 'json' };

/** All 10 built-in animation definitions, keyed by id. */
export const DefaultAnimations = {
	idle,
	walk,
	flee,
	jump,
	throw:        throwAnim,
	plant,
	hang,
	grabbed,
	hide,
	'rope-climb': ropeClimb
} as unknown as Record<string, KeyframeAnimationDef>;

export function getDefaultAnimations(): AnimationResolver[] {
	return Object.values(DefaultAnimations).map(createKeyframeAnimation);
}
