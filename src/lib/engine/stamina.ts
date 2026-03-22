/**
 * Stamina — Per-stickman sprint resource.
 *
 * Roam: sprint at >= 80%, stop at 50%, cooldown until 80%.
 * Flee: sprint until 0%, cooldown until 20%, latch stays on until drained.
 */

export type StaminaActivity = 'idle' | 'moving' | 'sprinting';

export class Stamina {
	value = 1.0;
	sprinting = false;

	private cooldown = false;
	private _fleeLatch = false;

	readonly DRAIN_RATE = 0.2;
	readonly REGEN_BASE = 0.1;
	readonly REGEN_ACTIVE = 0.2;

	readonly ROAM_START = 0.8;
	readonly ROAM_STOP = 0.5;
	readonly FLEE_START = 0.2;
	readonly FLEE_STOP = 0.0;

	setFleeing(active: boolean): void {
		if (active) {
			this._fleeLatch = true;
			if (this.cooldown && this.value >= this.FLEE_START) {
				this.cooldown = false;
			}
		}
	}

	get isFleeing(): boolean {
		return this._fleeLatch;
	}

	update(dt: number, activity: StaminaActivity): void {
		const seconds = dt / 1000;

		if (activity === 'sprinting') {
			this.value -= this.DRAIN_RATE * seconds;

			if (this.value <= 0) {
				this.value = 0;
				this.sprinting = false;
				this.cooldown = true;
				if (this._fleeLatch) this._fleeLatch = false;
			} else if (!this._fleeLatch && this.value <= this.ROAM_STOP) {
				this.sprinting = false;
				this.cooldown = true;
			}
		} else {
			const rate = activity === 'moving' ? this.REGEN_ACTIVE : this.REGEN_BASE;
			this.value = Math.min(1.0, this.value + rate * seconds);

			if (this.cooldown) {
				const threshold = this._fleeLatch ? this.FLEE_START : this.ROAM_START;
				if (this.value >= threshold) {
					this.cooldown = false;
				}
			}
		}
	}

	canSprint(): boolean {
		if (this.cooldown) return false;
		if (this._fleeLatch) return this.value > 0;
		return this.value >= this.ROAM_START;
	}
}
