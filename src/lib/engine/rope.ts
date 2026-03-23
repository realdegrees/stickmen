/**
 * Rope — Verlet Segment Physics
 *
 * A rope is a short-lived visual effect used during vertical traversal.
 * Features: Verlet physics, progressive deployment, piton anchor, auto-fade.
 */

import type { HSL, Renderable } from './types.js';
import { colorToHSLA } from './types.js';

export interface RopePoint {
	x: number;
	y: number;
	prevX: number;
	prevY: number;
	pinned: boolean;
}

export interface RopeConfig {
	anchorX: number;
	anchorY: number;
	endX: number;
	endY: number;
	segments?: number;
	color?: HSL;
	slackFactor?: number;
}

const GRAVITY = 0.15;
const DAMPING = 0.94;
const CONSTRAINT_ITERATIONS = 8;
const FADE_DURATION = 500;
const AUTO_FADE_DELAY = 1000;
const SPAWN_SWING_MIN = 1.5;
const SPAWN_SWING_MAX = 3.0;
const ROPE_SEGMENT_LENGTH = 12;

export class Rope implements Renderable {
	points: RopePoint[] = [];
	segmentLength: number;
	color: HSL;

	deployProgress = 1;

	private _active = true;
	private fading = false;
	private fadeTimer = 0;
	private fadeDelay = 0;
	private opacity = 1;

	anchorVisible = false;

	get position() {
		return { x: this.points[0]?.x ?? 0, y: this.points[0]?.y ?? 0 };
	}

	get active() {
		return this._active;
	}

	constructor(config: RopeConfig) {
		this.color = config.color ?? { h: 0, s: 0, l: 85 };

		const dx = config.endX - config.anchorX;
		const dy = config.endY - config.anchorY;
		const totalLength = Math.sqrt(dx * dx + dy * dy);
		const slack = config.slackFactor ?? 1;
		const ropeLength = totalLength * slack;
		const segments =
			config.segments ?? Math.max(4, Math.ceil(ropeLength / ROPE_SEGMENT_LENGTH));
		this.segmentLength = ropeLength / segments;

		const swingDir = Math.random() < 0.5 ? -1 : 1;
		const swingStrength =
			SPAWN_SWING_MIN + Math.random() * (SPAWN_SWING_MAX - SPAWN_SWING_MIN);

		for (let i = 0; i <= segments; i++) {
			const t = i / segments;
			const x = config.anchorX + dx * t;
			const y = config.anchorY + dy * t;
			const impulse = swingDir * swingStrength * t;
			this.points.push({
				x,
				y,
				prevX: x - impulse,
				prevY: y,
				pinned: i === 0
			});
		}
	}

	advanceDeploy(amount: number): void {
		this.deployProgress = Math.min(1, this.deployProgress + amount);
	}

	private get deployedCount(): number {
		return Math.max(2, Math.ceil(this.deployProgress * this.points.length));
	}

	getXAtY(y: number): number | null {
		for (let i = 0; i < this.points.length - 1; i++) {
			const a = this.points[i];
			const b = this.points[i + 1];
			const minY = Math.min(a.y, b.y);
			const maxY = Math.max(a.y, b.y);
			if (y >= minY - 1 && y <= maxY + 1) {
				const segDy = b.y - a.y;
				if (Math.abs(segDy) < 0.1) return (a.x + b.x) / 2;
				const t = (y - a.y) / segDy;
				return a.x + (b.x - a.x) * t;
			}
		}
		const first = this.points[0];
		const last = this.points[this.points.length - 1];
		return Math.abs(y - first.y) < Math.abs(y - last.y) ? first.x : last.x;
	}

	getNearestPoint(
		x: number,
		y: number
	): { index: number; point: RopePoint; dist: number } {
		let bestIdx = 0;
		let bestDist = Infinity;
		for (let i = 0; i < this.points.length; i++) {
			const p = this.points[i];
			const d = Math.sqrt((p.x - x) ** 2 + (p.y - y) ** 2);
			if (d < bestDist) {
				bestDist = d;
				bestIdx = i;
			}
		}
		return { index: bestIdx, point: this.points[bestIdx], dist: bestDist };
	}

