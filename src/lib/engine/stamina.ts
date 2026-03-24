/**
 * Stamina — Per-stickman sprint resource.
 *
 * Sprint starts at >= sprintStart, stops at sprintStop, cooldown until sprintStart.
 */

import type { StaminaConfig } from './config.js';
import { DEFAULT_CONFIG } from './config.js';

export type StaminaActivity = 'idle' | 'moving' | 'sprinting';

export class Stamina {
	value = 1.0;
	sprinting = false;

	private cooldown = false;
	private c: StaminaConfig;

	constructor(config?: StaminaConfig) {
		this.c = config ?? DEFAULT_CONFIG.stamina;
	}

	/** Replace the stamina config at runtime (e.g. after a reactive update). */
	updateConfig(config: StaminaConfig): void {
		this.c = config;
	}

	update(dt: number, activity: StaminaActivity): void {
		const seconds = dt / 1000;

		if (activity === 'sprinting') {
			this.value -= this.c.drainRate * seconds;

			if (this.value <= 0) {
				this.value = 0;
				this.sprinting = false;
				this.cooldown = true;
			} else if (this.value <= this.c.sprintStop) {
				this.sprinting = false;
				this.cooldown = true;
			}
		} else {
			const rate = activity === 'moving' ? this.c.regenActive : this.c.regenBase;
			this.value = Math.min(1.0, this.value + rate * seconds);

			if (this.cooldown && this.value >= this.c.sprintStart) {
				this.cooldown = false;
			}
		}
	}

	canSprint(): boolean {
		return !this.cooldown && this.value >= this.c.sprintStart;
	}
}
