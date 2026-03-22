/**
 * Canvas render loop.
 * Manages a canvas element, render list, and requestAnimationFrame loop.
 */

import type { Renderable } from './types.js';

export class CanvasRenderer {
	private canvas: HTMLCanvasElement;
	private ctx: CanvasRenderingContext2D;
	renderables: Renderable[] = [];
	private animFrameId: number | null = null;
	private lastTime = 0;
	private _destroyed = false;

	/** External tick hook — called every frame before drawing */
	onTick: ((deltaMs: number) => void) | null = null;

	constructor(canvas: HTMLCanvasElement) {
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('Could not get 2D canvas context');
		this.canvas = canvas;
		this.ctx = ctx;
	}

	/** Resize canvas accounting for device pixel ratio */
	resize(width: number, height: number): void {
		const dpr = window.devicePixelRatio || 1;
		this.canvas.width = width * dpr;
		this.canvas.height = height * dpr;
		this.canvas.style.width = `${width}px`;
		this.canvas.style.height = `${height}px`;
		this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	}

	addRenderable(r: Renderable): void {
		if (!this.renderables.includes(r)) {
			this.renderables.push(r);
		}
	}

	removeRenderable(r: Renderable): void {
		this.renderables = this.renderables.filter((existing) => existing !== r);
	}

	clearRenderables(): void {
		this.renderables = [];
	}

	start(): void {
		if (this._destroyed) return;
		this.lastTime = performance.now();
		this.loop(this.lastTime);
	}

	stop(): void {
		if (this.animFrameId !== null) {
			cancelAnimationFrame(this.animFrameId);
			this.animFrameId = null;
		}
	}

	destroy(): void {
		this.stop();
		this.clearRenderables();
		this.onTick = null;
		this._destroyed = true;
	}

	private loop = (time: number): void => {
		if (this._destroyed) return;

		const delta = time - this.lastTime;
		this.lastTime = time;

		// External logic tick
		if (this.onTick) {
			this.onTick(delta);
		}

		// Clear and draw
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

		for (const r of this.renderables) {
			if (r.active) {
				r.draw(this.ctx);
			}
		}

		this.animFrameId = requestAnimationFrame(this.loop);
	};
}