	getPointAt(index: number): { x: number; y: number } {
		const p = this.points[Math.max(0, Math.min(index, this.points.length - 1))];
		return { x: p.x, y: p.y };
	}

	getSegmentAngle(index: number): number {
		const clamped = Math.max(0, Math.min(index, this.points.length - 1));
		let a: RopePoint, b: RopePoint;
		if (clamped >= this.points.length - 1) {
			a = this.points[clamped - 1];
			b = this.points[clamped];
		} else {
			a = this.points[clamped];
			b = this.points[clamped + 1];
		}
		// Angle from vertical: 0 = straight down, positive = leaning right
		return Math.atan2(b.x - a.x, b.y - a.y);
	}

	getEndVelocity(): { vx: number; vy: number } {
		const last = this.points[this.points.length - 1];
		if (!last) return { vx: 0, vy: 0 };
		return { vx: last.x - last.prevX, vy: last.y - last.prevY };
	}

	applyForce(pointIndex: number, fx: number, fy: number): void {
		const p = this.points[pointIndex];
		if (p && !p.pinned) {
			p.x += fx;
			p.y += fy;
		}
	}

	pinEnd(): void {
		const last = this.points[this.points.length - 1];
		if (last) last.pinned = true;
	}

	unpinEnd(): void {
		const last = this.points[this.points.length - 1];
		if (last) last.pinned = false;
	}

	moveEnd(x: number, y: number): void {
		const last = this.points[this.points.length - 1];
		if (last) {
			last.prevX = last.x;
			last.prevY = last.y;
			last.x = x;
			last.y = y;
		}
	}

	moveAnchor(x: number, y: number): void {
		const first = this.points[0];
		if (first) {
			first.prevX = first.x;
			first.prevY = first.y;
			first.x = x;
			first.y = y;
		}
	}

	startFade(): void {
		if (!this.fading && this.fadeDelay <= 0) {
			this.fadeDelay = AUTO_FADE_DELAY;
		}
	}

	update(deltaMs: number): void {
		if (!this._active) return;

		if (this.fadeDelay > 0) {
			this.fadeDelay -= deltaMs;
			if (this.fadeDelay <= 0) {
				this.fading = true;
				this.fadeTimer = FADE_DURATION;
			}
		}

		if (this.fading) {
			this.fadeTimer -= deltaMs;
			this.opacity = Math.max(0, this.fadeTimer / FADE_DURATION);
			if (this.opacity <= 0) {
				this._active = false;
				return;
			}
		}

		const dt = Math.min(deltaMs / 16.67, 2);
		const deployed = this.deployedCount;

		// Verlet integration
		for (let i = 0; i < deployed && i < this.points.length; i++) {
			const p = this.points[i];
			if (p.pinned) continue;

			const vx = (p.x - p.prevX) * DAMPING;
			const vy = (p.y - p.prevY) * DAMPING;

			p.prevX = p.x;
			p.prevY = p.y;

			p.x += vx;
			p.y += vy + GRAVITY * dt;
		}

		// Constraint solving
		for (let iter = 0; iter < CONSTRAINT_ITERATIONS; iter++) {
			for (let i = 0; i < deployed - 1 && i < this.points.length - 1; i++) {
				const a = this.points[i];
				const b = this.points[i + 1];

				const dx = b.x - a.x;
				const dy = b.y - a.y;
				const dist = Math.sqrt(dx * dx + dy * dy);
				if (dist === 0) continue;

				const diff = (this.segmentLength - dist) / dist;
				const offsetX = dx * diff * 0.5;
				const offsetY = dy * diff * 0.5;

				if (!a.pinned) {
					a.x -= offsetX;
					a.y -= offsetY;
				}
				if (!b.pinned) {
					b.x += offsetX;
					b.y += offsetY;
				}
			}
		}
	}

