/**
 * Stamina — Per-stickman sprint resource.
 *
 * Sprint starts at >= 80%, stops at 50%, cooldown until 80%.
 */

export type StaminaActivity = 'idle' | 'moving' | 'sprinting';

export class Stamina {
	value = 1.0;
	sprinting = false;

	private cooldown = false;

	readonly DRAIN_RATE = 0.2;
	readonly REGEN_BASE = 0.1;
	readonly REGEN_ACTIVE = 0.2;

	readonly SPRINT_START = 0.8;
	readonly SPRINT_STOP = 0.5;

	update(dt: number, activity: StaminaActivity): void {
		const seconds = dt / 1000;

		if (activity === 'sprinting') {
			this.value -= this.DRAIN_RATE * seconds;

			if (this.value <= 0) {
				this.value = 0;
				this.sprinting = false;
				this.cooldown = true;
			} else if (this.value <= this.SPRINT_STOP) {
				this.sprinting = false;
				this.cooldown = true;
			}
		} else {
			const rate = activity === 'moving' ? this.REGEN_ACTIVE : this.REGEN_BASE;
			this.value = Math.min(1.0, this.value + rate * seconds);

			if (this.cooldown && this.value >= this.SPRINT_START) {
				this.cooldown = false;
			}
		}
	}

	canSprint(): boolean {
		return !this.cooldown && this.value >= this.SPRINT_START;
	}
}
