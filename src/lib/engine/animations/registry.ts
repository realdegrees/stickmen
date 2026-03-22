import type { AnimationResolver } from './types.js';
import { getDefaultAnimations } from './defaults.js';

/**
 * Registry of available animations.
 * Built-in animations are registered by default.
 * Custom animations can be registered and will override built-ins with the same ID.
 */
export class AnimationRegistry {
	private resolvers = new Map<string, AnimationResolver>();

	constructor(registerDefaults = true) {
		if (registerDefaults) {
			for (const anim of getDefaultAnimations()) {
				this.resolvers.set(anim.id, anim);
			}
		}
	}

	register(resolver: AnimationResolver): void {
		this.resolvers.set(resolver.id, resolver);
	}

	unregister(id: string): void {
		this.resolvers.delete(id);
	}

	get(id: string): AnimationResolver | undefined {
		return this.resolvers.get(id);
	}

	has(id: string): boolean {
		return this.resolvers.has(id);
	}

	list(): string[] {
		return Array.from(this.resolvers.keys());
	}
}