	draw(ctx: CanvasRenderingContext2D): void {
		if (!this._active || this.points.length < 2) return;

		const deployed = this.deployedCount;

		ctx.save();
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';

		// Dark brown base
		ctx.strokeStyle = `hsla(30, 45%, 25%, ${this.opacity * 0.85})`;
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		ctx.moveTo(this.points[0].x, this.points[0].y);
		for (let i = 1; i < deployed && i < this.points.length; i++) {
			ctx.lineTo(this.points[i].x, this.points[i].y);
		}
		ctx.stroke();

		// Lighter braided overlay
		ctx.strokeStyle = `hsla(35, 50%, 40%, ${this.opacity * 0.6})`;
		ctx.lineWidth = 0.8;
		for (let i = 0; i < deployed - 1 && i < this.points.length - 1; i += 2) {
			const a = this.points[i];
			const b = this.points[i + 1];
			ctx.beginPath();
			ctx.moveTo(a.x, a.y);
			ctx.lineTo(b.x, b.y);
			ctx.stroke();
		}

		// Piton anchor
		if (this.anchorVisible) {
			const anchor = this.points[0];
			ctx.fillStyle = `hsla(0, 0%, 70%, ${this.opacity})`;
			ctx.strokeStyle = `hsla(0, 0%, 75%, ${this.opacity})`;
			ctx.lineWidth = 1.5;
			ctx.beginPath();
			ctx.moveTo(anchor.x, anchor.y - 2);
			ctx.lineTo(anchor.x - 1.5, anchor.y + 2);
			ctx.lineTo(anchor.x + 1.5, anchor.y + 2);
			ctx.closePath();
			ctx.fill();

			ctx.beginPath();
			ctx.arc(anchor.x, anchor.y + 3, 1.5, 0, Math.PI * 2);
			ctx.stroke();
		}

		ctx.restore();
	}
}

// ── Piton Projectile ─────────────────────────────────────────────────

export interface PitonProjectile {
	x: number;
	y: number;
	targetX: number;
	targetY: number;
	elapsed: number;
	duration: number;
	startX: number;
	startY: number;
	active: boolean;
	onImpact: (x: number, y: number) => void;
}

export function createPitonProjectile(
	startX: number,
	startY: number,
	targetX: number,
	targetY: number,
	duration: number,
	onImpact: (x: number, y: number) => void
): PitonProjectile {
	return {
		x: startX,
		y: startY,
		targetX,
		targetY,
		elapsed: 0,
		duration,
		startX,
		startY,
		active: true,
		onImpact
	};
}

export function updatePiton(piton: PitonProjectile, deltaMs: number): boolean {
	if (!piton.active) return false;

	piton.elapsed += deltaMs;
	const t = Math.min(piton.elapsed / piton.duration, 1);

	const arcHeight = Math.abs(piton.targetY - piton.startY) * 0.4 + 20;
	const arcOffset = -4 * arcHeight * t * (t - 1);

	piton.x = piton.startX + (piton.targetX - piton.startX) * t;
	piton.y = piton.startY + (piton.targetY - piton.startY) * t - arcOffset;

	if (t >= 1) {
		piton.active = false;
		piton.x = piton.targetX;
		piton.y = piton.targetY;
		piton.onImpact(piton.targetX, piton.targetY);
		return false;
	}

	return true;
}

export function drawPiton(ctx: CanvasRenderingContext2D, piton: PitonProjectile): void {
	if (!piton.active) return;

	ctx.save();
	ctx.fillStyle = 'hsl(0, 0%, 70%)';

	const angle = Math.atan2(piton.targetY - piton.startY, piton.targetX - piton.startX);

	ctx.translate(piton.x, piton.y);
	ctx.rotate(angle);
	ctx.beginPath();
	ctx.moveTo(3, 0);
	ctx.lineTo(-2, -2);
	ctx.lineTo(-2, 2);
	ctx.closePath();
	ctx.fill();

	// Trail
	ctx.strokeStyle = 'hsla(0, 0%, 65%, 0.4)';
	ctx.lineWidth = 0.8;
	ctx.beginPath();
	ctx.moveTo(0, 0);
	ctx.lineTo(-8, 0);
	ctx.stroke();

	ctx.restore();
}
