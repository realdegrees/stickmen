/**
 * Built-in behavior classes: WanderBehavior, FollowBehavior, IdleBehavior.
 *
 * These ship with the package as ready-to-use examples.
 * All implement StickmanBehavior and can be passed directly to spawn() —
 * either as an instance (new WanderBehavior()) or as a class reference
 * (WanderBehavior), in which case spawn() instantiates it automatically.
 */

import type { BehaviorHandle, StickmanBehavior } from './types.js';
import type { Point } from '../types.js';

// ── Wander ───────────────────────────────────────────────────────────

/**
 * Wanders randomly across the navgrid, pausing briefly between destinations.
 *
 * Optional: set `fleeFrom` to a point to override the next path with a
 * path-away move (cleared once the stickman arrives somewhere safe).
 */
export class WanderBehavior implements StickmanBehavior {
	/** Set to make the stickman flee from a point instead of wandering. */
	fleeFrom: Point | null = null;

	protected _active = false;
	protected timeout: ReturnType<typeof setTimeout> | undefined;

	onAttach(handle: BehaviorHandle): void {
		this._active = true;
		this._wander(handle);
	}

	onDetach(_handle: BehaviorHandle): void {
		this._active = false;
		clearTimeout(this.timeout);
		this.timeout = undefined;
	}

	update(handle: BehaviorHandle, _dt: number): void {
		if (this.fleeFrom && !handle.hasPath) {
			handle.tryPathAway(this.fleeFrom);
		}
	}

	protected _wander(handle: BehaviorHandle): void {
		if (!this._active) return;
		const path = handle.tryPathRandom();
		if (!path) {
			// No path available right now — retry after a short delay.
			this.timeout = setTimeout(
				() => { if (handle.alive && this._active) this._wander(handle); },
				500
			);
			return;
		}
		path.on('arrived', () => {
			if (!this._active || this.fleeFrom) return;
			this.timeout = setTimeout(
				() => { if (handle.alive && this._active) this._wander(handle); },
				Math.random() * 1500 + 250
			);
		});
		path.on('aborted', () => {
			if (!this._active || this.fleeFrom) return;
			this._wander(handle);
		});
	}
}

// ── Follow ───────────────────────────────────────────────────────────

/**
 * Follows the mouse cursor within the stage container.
 *
 * Self-contained — wires its own mousemove listener on the container in
 * onAttach and removes it in onDetach. No external setup needed.
 *
 * Usage:
 *   stage.spawn({ behavior: FollowBehavior, color: 'cyan' });
 *   // or
 *   stage.spawn({ behavior: new FollowBehavior(), color: 'cyan' });
 */
export class FollowBehavior implements StickmanBehavior {
	/** Milliseconds between re-path checks. */
	readonly interval = 200;

	/** Minimum pixel movement required before re-pathing. */
	readonly minDelta = 40;

	protected _target: Point | null = null;
	protected _mouseHandler: ((e: MouseEvent) => void) | undefined;
	protected _timer: ReturnType<typeof setInterval> | undefined;
	protected _lastX = 0;
	protected _lastY = 0;

	onAttach(handle: BehaviorHandle): void {
		const el = handle.container;

		this._mouseHandler = (e: MouseEvent) => {
			const rect = el.getBoundingClientRect();
			this._target = {
				x: e.clientX - rect.left + el.scrollLeft,
				y: e.clientY - rect.top + el.scrollTop
			};
		};
		el.addEventListener('mousemove', this._mouseHandler);

		this._timer = setInterval(() => {
			if (!this._target || !handle.alive) return;
			const dx = this._target.x - this._lastX;
			const dy = this._target.y - this._lastY;
			if (dx * dx + dy * dy > this.minDelta * this.minDelta) {
				handle.tryPathTo(this._target.x, this._target.y);
				this._lastX = this._target.x;
				this._lastY = this._target.y;
			}
		}, this.interval);
	}

	onDetach(handle: BehaviorHandle): void {
		if (this._mouseHandler) {
			handle.container.removeEventListener('mousemove', this._mouseHandler);
			this._mouseHandler = undefined;
		}
		clearInterval(this._timer);
		this._timer = undefined;
	}
}

// ── Idle ─────────────────────────────────────────────────────────────

/** Does nothing — stickman stands still. */
export class IdleBehavior implements StickmanBehavior {}
